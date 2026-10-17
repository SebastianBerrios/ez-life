import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { db } from '../../infrastructure/db/db';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { useFinancesData } from './useFinancesData';

async function seed() {
  const categoryRepo = new LocalCategoryRepository();
  await categoryRepo.saveDistributionSet('A', [{ id: 'bucket', user_id: 'A', name: 'Ahorro', percentage: 100, is_default: true, is_savings: true }]);
  await categoryRepo.saveExpenseCategory({ id: 'category', user_id: 'A', name: 'Comida', distribution_category_id: 'bucket' }, ['General']);
  return new LocalMovementRepository();
}

const expense = (amount: number, date = new Date()) => ({
  id: '', user_id: 'A', type: 'EXPENSE' as const, amount, date, distribution_category_id: 'bucket', expense_category_id: 'category', is_recurring: false,
});

beforeEach(async () => { await db.delete(); await db.open(); });

describe('useFinancesData', () => {
  it('updates after local commits and remote application without remounting', async () => {
    const movementRepo = await seed();
    const row = await movementRepo.save(expense(100));
    const { result } = renderHook(() => useFinancesData('A'));
    await waitFor(() => expect(result.current.view.rule.totalSpent).toBe(100));

    await act(async () => { await movementRepo.save({ ...row, amount: 250 }); });
    await waitFor(() => expect(result.current.view.rule.totalSpent).toBe(250));

    await act(async () => { await db.applyRemoteRecords('movements', [{ ...row, amount: 350, updated_at: new Date(Date.now() + 1000) }]); });
    await waitFor(() => expect(result.current.view.rule.totalSpent).toBe(350));
  });

  it('reads the month given by refDate and refetches when the month changes', async () => {
    const movementRepo = await seed();
    await movementRepo.save(expense(700, new Date(2026, 7, 10, 12)));
    const { result, rerender } = renderHook(({ refDate }) => useFinancesData('A', refDate), { initialProps: { refDate: new Date(2026, 7, 1) } });
    await waitFor(() => expect(result.current.view.movements).toHaveLength(1));
    expect(result.current.view.kpis.expense).toBe(700);

    // A new Date for the same month keeps the same data (no refetch needed to be visible).
    rerender({ refDate: new Date(2026, 7, 15) });
    expect(result.current.view.movements).toHaveLength(1);

    rerender({ refDate: new Date(2026, 8, 1) });
    await waitFor(() => expect(result.current.view.movements).toHaveLength(0));
    expect(result.current.view.kpis.expense).toBe(0);
  });

  it('builds KPIs from the month while capital uses the full history and transfers never count', async () => {
    const movementRepo = await seed();
    const accountRepo = new LocalPaymentAccountRepository();
    const bank = await accountRepo.save({ id: '', user_id: 'A', name: 'BCP', kind: 'debit', opening_balance: 100000 });
    const cash = await accountRepo.save({ id: '', user_id: 'A', name: 'Caja', kind: 'cash', opening_balance: 0 });
    const source = await new LocalIncomeSourceRepository().save({ id: '', user_id: 'A', name: 'Sueldo', amount: 300000 });
    const month = new Date(2026, 9, 10, 12);
    await movementRepo.save({ id: '', user_id: 'A', type: 'INCOME', amount: 300000, date: month, income_source_id: source.id, account_id: bank.id, is_recurring: false });
    await movementRepo.save({ ...expense(60000, month), account_id: bank.id });
    await movementRepo.save({ id: '', user_id: 'A', type: 'TRANSFER', amount: 20000, date: month, account_id: bank.id, to_account_id: cash.id, is_recurring: false });
    // Previous month: affects capital, not the KPIs of October.
    await movementRepo.save({ ...expense(5000, new Date(2026, 8, 5, 12)), account_id: bank.id });

    const { result } = renderHook(() => useFinancesData('A', new Date(2026, 9, 1)));
    await waitFor(() => expect(result.current.view.kpis.income).toBe(300000));
    const { kpis, rule, lookups } = result.current.view;
    expect(kpis).toMatchObject({ income: 300000, expense: 60000, netBalance: 240000, savingsRate: 80, savingsTargetPercent: 100, savingsStatus: 'below' });
    expect(kpis.capital).toBe(100000 + 300000 - 60000 - 5000);
    expect(kpis.accountCount).toBe(2); // BCP and Caja (the default "Efectivo" is seeded by the app shell, not here)
    expect(rule).toMatchObject({ base: 300000, totalBudget: 300000, totalSpent: 60000, spentPercentOfBase: 20 });
    expect(lookups.accountName[bank.id]).toBe('BCP');
    expect(lookups.bucket.bucket).toEqual({ name: 'Ahorro', percentage: 100 });
    expect(result.current.view.movements).toHaveLength(3);
  });

  it('flags a locally written movement as pending until the sync queue drains', async () => {
    const movementRepo = await seed();
    const saved = await movementRepo.save(expense(100));
    const { result } = renderHook(() => useFinancesData('A'));
    await waitFor(() => expect(result.current.view.pendingMovementIds.has(saved.id)).toBe(true));

    await act(async () => { await db.sync_queue.clear(); });
    await waitFor(() => expect(result.current.view.pendingMovementIds.has(saved.id)).toBe(false));
  });

  it('counts active debts and installment loans only', async () => {
    const now = new Date();
    await db.debts.bulkPut([
      { id: 'd1', user_id: 'A', counterparty_name: 'Ana', direction: 'lent', origin: 'manual', amount: 1000, settled_amount: 0, created_at: now, updated_at: now },
      { id: 'd2', user_id: 'A', counterparty_name: 'Beto', direction: 'lent', origin: 'manual', amount: 1000, settled_amount: 1000, created_at: now, updated_at: now },
    ]);
    await db.installment_loans.bulkPut([
      { id: 'l1', user_id: 'A', lender_name: 'BCP', amount: 1000, installment_count: 2, remaining_installments: 1, installment_amount: 500, status: 'active', created_at: now, updated_at: now },
      { id: 'l2', user_id: 'A', lender_name: 'Caja', amount: 1000, installment_count: 2, remaining_installments: 0, installment_amount: 500, status: 'settled', created_at: now, updated_at: now },
    ]);
    const { result } = renderHook(() => useFinancesData('A'));
    await waitFor(() => expect(result.current.view.activeDebtCount).toBe(1));
    expect(result.current.view.activeLoanCount).toBe(1);
  });

  it('reloads silently when refreshKey is bumped', async () => {
    const movementRepo = await seed();
    const { result, rerender } = renderHook(({ key }) => useFinancesData('A', undefined, key), { initialProps: { key: 0 } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await movementRepo.save(expense(900));
    rerender({ key: 1 });
    await waitFor(() => expect(result.current.view.kpis.expense).toBe(900));
    expect(result.current.loading).toBe(false);
  });
});
