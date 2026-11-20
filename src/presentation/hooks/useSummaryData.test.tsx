import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../infrastructure/db/db';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { useSummaryData } from './useSummaryData';

describe('useSummaryData', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns zero balance and empty cards for a user with no data', async () => {
    const { result } = renderHook(() => useSummaryData('u-empty', new Date(2026, 10, 1)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.view.balance).toEqual({
      opening: 0,
      entro: 0,
      salio: 0,
      ahorraste: 0,
      sacaste: 0,
      ajuste: 0,
      balance: 0,
      savingsNet: 0,
      cards: [],
    });
  });

  it('reacts immediately to a new local movement and computes month balance for selected months', async () => {
    const userId = 'u1';
    const accountRepo = new LocalPaymentAccountRepository();
    const moveRepo = new LocalMovementRepository();
    const catRepo = new LocalCategoryRepository();
    await new LocalProfileRepository().save({ id: userId, balance_since: '2026-10' });
    const incomeSource = await new LocalIncomeSourceRepository().save({
      id: '', user_id: userId, name: 'Sueldo', amount: 300000,
    });
    const bucket = await catRepo.saveDistributionCategory({
      id: '', user_id: userId, name: 'Necesidades', percentage: 100, is_default: true, is_savings: false,
    });
    const expCat = await catRepo.saveExpenseCategory({
      id: '', user_id: userId, distribution_category_id: bucket.id, name: 'Comida',
    }, ['General']);

    const debit = await accountRepo.save({
      id: '',
      user_id: userId,
      name: 'BCP',
      kind: 'debit',
      opening_balance: 100000,
    });

    await moveRepo.save({
      id: '',
      user_id: userId,
      type: 'INCOME',
      amount: 50000,
      date: new Date(2026, 9, 10, 12, 0), // 2026-10
      account_id: debit.id,
      income_source_id: incomeSource.id,
      is_recurring: false,
    });

    const { result, rerender } = renderHook(
      ({ refDate }) => useSummaryData(userId, refDate),
      { initialProps: { refDate: new Date(2026, 10, 1) } }, // 2026-11
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view.balance).toMatchObject({
      opening: 150000,
      entro: 0,
      salio: 0,
      balance: 150000,
    });

    // Save a new expense in 2026-11 and verify reactive update
    await act(async () => {
      await moveRepo.save({
        id: '',
        user_id: userId,
        type: 'EXPENSE',
        amount: 30000,
        date: new Date(2026, 10, 5, 12, 0),
        account_id: debit.id,
        distribution_category_id: bucket.id,
        expense_category_id: expCat.id,
        is_recurring: false,
      });
    });

    await waitFor(() => expect(result.current.view.balance.balance).toBe(120000));
    expect(result.current.view.balance).toMatchObject({
      opening: 150000,
      entro: 0,
      salio: 30000,
      balance: 120000,
    });

    // Switch to previous month (2026-10)
    rerender({ refDate: new Date(2026, 9, 1) });
    await waitFor(() => expect(result.current.view.balance.entro).toBe(50000));
    expect(result.current.view.balance).toMatchObject({
      opening: 100000,
      entro: 50000,
      salio: 0,
      balance: 150000,
    });
  });

  it('builds pending registrations only for the real current month, builds prefill, reacts to registering and skipping', async () => {
    const userId = 'u-pending';
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dueDay = Math.min(now.getDate(), 28);

    const accountRepo = new LocalPaymentAccountRepository();
    const moveRepo = new LocalMovementRepository();
    const catRepo = new LocalCategoryRepository();

    await new LocalProfileRepository().save({ id: userId, balance_since: currentMonthKey });
    const debit = await accountRepo.save({
      id: '',
      user_id: userId,
      name: 'BCP',
      kind: 'debit',
      opening_balance: 200000,
    });
    const card = await accountRepo.save({
      id: '',
      user_id: userId,
      name: 'Visa',
      kind: 'credit',
      opening_balance: -80000,
      credit_limit: 500000,
      payment_day: dueDay,
    });
    const bucket = await catRepo.saveDistributionCategory({
      id: '', user_id: userId, name: 'Necesidades', percentage: 100, is_default: true, is_savings: false,
    });
    const expCat = await catRepo.saveExpenseCategory({
      id: '', user_id: userId, distribution_category_id: bucket.id, name: 'Salud',
    }, ['Gym']);

    const ruleId = 'rec-gym-1';
    await db.movement_recurrences.put({
      id: ruleId,
      user_id: userId,
      type: 'EXPENSE',
      amount: 8000,
      date: now,
      is_recurring: true,
      description: 'Gimnasio',
      day_of_month: dueDay,
      activated_month: currentMonthKey,
      account_id: debit.id,
      distribution_category_id: bucket.id,
      expense_category_id: expCat.id,
      active: true,
      created_at: now,
      updated_at: now,
    });
    const rule = { id: ruleId };

    const { result, rerender } = renderHook(
      ({ refDate }) => useSummaryData(userId, refDate),
      { initialProps: { refDate: new Date(now.getFullYear(), now.getMonth(), 1) } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view.pending.map(p => p.kind).sort()).toEqual(['card', 'recurrence']);

    const recItem = result.current.view.pending.find(p => p.kind === 'recurrence')!;
    const cardItem = result.current.view.pending.find(p => p.kind === 'card')!;

    expect(result.current.register(recItem)).toMatchObject({
      tab: 'expense',
      amountCents: 8000,
      accountId: debit.id,
      recurrenceRuleId: rule.id,
      recurrenceMonth: currentMonthKey,
      description: 'Gimnasio',
    });
    expect(result.current.register(cardItem)).toMatchObject({
      tab: 'transfer',
      amountCents: 80000,
      accountId: debit.id,
      toAccountId: card.id,
    });

    // Register the recurrence item via a linked movement -> disappears reactively
    await act(async () => {
      await moveRepo.save({
        id: '',
        user_id: userId,
        type: 'EXPENSE',
        amount: 8000,
        date: now,
        description: 'Gimnasio',
        account_id: debit.id,
        distribution_category_id: bucket.id,
        expense_category_id: expCat.id,
        recurrence_rule_id: rule.id,
        recurrence_month: currentMonthKey,
        is_recurring: true,
      });
    });
    await waitFor(() => expect(result.current.view.pending.map(p => p.kind)).toEqual(['card']));

    // Skip the remaining card item -> disappears reactively
    await act(async () => {
      await result.current.skip(cardItem);
    });
    await waitFor(() => expect(result.current.view.pending).toEqual([]));

    // Switch to another month -> always empty pending list
    rerender({ refDate: new Date(now.getFullYear(), now.getMonth() - 1, 1) });
    await waitFor(() => expect(result.current.view.isCurrentMonth).toBe(false));
    expect(result.current.view.pending).toEqual([]);
  });

  it('derives accounts, debts (including legacy card without creditLimit and excluding settled loans), compact rule, primary goal and progress.visible (T064)', async () => {
    const userId = 'u-us4';
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await new LocalProfileRepository().save({
      id: userId,
      balance_since: currentMonthKey,
      gamification_enabled: true,
    });
    await new LocalIncomeSourceRepository().save({
      id: '',
      user_id: userId,
      name: 'Sueldo',
      amount: 300000,
    });

    const catRepo = new LocalCategoryRepository();
    const needs = await catRepo.saveDistributionCategory({
      id: '', user_id: userId, name: 'Necesidades', percentage: 50, is_default: true, is_savings: false,
    });
    const wants = await catRepo.saveDistributionCategory({
      id: '', user_id: userId, name: 'Deseos', percentage: 30, is_default: true, is_savings: false,
    });
    await catRepo.saveDistributionCategory({
      id: '', user_id: userId, name: 'Ahorro', percentage: 20, is_default: true, is_savings: true,
    });
    const expCat = await catRepo.saveExpenseCategory(
      { id: '', user_id: userId, distribution_category_id: needs.id, name: 'Vivienda' },
      ['Alquiler'],
    );

    const accRepo = new LocalPaymentAccountRepository();
    const debit = await accRepo.save({
      id: '', user_id: userId, name: 'BCP', kind: 'debit', opening_balance: 100000,
    });
    await accRepo.save({
      id: '', user_id: userId, name: 'Archivada', kind: 'debit', opening_balance: 50000, archived: true,
    });
    // Legacy credit card directly seeded without credit_limit
    await db.payment_accounts.put({
      id: 'legacy-card',
      user_id: userId,
      name: 'Visa Antigua',
      kind: 'credit',
      opening_balance: -80000,
      payment_day: 15,
      created_at: now,
      updated_at: now,
    });

    const loanRepo = new LocalInstallmentLoanRepository();
    await loanRepo.create({
      id: 'loan-active',
      user_id: userId,
      lender_name: 'Interbank',
      amount: 300000,
      installment_count: 12,
      installment_amount: 25000,
      distribution_category_id: needs.id,
      payment_day: 20,
    }, 2);
    // Settled loan (alreadyPaid === installment_count) MUST NOT appear in debts.loans
    await loanRepo.create({
      id: 'loan-settled',
      user_id: userId,
      lender_name: 'Prestamo Saldado',
      amount: 100000,
      installment_count: 4,
      installment_amount: 25000,
      distribution_category_id: wants.id,
    }, 4);

    await new LocalSavingsGoalRepository().save({
      id: '',
      user_id: userId,
      name: 'Fondo emergencia',
      target_amount: 500000,
    });

    await new LocalMovementRepository().save({
      id: '',
      user_id: userId,
      type: 'EXPENSE',
      amount: 61500,
      date: now,
      account_id: debit.id,
      distribution_category_id: needs.id,
      expense_category_id: expCat.id,
      is_recurring: false,
    });

    const { result } = renderHook(() => useSummaryData(userId, new Date(now.getFullYear(), now.getMonth(), 1)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Archived account excluded; BCP balance = 1000 - 615 = 385
    expect(result.current.view.accounts).toEqual([
      { id: debit.id, name: 'BCP', kind: 'debit', balanceCents: 38500 },
    ]);

    // Legacy card has creditLimit === undefined
    expect(result.current.view.debts.cards).toEqual([
      expect.objectContaining({
        accountId: 'legacy-card',
        name: 'Visa Antigua',
        owed: 80000,
        creditLimit: undefined,
        paymentDay: 15,
      }),
    ]);

    // Settled loan excluded; active loan has 10 remaining * 250 = 2500
    expect(result.current.view.debts.loans).toHaveLength(1);
    expect(result.current.view.debts.loans[0]).toMatchObject({
      id: 'loan-active',
      name: 'Interbank',
      remainingBalanceCents: 250000,
      paymentDay: 20,
    });
    expect(result.current.view.debts.loans[0].nextInstallment.amountCents).toBe(25000);

    // Compact rule uses declared income 3000 * 50% = 1500, spent 615 -> remaining 885
    const needsRow = result.current.view.rule.buckets.find(b => b.id === needs.id)!;
    expect(needsRow.phrase).toBe('Te quedan S/ 885.00 para necesidades');

    expect(result.current.view.primaryGoal?.goal.name).toBe('Fondo emergencia');
    expect(result.current.view.progress.visible).toBe(true);

    // T076: checklist reflects income + accounts + cards + loans (all 4 present above -> doneCount 4, visible false)
    expect(result.current.view.checklist.doneCount).toBe(4);
    expect(result.current.view.checklist.visible).toBe(false);
  });

  it('tracks setup checklist progress and dismisses it persistently (T076)', async () => {
    const userId = 'u-checklist';
    await new LocalProfileRepository().save({ id: userId, onboarding_step: 6, onboarding_version: 2 });
    await new LocalIncomeSourceRepository().save({ id: '', user_id: userId, name: 'Sueldo', amount: 300000 });
    await new LocalPaymentAccountRepository().save({ id: '', user_id: userId, name: 'BCP', kind: 'debit', opening_balance: 50000 });

    const { result } = renderHook(() => useSummaryData(userId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.view.checklist.doneCount).toBe(2);
    expect(result.current.view.checklist.visible).toBe(true);
    expect(result.current.view.checklist.nextPending).toBe('cards');

    // Completing cards bumps counter from 2 to 3 reactively
    await act(async () => {
      await new LocalPaymentAccountRepository().save({
        id: '', user_id: userId, name: 'Visa', kind: 'credit', opening_balance: 0, credit_limit: 400000,
      });
    });
    await waitFor(() => expect(result.current.view.checklist.doneCount).toBe(3));
    expect(result.current.view.checklist.nextPending).toBe('loans');

    // Dismissing hides card and persists checklist_dismissed = true
    await act(async () => {
      await result.current.dismissChecklist();
    });
    await waitFor(() => expect(result.current.view.checklist.visible).toBe(false));
    expect((await db.profiles.get(userId))?.checklist_dismissed).toBe(true);
  });
});
