import { describe, it, expect } from 'vitest';
import { buildPendingRegistrations, REGISTRATION_LEAD_DAYS } from './buildPendingRegistrations';
import type {
  IncomeSource,
  InstallmentLoan,
  Movement,
  MovementRecurrence,
  PaymentAccount,
  ReminderSkip,
} from '../domain/models/types';

const NOW = new Date(2026, 10, 10, 12, 0); // 2026-11-10

const baseRule = (overrides: Partial<MovementRecurrence> = {}): MovementRecurrence => ({
  id: 'r1',
  user_id: 'u1',
  type: 'EXPENSE',
  amount: 8000,
  date: new Date(2026, 9, 5),
  description: 'Gimnasio',
  is_recurring: true,
  active: true,
  day_of_month: 5,
  activated_month: '2026-10',
  created_at: new Date(2026, 9, 5),
  updated_at: new Date(2026, 9, 5),
  ...overrides,
});

const baseIncome = (overrides: Partial<IncomeSource> = {}): IncomeSource => ({
  id: 'inc-1',
  user_id: 'u1',
  name: 'Sueldo Base',
  amount: 300000,
  pay_day: 10,
  created_at: new Date(2026, 9, 1),
  updated_at: new Date(2026, 9, 1),
  ...overrides,
});

const baseLoan = (overrides: Partial<InstallmentLoan> = {}): InstallmentLoan => ({
  id: 'loan-1',
  user_id: 'u1',
  lender_name: 'BCP',
  amount: 1200000,
  installment_count: 12,
  remaining_installments: 6,
  installment_amount: 100000,
  payment_day: 13,
  status: 'active',
  created_at: new Date(2026, 9, 1),
  updated_at: new Date(2026, 9, 1),
  ...overrides,
});

const baseCard = (overrides: Partial<PaymentAccount> = {}): PaymentAccount => ({
  id: 'card-1',
  user_id: 'u1',
  name: 'BBVA',
  kind: 'credit',
  opening_balance: -80000,
  credit_limit: 500000,
  payment_day: 13,
  created_at: new Date(2026, 9, 1),
  updated_at: new Date(2026, 9, 1),
  ...overrides,
});

const baseInput = (overrides: Partial<Parameters<typeof buildPendingRegistrations>[0]> = {}) => ({
  today: NOW,
  rules: [] as MovementRecurrence[],
  incomeSources: [] as IncomeSource[],
  loans: [] as InstallmentLoan[],
  loanIdByPaymentId: {} as Record<string, string>,
  accounts: [] as PaymentAccount[],
  cardOwed: {} as Record<string, number>,
  monthMovements: [] as Movement[],
  skips: [] as ReminderSkip[],
  ...overrides,
});

describe('buildPendingRegistrations', () => {
  it('exposes the exact lead-day windows', () => {
    expect(REGISTRATION_LEAD_DAYS).toEqual({
      income: 0,
      recurrence: 0,
      installment: 3,
      card: 3,
    });
  });

  it('respects appearance windows: 0 days for income/recurrence, 3 days for installment/card', () => {
    // today = Nov 10
    const res = buildPendingRegistrations(baseInput({
      today: new Date(2026, 10, 10),
      incomeSources: [
        baseIncome({ id: 'inc-today', pay_day: 10 }),
        baseIncome({ id: 'inc-future', pay_day: 11 }),
      ],
      rules: [
        baseRule({ id: 'r-today', day_of_month: 10, description: 'Internet' }),
        baseRule({ id: 'r-future', day_of_month: 11, description: 'Netflix' }),
      ],
      loans: [
        baseLoan({ id: 'l-in', lender_name: 'BCP', payment_day: 13 }),   // 13 - 3 = 10 -> visible
        baseLoan({ id: 'l-out', lender_name: 'Caja', payment_day: 14 }), // 14 - 3 = 11 -> hidden
      ],
      accounts: [
        baseCard({ id: 'c-in', name: 'BBVA', payment_day: 13 }),
        baseCard({ id: 'c-out', name: 'Interbank', payment_day: 14 }),
      ],
      cardOwed: { 'c-in': 80000, 'c-out': 50000 },
    }));

    expect(res.map(item => item.key)).toEqual([
      'income:inc-today:2026-11',
      'recurrence:r-today:2026-11',
      'card:c-in:2026-11',
      'installment:l-in:2026-11',
    ]);
    expect(res.find(i => i.key === 'income:inc-today:2026-11')).toMatchObject({ title: 'Sueldo', amount: 300000, day: 10, overdue: false });
    expect(res.find(i => i.key === 'installment:l-in:2026-11')).toMatchObject({ title: 'Cuota de BCP', amount: 100000, day: 13, overdue: false });
    expect(res.find(i => i.key === 'card:c-in:2026-11')).toMatchObject({ title: 'Pagar tarjeta BBVA', amount: 80000, day: 13, overdue: false });
  });

  it('clamps days 29–31 to the last day of short months and clamps lead days to day 1', () => {
    // Non-leap Feb 28: rule day 31 clamps to 28 -> visible on Feb 28
    const feb28 = buildPendingRegistrations(baseInput({
      today: new Date(2026, 1, 28),
      rules: [baseRule({ id: 'r31', day_of_month: 31, activated_month: '2026-01' })],
    }));
    expect(feb28).toHaveLength(1);
    expect(feb28[0].day).toBe(28);
    expect(feb28[0].overdue).toBe(false);

    // Lead window crossing to previous month clamps to day 1: loan due day 2 is visible on day 1
    const day1 = buildPendingRegistrations(baseInput({
      today: new Date(2026, 10, 1),
      loans: [baseLoan({ id: 'l2', payment_day: 2 })],
      accounts: [baseCard({ id: 'c1', payment_day: 1 })],
      cardOwed: { c1: 10000 },
    }));
    expect(day1.map(i => i.refId)).toEqual(['c1', 'l2']);
    expect(day1.every(i => i.overdue === false)).toBe(true);
  });

  it('marks items covered ONLY by their structured link, never by matching description/amount (FR-019)', () => {
    const movBase = {
      user_id: 'u1',
      date: new Date(2026, 10, 5),
      is_recurring: false,
      created_at: NOW,
      updated_at: NOW,
    };

    // Unlinked manual movements with identical text/amount do NOT cover
    const uncovered = buildPendingRegistrations(baseInput({
      today: new Date(2026, 10, 15),
      incomeSources: [baseIncome({ id: 'inc-1', pay_day: 5 })],
      rules: [baseRule({ id: 'r1', day_of_month: 5, description: 'Gimnasio', amount: 8000 })],
      loans: [baseLoan({ id: 'loan-1', payment_day: 10 })],
      accounts: [baseCard({ id: 'card-1', payment_day: 12 })],
      cardOwed: { 'card-1': 50000 },
      monthMovements: [
        { ...movBase, id: 'm1', type: 'EXPENSE', amount: 8000, description: 'Gimnasio' }, // no recurrence_rule_id
        { ...movBase, id: 'm2', type: 'EXPENSE', amount: 100000, description: 'Cuota — BCP' }, // no installment_payment_id
        { ...movBase, id: 'm3', type: 'INCOME', amount: 300000, description: 'Sueldo', income_source_id: 'other-source' },
      ],
    }));
    expect(uncovered).toHaveLength(4);

    // Structured links cover all 4 items regardless of amount/description
    const covered = buildPendingRegistrations(baseInput({
      today: new Date(2026, 10, 15),
      incomeSources: [baseIncome({ id: 'inc-1', pay_day: 5 })],
      rules: [baseRule({ id: 'r1', day_of_month: 5 })],
      loans: [baseLoan({ id: 'loan-1', payment_day: 10 })],
      loanIdByPaymentId: { 'pay-9': 'loan-1' },
      accounts: [baseCard({ id: 'card-1', payment_day: 12 })],
      cardOwed: { 'card-1': 50000 },
      monthMovements: [
        { ...movBase, id: 'm-inc', type: 'INCOME', amount: 1, income_source_id: 'inc-1' },
        { ...movBase, id: 'm-rec', type: 'EXPENSE', amount: 1, recurrence_rule_id: 'r1', recurrence_month: '2026-11' },
        { ...movBase, id: 'm-loan', type: 'EXPENSE', amount: 1, installment_payment_id: 'pay-9' },
        { ...movBase, id: 'm-card', type: 'TRANSFER', amount: 1, account_id: 'd1', to_account_id: 'card-1' },
      ],
    }));
    expect(covered).toHaveLength(0);
  });

  it('excludes skipped items for the current month and lets them reappear next month', () => {
    const skip: ReminderSkip = {
      id: 'skip-1',
      user_id: 'u1',
      item_key: 'recurrence:r1:2026-11',
      month: '2026-11',
      created_at: NOW,
      updated_at: NOW,
    };

    const nov = buildPendingRegistrations(baseInput({
      today: new Date(2026, 10, 10),
      rules: [baseRule({ id: 'r1', day_of_month: 5 })],
      skips: [skip],
    }));
    expect(nov).toHaveLength(0);

    // Next month (2026-12) -> new key, reappears!
    const dec = buildPendingRegistrations(baseInput({
      today: new Date(2026, 11, 10),
      rules: [baseRule({ id: 'r1', day_of_month: 5 })],
      skips: [skip],
    }));
    expect(dec).toHaveLength(1);
    expect(dec[0].key).toBe('recurrence:r1:2026-12');
  });

  it('excludes settled loans, income already received this month, items without day, cards with owed 0, and marks overdue items', () => {
    const res = buildPendingRegistrations(baseInput({
      today: new Date(2026, 10, 15),
      incomeSources: [
        baseIncome({ id: 'inc-received', pay_day: 5, received_month: '2026-11' }),
        baseIncome({ id: 'inc-noday', pay_day: undefined }),
        baseIncome({ id: 'inc-overdue', name: 'Freelance', pay_day: 3 }),
      ],
      loans: [
        baseLoan({ id: 'l-settled', status: 'settled', remaining_installments: 0, payment_day: 5 }),
        baseLoan({ id: 'l-noday', payment_day: undefined }),
      ],
      accounts: [
        baseCard({ id: 'c-zero', payment_day: 10 }),
        baseCard({ id: 'c-noday', payment_day: undefined }),
        baseCard({ id: 'c-arch', payment_day: 10, archived: true }),
      ],
      cardOwed: { 'c-zero': 0, 'c-noday': 50000, 'c-arch': 50000 },
      rules: [
        baseRule({ id: 'r-inactive', active: false, day_of_month: 5 }),
        baseRule({ id: 'r-future-act', activated_month: '2026-12', day_of_month: 5 }),
        baseRule({ id: 'r-today', day_of_month: 15, description: 'Agua' }),
      ],
    }));

    expect(res).toEqual([
      { key: 'income:inc-overdue:2026-11', kind: 'income', refId: 'inc-overdue', title: 'Freelance', amount: 300000, day: 3, overdue: true },
      { key: 'recurrence:r-today:2026-11', kind: 'recurrence', refId: 'r-today', title: 'Agua', amount: 8000, day: 15, overdue: false },
    ]);
  });
});
