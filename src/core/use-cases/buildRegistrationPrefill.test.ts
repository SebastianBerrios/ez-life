import { describe, it, expect } from 'vitest';
import { buildRegistrationPrefill } from './buildRegistrationPrefill';
import type { MovementRecurrence, PaymentAccount, PendingRegistration } from '../domain/models/types';

const t = new Date('2026-01-01T00:00:00Z');
const accounts: PaymentAccount[] = [
  { id: 'cash-1', user_id: 'u1', name: 'Efectivo', kind: 'cash', opening_balance: 0, created_at: t, updated_at: t },
  { id: 'debit-1', user_id: 'u1', name: 'BCP', kind: 'debit', opening_balance: 100000, created_at: t, updated_at: t },
  { id: 'card-1', user_id: 'u1', name: 'BBVA', kind: 'credit', opening_balance: -80000, credit_limit: 500000, created_at: t, updated_at: t },
];

describe('buildRegistrationPrefill', () => {
  it('maps income item to income tab with incomeSourceId and primary account', () => {
    const item: PendingRegistration = {
      key: 'income:inc-1:2026-11', kind: 'income', refId: 'inc-1', title: 'Sueldo', amount: 300000, day: 28, overdue: false,
    };
    expect(buildRegistrationPrefill(item, { userId: 'u1', accounts })).toEqual({
      tab: 'income',
      amountCents: 300000,
      accountId: 'debit-1',
      incomeSourceId: 'inc-1',
      description: 'Sueldo',
    });
  });

  it('maps expense and income recurrence items with recurrenceRuleId + recurrenceMonth and rule categories', () => {
    const rule: MovementRecurrence = {
      id: 'r1', user_id: 'u1', type: 'EXPENSE', amount: 8000, date: t, description: 'Gimnasio',
      distribution_category_id: 'b1', expense_category_id: 'ec1', expense_subcategory_id: 'es1', account_id: 'cash-1',
      is_recurring: true, active: true, day_of_month: 5, activated_month: '2026-10', created_at: t, updated_at: t,
    };
    const item: PendingRegistration = {
      key: 'recurrence:r1:2026-11', kind: 'recurrence', refId: 'r1', title: 'Gimnasio', amount: 8000, day: 5, overdue: false,
    };
    expect(buildRegistrationPrefill(item, { userId: 'u1', accounts, rules: [rule] })).toEqual({
      tab: 'expense',
      amountCents: 8000,
      accountId: 'cash-1',
      incomeSourceId: undefined,
      recurrenceRuleId: 'r1',
      recurrenceMonth: '2026-11',
      distributionCategoryId: 'b1',
      expenseCategoryId: 'ec1',
      expenseSubcategoryId: 'es1',
      description: 'Gimnasio',
    });

    const incRule: MovementRecurrence = { ...rule, id: 'r2', type: 'INCOME', income_source_id: 'inc-1', account_id: undefined };
    const incItem: PendingRegistration = { ...item, key: 'recurrence:r2:2026-11', refId: 'r2', title: 'Renta' };
    expect(buildRegistrationPrefill(incItem, { userId: 'u1', accounts, rules: [incRule] })).toMatchObject({
      tab: 'income',
      accountId: 'debit-1',
      incomeSourceId: 'inc-1',
      recurrenceRuleId: 'r2',
      recurrenceMonth: '2026-11',
    });
  });

  it('maps installment item to loan tab with loanId and primary account', () => {
    const item: PendingRegistration = {
      key: 'installment:loan-1:2026-11', kind: 'installment', refId: 'loan-1', title: 'Cuota de BCP', amount: 100000, day: 5, overdue: false,
    };
    expect(buildRegistrationPrefill(item, { userId: 'u1', accounts })).toEqual({
      tab: 'loan',
      amountCents: 100000,
      accountId: 'debit-1',
      loanId: 'loan-1',
      description: 'Cuota de BCP',
    });
  });

  it('maps card item to transfer tab from primaryAccountId to card with suggested owed amount', () => {
    const item: PendingRegistration = {
      key: 'card:card-1:2026-11', kind: 'card', refId: 'card-1', title: 'Pagar tarjeta BBVA', amount: 80000, day: 15, overdue: false,
    };
    expect(buildRegistrationPrefill(item, { userId: 'u1', accounts })).toEqual({
      tab: 'transfer',
      amountCents: 80000,
      accountId: 'debit-1',
      toAccountId: 'card-1',
      description: 'Pagar tarjeta BBVA',
    });
  });
});
