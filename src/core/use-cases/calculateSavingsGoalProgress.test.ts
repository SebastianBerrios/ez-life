import { describe, it, expect } from 'vitest';
import { calculateSavingsGoalProgress } from './calculateSavingsGoalProgress';
import type { Movement, SavingsGoal } from '../domain/models/types';

describe('calculateSavingsGoalProgress', () => {
  const baseGoal: SavingsGoal = {
    id: 'goal-1',
    user_id: 'user-1',
    name: 'Viaje',
    target_amount: 10000,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const baseMovement = {
    user_id: 'user-1',
    date: new Date(),
    is_recurring: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  it('sums only EXPENSE movements tied to the goal', () => {
    const movements: Movement[] = [
      { ...baseMovement, id: 'm1', type: 'EXPENSE', amount: 3000, savings_goal_id: 'goal-1' },
      { ...baseMovement, id: 'm2', type: 'EXPENSE', amount: 2000, savings_goal_id: 'goal-1' },
      { ...baseMovement, id: 'm3', type: 'EXPENSE', amount: 5000, savings_goal_id: 'other-goal' },
      { ...baseMovement, id: 'm4', type: 'INCOME', amount: 9999, savings_goal_id: 'goal-1' },
    ];

    const result = calculateSavingsGoalProgress(baseGoal, movements);

    expect(result.currentAmountCents).toBe(5000);
    expect(result.percentage).toBe(50);
  });

  it('does not cap the percentage at 100 when the goal is exceeded', () => {
    const movements: Movement[] = [
      { ...baseMovement, id: 'm1', type: 'EXPENSE', amount: 15000, savings_goal_id: 'goal-1' },
    ];

    const result = calculateSavingsGoalProgress(baseGoal, movements);

    expect(result.currentAmountCents).toBe(15000);
    expect(result.percentage).toBe(150);
  });

  it('returns 0 percentage and does not throw when target_amount is 0', () => {
    const zeroTargetGoal: SavingsGoal = { ...baseGoal, target_amount: 0 };
    const movements: Movement[] = [
      { ...baseMovement, id: 'm1', type: 'EXPENSE', amount: 500, savings_goal_id: 'goal-1' },
    ];

    const result = calculateSavingsGoalProgress(zeroTargetGoal, movements);

    expect(result.currentAmountCents).toBe(500);
    expect(result.percentage).toBe(0);
  });

  it('returns 0 for a goal with no matching movements', () => {
    const result = calculateSavingsGoalProgress(baseGoal, []);

    expect(result.currentAmountCents).toBe(0);
    expect(result.percentage).toBe(0);
  });
});
