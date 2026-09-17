import { describe, it, expect } from 'vitest';
import { evaluateNotifications } from './evaluateNotifications';
import type { BudgetedCategory } from './calculateBudgets';
import type { Debt, Goal, Notification, SavingsGoal, SharedMovement, Task } from '../domain/models/types';
import type { HabitPendingToday } from './evaluateNotifications';

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
      debts: [] as Debt[],
      sharedMovements: [] as SharedMovement[],
      habitsPendingToday: [] as HabitPendingToday[],
      goals: [] as Goal[],
      tasks: [] as Task[],
      notificationHour: undefined,
      existingNotifications: [] as Notification[],
      ...overrides,
    };
  }

  function makeDebt(overrides: Partial<Debt>): Debt {
    return {
      id: 'debt-1',
      user_id: userId,
      counterparty_name: 'Juan',
      direction: 'lent',
      origin: 'manual',
      amount: 10000,
      settled_amount: 0,
      created_at: new Date(),
      updated_at: new Date(),
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

  describe('loan_due_soon', () => {
    it('fires when the due date is within the reminder window and the debt is not fully settled', () => {
      const debt = makeDebt({ due_date: new Date(2024, 5, 17) }); // 2 days out
      const result = evaluateNotifications(baseParams({ debts: [debt] }));

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('loan_due_soon');
      expect(result[0].related_id).toBe('debt-1');
      expect(result[0].cycle_key).toBe('2024-06-15');
      expect(result[0].body).toContain('Juan');
    });

    it('fires on the due date itself', () => {
      const debt = makeDebt({ due_date: new Date(2024, 5, 15) });
      const result = evaluateNotifications(baseParams({ debts: [debt] }));

      expect(result).toHaveLength(1);
    });

    it('does not fire when the due date is further away than the reminder window', () => {
      const debt = makeDebt({ due_date: new Date(2024, 5, 25) });
      const result = evaluateNotifications(baseParams({ debts: [debt] }));

      expect(result).toHaveLength(0);
    });

    it('does not fire once the due date has already passed', () => {
      const debt = makeDebt({ due_date: new Date(2024, 5, 10) });
      const result = evaluateNotifications(baseParams({ debts: [debt] }));

      expect(result).toHaveLength(0);
    });

    it('does not fire for a debt without a due date', () => {
      const debt = makeDebt({ due_date: undefined });
      const result = evaluateNotifications(baseParams({ debts: [debt] }));

      expect(result).toHaveLength(0);
    });

    it('does not fire for a debt that is already fully settled (Principio X)', () => {
      const debt = makeDebt({ due_date: new Date(2024, 5, 16), amount: 10000, settled_amount: 10000 });
      const result = evaluateNotifications(baseParams({ debts: [debt] }));

      expect(result).toHaveLength(0);
    });

    it('does not duplicate an existing loan_due_soon for the same debt and day', () => {
      const debt = makeDebt({ due_date: new Date(2024, 5, 16) });
      const existing: Notification = {
        id: 'n1',
        user_id: userId,
        type: 'loan_due_soon',
        title: 't',
        body: 'b',
        related_id: 'debt-1',
        cycle_key: '2024-06-15',
        created_at: now,
        updated_at: now,
      };

      const result = evaluateNotifications(baseParams({ debts: [debt], existingNotifications: [existing] }));

      expect(result).toHaveLength(0);
    });
  });

  describe('shared_movement_added', () => {
    const baseSharedMovement: SharedMovement = {
      id: 'sm-1', shared_space_id: 'space-1', created_by: 'other-user', type: 'expense',
      total_amount_cents: 10000, split_mode: 'percentage',
      splits: [{ user_id: userId, share_cents: 5000 }], linked_movement_ids: [],
      date: new Date(), created_at: new Date(), updated_at: new Date(),
    };

    it('fires when another member registered a shared movement while I was away', () => {
      const result = evaluateNotifications(baseParams({ sharedMovements: [baseSharedMovement] }));

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('shared_movement_added');
      expect(result[0].related_id).toBe('sm-1');
    });

    it('does not fire for a shared movement I registered myself', () => {
      const own = { ...baseSharedMovement, created_by: userId };
      const result = evaluateNotifications(baseParams({ sharedMovements: [own] }));

      expect(result).toHaveLength(0);
    });

    it('does not duplicate an existing notification for the same shared movement', () => {
      const existing: Notification = {
        id: 'n1', user_id: userId, type: 'shared_movement_added', title: 't', body: 'b',
        related_id: 'sm-1', cycle_key: undefined, created_at: now, updated_at: now,
      };

      const result = evaluateNotifications(baseParams({
        sharedMovements: [baseSharedMovement], existingNotifications: [existing],
      }));

      expect(result).toHaveLength(0);
    });
  });

  describe('habit_reminder / streak_at_risk', () => {
    it('fires habit_reminder for a pending habit that still has a token available (FR-022)', () => {
      const result = evaluateNotifications(baseParams({
        notificationHour: 10,
        habitsPendingToday: [{ habitId: 'h1', habitName: 'Correr', hasTokensAvailable: true }],
      }));

      expect(result.some(n => n.type === 'habit_reminder' && n.related_id === 'h1')).toBe(true);
      expect(result.some(n => n.type === 'streak_at_risk')).toBe(false);
    });

    it('fires streak_at_risk instead when the habit has no token left to fall back on', () => {
      const result = evaluateNotifications(baseParams({
        notificationHour: 10,
        habitsPendingToday: [{ habitId: 'h1', habitName: 'Correr', hasTokensAvailable: false }],
      }));

      expect(result.some(n => n.type === 'streak_at_risk' && n.related_id === 'h1')).toBe(true);
      expect(result.some(n => n.type === 'habit_reminder')).toBe(false);
    });

    it('does not fire before the configured notification hour', () => {
      const result = evaluateNotifications(baseParams({
        notificationHour: 21,
        habitsPendingToday: [{ habitId: 'h1', habitName: 'Correr', hasTokensAvailable: false }],
      }));

      expect(result).toHaveLength(0);
    });

    it('does not duplicate a habit notification already sent today', () => {
      const existing: Notification = {
        id: 'n1', user_id: userId, type: 'streak_at_risk', title: 't', body: 'b',
        related_id: 'h1', cycle_key: '2024-06-15', created_at: now, updated_at: now,
      };

      const result = evaluateNotifications(baseParams({
        notificationHour: 10,
        habitsPendingToday: [{ habitId: 'h1', habitName: 'Correr', hasTokensAvailable: false }],
        existingNotifications: [existing],
      }));

      expect(result.some(n => n.related_id === 'h1')).toBe(false);
    });
  });

  describe('goal_completed (generic Goal, FR-020)', () => {
    it('fires when a numeric goal reaches its target', () => {
      const goal: Goal = {
        id: 'goal-x', user_id: userId, name: 'Correr 100km', kind: 'numeric',
        target_value: 100, current_value: 100, status: 'active',
        created_at: new Date(), updated_at: new Date(),
      };

      const result = evaluateNotifications(baseParams({ goals: [goal] }));

      expect(result.some(n => n.type === 'goal_completed' && n.related_id === 'goal-x')).toBe(true);
    });

    it('does not fire for an incomplete checklist goal', () => {
      const goal: Goal = {
        id: 'goal-y', user_id: userId, name: 'Aprender React', kind: 'checklist',
        milestones: [{ id: 'm1', label: 'Fundamentos', done: false }], status: 'active',
        created_at: new Date(), updated_at: new Date(),
      };

      const result = evaluateNotifications(baseParams({ goals: [goal] }));

      expect(result.some(n => n.related_id === 'goal-y')).toBe(false);
    });
  });

  describe('task_due', () => {
    const baseTask: Task = {
      id: 'task-1', user_id: userId, title: 'Pagar alquiler', status: 'pending',
      due_date: new Date(2024, 5, 16), created_at: new Date(), updated_at: new Date(),
    };

    it('fires when a pending task is due within the reminder window', () => {
      const result = evaluateNotifications(baseParams({ tasks: [baseTask] }));

      expect(result.some(n => n.type === 'task_due' && n.related_id === 'task-1')).toBe(true);
    });

    it('does not fire for a task already marked done', () => {
      const doneTask: Task = { ...baseTask, status: 'done' };
      const result = evaluateNotifications(baseParams({ tasks: [doneTask] }));

      expect(result.some(n => n.type === 'task_due')).toBe(false);
    });

    it('does not fire once the due date has passed', () => {
      const overdueTask: Task = { ...baseTask, due_date: new Date(2024, 5, 1) };
      const result = evaluateNotifications(baseParams({ tasks: [overdueTask] }));

      expect(result.some(n => n.type === 'task_due')).toBe(false);
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
