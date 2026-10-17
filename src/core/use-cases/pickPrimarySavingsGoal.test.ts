import { describe, expect, it } from 'vitest';
import { pickPrimarySavingsGoal } from './pickPrimarySavingsGoal';
import type { Movement, SavingsGoal } from '../domain/models/types';

const created = new Date(2026, 8, 1);
const goal = (id: string, target: number, o: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id, user_id: 'u', name: id, target_amount: target, created_at: created, updated_at: created, ...o,
});
const saving = (goalId: string, amount: number, o: Partial<Movement> = {}): Movement => ({
  id: `m-${Math.random()}`, user_id: 'u', type: 'EXPENSE', amount, date: new Date(2026, 9, 5), is_recurring: false,
  savings_goal_id: goalId, created_at: created, updated_at: created, ...o,
});
const today = new Date(2026, 9, 16, 21, 0);

describe('pickPrimarySavingsGoal', () => {
  it('returns null without active goals', () => {
    expect(pickPrimarySavingsGoal([], [], today)).toBeNull();
    expect(pickPrimarySavingsGoal([goal('g', 1000, { deleted_at: created })], [], today)).toBeNull();
  });

  it('picks the goal with the highest progress and reports amounts in cents', () => {
    const result = pickPrimarySavingsGoal(
      [goal('a', 100000), goal('b', 10000)],
      [saving('a', 20000), saving('b', 2500)],
      today,
    );
    expect(result?.goal.id).toBe('b');
    expect(result).toMatchObject({ currentAmountCents: 2500, remainingCents: 7500 });
    expect(result?.percentage).toBeCloseTo(25);
  });

  it('skips completed (100% or more) and expired goals', () => {
    const result = pickPrimarySavingsGoal(
      [goal('done', 1000), goal('expired', 1000, { deadline: new Date(2026, 9, 15, 12) }), goal('open', 5000)],
      [saving('done', 1000), saving('expired', 900), saving('open', 100)],
      today,
    );
    expect(result?.goal.id).toBe('open');
  });

  it('keeps a goal whose deadline is today (local day)', () => {
    const result = pickPrimarySavingsGoal([goal('g', 1000, { deadline: new Date(2026, 9, 16, 12) })], [], today);
    expect(result?.goal.id).toBe('g');
  });

  it('ties go to the nearest deadline, goals without deadline last, then by name', () => {
    const goals = [
      goal('none', 1000),
      goal('late', 1000, { deadline: new Date(2026, 11, 1, 12) }),
      goal('soon', 1000, { deadline: new Date(2026, 10, 1, 12) }),
    ];
    expect(pickPrimarySavingsGoal(goals, [], today)?.goal.id).toBe('soon');
    expect(pickPrimarySavingsGoal([goal('b', 1000), goal('a', 1000)], [], today)?.goal.id).toBe('a');
  });

  it('ignores savings contributions that are adjustments or deleted (shared progress rules) and transfers', () => {
    const result = pickPrimarySavingsGoal(
      [goal('g', 1000)],
      [saving('g', 500, { is_adjustment: true }), saving('g', 500, { deleted_at: created }), saving('g', 500, { type: 'INCOME' })],
      today,
    );
    expect(result?.currentAmountCents).toBe(0);
  });
});
