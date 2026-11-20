import { describe, it, expect } from 'vitest';
import type { Debt, InstallmentLoan, Movement, PaymentAccount } from '../domain/models/types';
import type { RuleView } from './buildRuleView';
import { buildFinancesHero } from './buildFinancesHero';

const now = new Date(2026, 9, 15);

function makeRule(overrides: Partial<RuleView> = {}): RuleView {
  return {
    base: 300000,
    hasBuckets: true,
    buckets: [],
    totalBudget: 300000,
    totalSpent: 150000,
    spentPercentOfBase: 50,
    remaining: 150000,
    status: 'ok',
    ...overrides,
  };
}

function makeMovement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm1',
    user_id: 'u1',
    type: 'EXPENSE',
    amount: 10000,
    date: now,
    is_recurring: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<PaymentAccount>): PaymentAccount {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Visa',
    kind: 'credit',
    opening_balance: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeLoan(overrides: Partial<InstallmentLoan>): InstallmentLoan {
  return {
    id: 'l1',
    user_id: 'u1',
    lender_name: 'BCP',
    amount: 120000,
    installment_count: 12,
    remaining_installments: 8,
    installment_amount: 10000,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: 'd1',
    user_id: 'u1',
    counterparty_name: 'Juan',
    direction: 'borrowed',
    origin: 'manual',
    amount: 5000,
    settled_amount: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('buildFinancesHero', () => {
  it('computes net balance excluding transfers and soft-deleted movements', () => {
    const filteredMovements: Movement[] = [
      makeMovement({ id: 'm1', type: 'INCOME', amount: 250000 }),
      makeMovement({ id: 'm2', type: 'EXPENSE', amount: 80000 }),
      makeMovement({ id: 'm3', type: 'TRANSFER', amount: 50000 }),
      makeMovement({ id: 'm4', type: 'EXPENSE', amount: 99999, deleted_at: now }),
    ];

    const summary = buildFinancesHero({
      filteredMovements,
      allMovements: filteredMovements,
      accounts: [],
      loans: [],
      debts: [],
      rule: makeRule(),
    });

    expect(summary.movementsIncomeCents).toBe(250000);
    expect(summary.movementsExpenseCents).toBe(80000);
    expect(summary.movementsNetCents).toBe(170000);
  });

  it('returns null ruleSpentPercent when expected income base is zero', () => {
    const summary = buildFinancesHero({
      filteredMovements: [],
      allMovements: [],
      accounts: [],
      loans: [],
      debts: [],
      rule: makeRule({ base: 0, totalBudget: 0, spentPercentOfBase: null }),
    });

    expect(summary.ruleSpentPercent).toBeNull();
    expect(summary.ruleExpectedIncomeCents).toBe(0);
  });

  it('sums active loans, active credit cards, and borrowed debts into totalOwedCents while keeping lent debts separate', () => {
    const card = makeAccount({
      id: 'card-1',
      name: 'Interbank',
      kind: 'credit',
      opening_balance: -20000,
      credit_limit: 200000,
      payment_day: 15,
    });
    const archivedCard = makeAccount({
      id: 'card-2',
      name: 'Vieja',
      kind: 'credit',
      opening_balance: -50000,
      archived: true,
    });
    const cardSpend = makeMovement({ id: 'm1', account_id: 'card-1', type: 'EXPENSE', amount: 25000 });

    const summary = buildFinancesHero({
      filteredMovements: [cardSpend],
      allMovements: [cardSpend],
      accounts: [card, archivedCard],
      loans: [
        makeLoan({ id: 'l1', remaining_installments: 8, installment_amount: 10000, status: 'active' }),
        makeLoan({ id: 'l2', remaining_installments: 0, installment_amount: 10000, status: 'settled' }),
      ],
      debts: [
        makeDebt({ id: 'd1', direction: 'borrowed', amount: 15000, settled_amount: 5000 }),
        makeDebt({ id: 'd2', direction: 'lent', amount: 30000, settled_amount: 10000 }),
      ],
      rule: makeRule(),
    });

    // active loan (80,000) + card-1 owed (45,000) + borrowed pending (10,000) = 135,000
    expect(summary.creditCards).toHaveLength(1);
    expect(summary.creditCards[0]).toEqual({
      accountId: 'card-1',
      name: 'Interbank',
      owedCents: 45000,
      creditLimitCents: 200000,
      paymentDay: 15,
    });
    expect(summary.totalOwedCents).toBe(135000);
    expect(summary.totalOwedToMeCents).toBe(20000);
  });
});
