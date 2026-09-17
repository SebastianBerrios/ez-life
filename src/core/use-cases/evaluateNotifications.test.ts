import { describe, it, expect } from 'vitest';
import { evaluateNotifications } from './evaluateNotifications';
import type { BudgetedCategory } from './calculateBudgets';
import type { Notification, SavingsGoal } from '../domain/models/types';

describe('evaluateNotifications', () => {
  const userId = 'user-1';
  const now = new Date(2024, 5, 15, 20, 0, 0); // June 15, 2024, 20:00

  const baseBucket = {
    user_id: userId,
    is_default: true,
    is_savings: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  function makeBucket(overrides: Partial<BudgetedCategory>): BudgetedCategory {
    return {
      ...baseBucket,
      id: 'bucket-1',
      name: 'Necesidades',
      percentage: 50,
      budget: 10000,
      ...overrides,
    };
  }

  const baseGoal: SavingsGoal = {
    id: 'goal-1',
    user_id: userId,
    name: 'Viaje',
    target_amount: 10000,
    created_at: new Date(),
    updated_at: new Date(),
  };

  function baseParams(overrides: Partial<Parameters<typeof evaluateNotifications>[0]> = {}) {
    return {
      userId,
      now,
      budgetedCategories: [],
      spentByBucketId: {},
      savingsGoals: [],
      notificationHour: undefined,
      existingNotifications: [] as Notification[],
      ...overrides,
    };
  }

  describe('budget_over_80', () => {
    it('fires when spend crosses 80% of the bucket budget', () => {
      const bucket = makeBucket({ id: 'bucket-1', budget: 10000 });
      const result = evaluateNotifications(baseParams({
        budgetedCategories: [bucket],
        spentByBucketId: { 'bucket-1': 8000 },
      }));

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('budget_over_80');
      expect(result[0].related_id).toBe('bucket-1');
      expect(result[0].cycle_key).toBe('2024-06');
      expect(result[0].body).toContain('Necesidades');
    });

    it('does not fire below 80%', () => {
      const bucket = makeBucket({ id: 'bucket-1', budget: 10000 });
      const result = evaluateNotifications(baseParams({
        budgetedCategories: [bucket],
        spentByBucketId: { 'bucket-1': 7999 },
      }));

      expect(result).toHaveLength(0);
    });

    it('does not duplicate an existing budget_over_80 for the same bucket and month', () => {
      const bucket = makeBucket({ id: 'bucket-1', budget: 10000 });
      const existing: Notification = {
        id: 'n1',
        user_id: userId,
        type: 'budget_over_80',
        title: 't',
        body: 'b',
        related_id: 'bucket-1',
        cycle_key: '2024-06',
        created_at: now,
        updated_at: now,
      };

      const result = evaluateNotifications(baseParams({
        budgetedCategories: [bucket],
        spentByBucketId: { 'bucket-1': 9000 },
        existingNotifications: [existing],
      }));

      expect(result).toHaveLength(0);
    });

    it('re-fires in a new month even if it already fired last month', () => {
      const bucket = makeBucket({ id: 'bucket-1', budget: 10000 });
      const existing: Notification = {
        id: 'n1',
        user_id: userId,
        type: 'budget_over_80',
        title: 't',
        body: 'b',
        related_id: 'bucket-1',
        cycle_key: '2024-05',
        created_at: now,
        updated_at: now,
      };

      const result = evaluateNotifications(baseParams({
        budgetedCategories: [bucket],
        spentByBucketId: { 'bucket-1': 9000 },
        existingNotifications: [existing],
      }));

      expect(result).toHaveLength(1);
      expect(result[0].cycle_key).toBe('2024-06');
    });

    it('does not throw or divide by zero when budget is 0', () => {
      const bucket = makeBucket({ id: 'bucket-1', budget: 0 });

      expect(() => evaluateNotifications(baseParams({
        budgetedCategories: [bucket],
        spentByBucketId: { 'bucket-1': 500 },
      }))).not.toThrow();

      const result = evaluateNotifications(baseParams({
        budgetedCategories: [bucket],
        spentByBucketId: { 'bucket-1': 500 },
      }));
      expect(result).toHaveLength(0);
    });
  });

  describe('goal_completed', () => {
    it('fires when a goal reaches 100% of its target', () => {
      const result = evaluateNotifications(baseParams({
        savingsGoals: [{ goal: baseGoal, currentAmountCents: 10000 }],
      }));

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('goal_completed');
      expect(result[0].related_id).toBe('goal-1');
      expect(result[0].cycle_key).toBeUndefined();
      expect(result[0].body).toContain('Viaje');
    });

    it('fires when a goal exceeds its target', () => {
      const result = evaluateNotifications(baseParams({
        savingsGoals: [{ goal: baseGoal, currentAmountCents: 15000 }],
      }));

      expect(result).toHaveLength(1);
    });

    it('does not fire below 100%', () => {
      const result = evaluateNotifications(baseParams({
        savingsGoals: [{ goal: baseGoal, currentAmountCents: 9999 }],
      }));

      expect(result).toHaveLength(0);
    });

    it('does not duplicate an existing goal_completed for the same goal, regardless of cycle', () => {
      const existing: Notification = {
        id: 'n1',
        user_id: userId,
        type: 'goal_completed',
        title: 't',
        body: 'b',
        related_id: 'goal-1',
        cycle_key: undefined,
        created_at: now,
        updated_at: now,
      };

      const result = evaluateNotifications(baseParams({
        savingsGoals: [{ goal: baseGoal, currentAmountCents: 20000 }],
        existingNotifications: [existing],
      }));

      expect(result).toHaveLength(0);
    });
  });

  describe('daily_reminder', () => {
    it('fires once notificationHour has passed', () => {
      const result = evaluateNotifications(baseParams({
        notificationHour: 19,
      }));

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('daily_reminder');
      expect(result[0].related_id).toBeUndefined();
      expect(result[0].cycle_key).toBe('2024-06-15');
    });

    it('does not fire before the configured hour', () => {
      const result = evaluateNotifications(baseParams({
        notificationHour: 21,
      }));

      expect(result).toHaveLength(0);
    });

    it('does not fire when notificationHour is undefined', () => {
      const result = evaluateNotifications(baseParams({
        notificationHour: undefined,
      }));

      expect(result).toHaveLength(0);
    });

    it('does not duplicate an existing daily_reminder for the same day', () => {
      const existing: Notification = {
        id: 'n1',
        user_id: userId,
        type: 'daily_reminder',
        title: 't',
        body: 'b',
        related_id: undefined,
        cycle_key: '2024-06-15',
        created_at: now,
        updated_at: now,
      };

      const result = evaluateNotifications(baseParams({
        notificationHour: 8,
        existingNotifications: [existing],
      }));

      expect(result).toHaveLength(0);
    });
  });

  it('evaluates all three types together in one call', () => {
    const bucket = makeBucket({ id: 'bucket-1', budget: 10000 });
    const result = evaluateNotifications(baseParams({
      budgetedCategories: [bucket],
      spentByBucketId: { 'bucket-1': 9000 },
      savingsGoals: [{ goal: baseGoal, currentAmountCents: 10000 }],
      notificationHour: 10,
    }));

    expect(result).toHaveLength(3);
    expect(result.map(n => n.type).sort()).toEqual(['budget_over_80', 'daily_reminder', 'goal_completed']);
  });
});
