import { beforeEach, describe, it, expect } from 'vitest';
import { db } from '../../db/db';
import { LocalOnboardingRepository } from './LocalOnboardingRepository';
import { calculateAvailableCapital } from '../../../core/use-cases/calculateAvailableCapital';
import { calculateBudgets } from '../../../core/use-cases/calculateBudgets';
import { parseCurrentBalance } from '../../../core/use-cases/parseCurrentBalance';
import { parseMoney } from '../../../core/use-cases/parseMoney';

describe('onboarding starting balance (FR-004, FR-006)', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });

  it('feeds "Capital disponible" with the current balance but budgets with the full salary', async () => {
    await new LocalOnboardingRepository().saveStartingPoint('A', {
      income: parseMoney('3000'), openingBalance: parseCurrentBalance('800'),
    });
    const accounts = await db.payment_accounts.where('user_id').equals('A').toArray();
    const sources = await db.income_sources.where('user_id').equals('A').toArray();
    const totalIncome = sources.reduce((sum, source) => sum + source.amount, 0);

    expect(calculateAvailableCapital(accounts, [])).toBe(80000);
    const bucket = (id: string, percentage: number, is_savings = false) =>
      ({ id, user_id: 'A', name: id, percentage, is_default: true, is_savings, created_at: new Date(), updated_at: new Date() });
    const budgets = calculateBudgets(totalIncome, [bucket('needs', 50), bucket('wants', 30), bucket('savings', 20, true)]);
    // Budgets follow the salary (S/ 3,000), never the S/ 800 the user holds today.
    expect(budgets.map(row => row.budget)).toEqual([150000, 90000, 60000]);
  });

  it('shows zero available capital when the user leaves the balance empty', async () => {
    await new LocalOnboardingRepository().saveStartingPoint('A', {
      income: parseMoney('3000'), openingBalance: parseCurrentBalance(''),
    });
    const accounts = await db.payment_accounts.where('user_id').equals('A').toArray();
    expect(calculateAvailableCapital(accounts, [])).toBe(0);
  });
});
