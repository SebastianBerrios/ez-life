import { describe, it, expect } from 'vitest';
import type { DistributionCategory, Movement } from '../domain/models/types';
import { buildCompactRule } from './buildCompactRule';

const NOW = new Date(2026, 10, 10, 12, 0);

function bucket(id: string, name: string, percentage: number, is_savings = false): DistributionCategory {
  return {
    id,
    user_id: 'u1',
    name,
    percentage,
    is_default: true,
    is_savings,
    created_at: NOW,
    updated_at: NOW,
  };
}

function movement(overrides: Partial<Movement> & Pick<Movement, 'id' | 'type' | 'amount'>): Movement {
  return {
    user_id: 'u1',
    date: NOW,
    is_recurring: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('buildCompactRule (T062)', () => {
  const buckets = [
    bucket('needs', 'Necesidades', 50, false),
    bucket('wants', 'Deseos', 30, false),
    bucket('savings', 'Ahorro', 20, true),
  ];

  it('uses expectedIncome * percentage as budget base and formats remaining/exceeded phrases neutrally', () => {
    const movements: Movement[] = [
      // S/ 615 spent in Needs (out of S/ 1,500 budget -> S/ 885 left)
      movement({ id: 'm1', type: 'EXPENSE', amount: 61500, distribution_category_id: 'needs', account_id: 'debit-1' }),
      // S/ 1,020 spent in Wants (out of S/ 900 budget -> S/ 120 over)
      movement({ id: 'm2', type: 'EXPENSE', amount: 102000, distribution_category_id: 'wants', account_id: 'debit-1' }),
    ];

    const rule = buildCompactRule(movements, buckets, 300000, 40000);

    expect(rule.expectedIncome).toBe(300000);
    expect(rule.hasBuckets).toBe(true);
    expect(rule.buckets.map(b => b.id)).toEqual(['needs', 'wants', 'savings']);

    const needs = rule.buckets[0];
    expect(needs.budget).toBe(150000);
    expect(needs.spent).toBe(61500);
    expect(needs.remaining).toBe(88500);
    expect(needs.exceeded).toBe(false);
    expect(needs.phrase).toBe('Te quedan S/ 885.00 para necesidades');

    const wants = rule.buckets[1];
    expect(wants.budget).toBe(90000);
    expect(wants.spent).toBe(102000);
    expect(wants.remaining).toBe(-12000);
    expect(wants.exceeded).toBe(true);
    expect(wants.barPercent).toBe(100);
    expect(wants.phrase).toBe('Te pasaste S/ 120.00 en deseos');

    const savings = rule.buckets[2];
    expect(savings.budget).toBe(60000);
    expect(savings.spent).toBe(40000);
    expect(savings.negativeSavings).toBe(false);
    expect(savings.barPercent).toBe(67);
  });

  it('includes credit card purchases, savings-account expenses, and loan installments, while excluding transfers and adjustments', () => {
    const movements: Movement[] = [
      // Credit card purchase counts on purchase day
      movement({ id: 'cc-buy', type: 'EXPENSE', amount: 20000, distribution_category_id: 'needs', account_id: 'card-1' }),
      // Expense paid directly from savings account counts in its bucket
      movement({ id: 'sav-exp', type: 'EXPENSE', amount: 15000, distribution_category_id: 'needs', account_id: 'sav-1' }),
      // Loan installment movement counts in the loan's bucket (Principle X)
      movement({ id: 'loan-inst', type: 'EXPENSE', amount: 25000, distribution_category_id: 'needs', account_id: 'debit-1', installment_payment_id: 'pay-1' }),
      // Card payment transfer MUST NOT count as expense
      movement({ id: 'cc-pay', type: 'TRANSFER', amount: 20000, account_id: 'debit-1', to_account_id: 'card-1' }),
      // Balance adjustment MUST NOT count as expense
      movement({ id: 'adj', type: 'EXPENSE', amount: 50000, is_adjustment: true, distribution_category_id: 'needs' }),
      // Deleted movement MUST NOT count
      movement({ id: 'del', type: 'EXPENSE', amount: 10000, distribution_category_id: 'needs', deleted_at: NOW }),
    ];

    const rule = buildCompactRule(movements, buckets, 200000, 0);
    const needs = rule.buckets.find(b => b.id === 'needs')!;
    expect(needs.spent).toBe(60000); // 200 + 150 + 250
    expect(needs.remaining).toBe(40000); // 1,000 - 600
  });

  it('uses savingsNet for the savings bucket with bar floor 0 and neutral phrase when negative', () => {
    const rule = buildCompactRule([], buckets, 300000, -15000);
    const savings = rule.buckets.find(b => b.isSavings)!;

    expect(savings.spent).toBe(-15000);
    expect(savings.negativeSavings).toBe(true);
    expect(savings.barPercent).toBe(0);
    expect(savings.phrase).toBe('Este mes sacaste más de lo que ahorraste');
  });

  it('handles empty buckets gracefully', () => {
    const rule = buildCompactRule([], [], 0, 0);
    expect(rule.hasBuckets).toBe(false);
    expect(rule.buckets).toEqual([]);
  });
});
