import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../infrastructure/db/db';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import Dashboard from './Dashboard';

/**
 * T030 — Independent Test of US1 against real Dexie (fake-indexeddb):
 * Opening 1,000 (debit + cash), income 500, cash expense 300 -> Balance S/ 1,200.00
 * and "Entró S/ 500.00 · Salió S/ 300.00". Credit purchase 100 -> S/ 1,100.00.
 * Pay card 100 from debit -> stays S/ 1,100.00. No "Capital disponible".
 */
describe('Dashboard — US1 Independent Test (fake-indexeddb)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    window.localStorage.clear();
  });

  it('computes Balance del mes across opening, income, expense, card purchase and card payment', async () => {
    const userId = 'u-us1';
    const monthDate = new Date(2026, 10, 10, 12, 0); // 2026-11
    await new LocalProfileRepository().save({ id: userId, balance_since: '2026-11', onboarding_step: 6, onboarding_version: 2 });

    const accRepo = new LocalPaymentAccountRepository();
    const moveRepo = new LocalMovementRepository();
    const catRepo = new LocalCategoryRepository();

    const incomeSource = await new LocalIncomeSourceRepository().save({
      id: '', user_id: userId, name: 'Sueldo', amount: 300000,
    });
    const bucket = await catRepo.saveDistributionCategory({
      id: '', user_id: userId, name: 'Necesidades', percentage: 100, is_default: true, is_savings: false,
    });
    const expCat = await catRepo.saveExpenseCategory({
      id: '', user_id: userId, distribution_category_id: bucket.id, name: 'General',
    }, ['Varios']);

    const debit = await accRepo.save({
      id: '', user_id: userId, name: 'BCP', kind: 'debit', opening_balance: 70000,
    });
    const cash = await accRepo.save({
      id: '', user_id: userId, name: 'Efectivo', kind: 'cash', opening_balance: 30000,
    });
    const card = await accRepo.save({
      id: '', user_id: userId, name: 'BBVA', kind: 'credit', opening_balance: 0, credit_limit: 500000, payment_day: 15,
    });

    await moveRepo.save({
      id: '', user_id: userId, type: 'INCOME', amount: 50000, date: monthDate, account_id: debit.id, income_source_id: incomeSource.id, is_recurring: false,
    });
    await moveRepo.save({
      id: '', user_id: userId, type: 'EXPENSE', amount: 30000, date: monthDate, account_id: cash.id, distribution_category_id: bucket.id, expense_category_id: expCat.id, is_recurring: false,
    });

    render(<Dashboard userId={userId} refDate={monthDate} />);

    expect(await screen.findByTestId('balance-amount')).toHaveTextContent('S/ 1,200.00');
    expect(screen.getByTestId('balance-flows')).toHaveTextContent('Entró S/ 500.00 · Salió S/ 300.00');
    expect(screen.queryByText(/capital disponible/i)).toBeNull();

    // Credit card purchase of S/ 100 -> drops Balance immediately to S/ 1,100.00
    await act(async () => {
      await moveRepo.save({
        id: '', user_id: userId, type: 'EXPENSE', amount: 10000, date: new Date(2026, 10, 12, 12, 0), account_id: card.id, distribution_category_id: bucket.id, expense_category_id: expCat.id, is_recurring: false,
      });
    });

    await waitFor(() => expect(screen.getByTestId('balance-amount')).toHaveTextContent('S/ 1,100.00'));
    expect(screen.getByTestId('balance-flows')).toHaveTextContent('Entró S/ 500.00 · Salió S/ 400.00');

    // Pay the card S/ 100 from debit -> Balance remains S/ 1,100.00, Salió unchanged
    await act(async () => {
      await moveRepo.save({
        id: '', user_id: userId, type: 'TRANSFER', amount: 10000, date: new Date(2026, 10, 15, 12, 0), account_id: debit.id, to_account_id: card.id, is_recurring: false,
      });
    });

    await waitFor(() => expect(screen.getByTestId('balance-amount')).toHaveTextContent('S/ 1,100.00'));
    expect(screen.getByTestId('balance-flows')).toHaveTextContent('Entró S/ 500.00 · Salió S/ 400.00');
  });
});
