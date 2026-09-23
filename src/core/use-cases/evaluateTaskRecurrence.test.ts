import { describe, it, expect } from 'vitest';
import { evaluateTaskRecurrence } from './evaluateTaskRecurrence';
import type { Task } from '../domain/models/types';

function baseTask(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    user_id: 'user-1',
    title: 'Sacar la basura',
    due_date: new Date(),
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('evaluateTaskRecurrence', () => {
  it('generates the first next occurrence for a fixed_days series once its due date is reached (FR-001, FR-003)', () => {
    const tasks: Task[] = [
      baseTask({
        id: 't1',
        due_date: new Date(Date.UTC(2026, 0, 3)), // Saturday
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
    ];

    const today = new Date(Date.UTC(2026, 0, 11)); // Sunday, after the next Saturday
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      recurrence_series_id: 'series-1',
      due_date: new Date(Date.UTC(2026, 0, 10)), // next Saturday
      status: 'pending',
      schedule_mode: 'fixed_days',
      fixed_days: ['sat'],
    });
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('created_at');
    expect(result[0]).not.toHaveProperty('updated_at');
  });

  it('generates the first next occurrence for a frequency series once its due date is reached (FR-001, FR-003)', () => {
    const tasks: Task[] = [
      baseTask({
        id: 't2',
        due_date: new Date(Date.UTC(2026, 0, 1)), // Thursday
        schedule_mode: 'frequency',
        frequency_target: 2, // interval of floor(7/2) = 3 days
        recurrence_series_id: 'series-2',
        recurrence_active: true,
      }),
    ];

    const today = new Date(Date.UTC(2026, 0, 5));
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      recurrence_series_id: 'series-2',
      due_date: new Date(Date.UTC(2026, 0, 4)),
      status: 'pending',
      schedule_mode: 'frequency',
      frequency_target: 2,
    });
  });

  it('does not duplicate an occurrence that already exists for the period (FR-003)', () => {
    const tasks: Task[] = [
      baseTask({
        id: 't1',
        due_date: new Date(Date.UTC(2026, 0, 3)),
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
      baseTask({
        id: 't1-next',
        due_date: new Date(Date.UTC(2026, 0, 10)), // already generated
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
    ];

    const today = new Date(Date.UTC(2026, 0, 11)); // next Saturday (17th) not due yet
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(0);
  });

  it('never generates a new occurrence once recurrence_active is false (FR-004)', () => {
    const tasks: Task[] = [
      baseTask({
        id: 't1',
        due_date: new Date(Date.UTC(2026, 0, 3)),
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: false,
      }),
    ];

    const today = new Date(Date.UTC(2026, 0, 11));
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(0);
  });

  it('an edited pattern on the most recent occurrence only affects future generation (FR-005)', () => {
    const tasks: Task[] = [
      // Original occurrence — created with 'sat', now superseded.
      baseTask({
        id: 't1',
        due_date: new Date(Date.UTC(2026, 0, 3)),
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
      // Most recent occurrence — pattern edited to 'sun'.
      baseTask({
        id: 't1-next',
        due_date: new Date(Date.UTC(2026, 0, 10)),
        schedule_mode: 'fixed_days',
        fixed_days: ['sun'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
    ];

    const today = new Date(Date.UTC(2026, 0, 12)); // next Sunday after Jan 10
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      due_date: new Date(Date.UTC(2026, 0, 11)), // next Sunday, not Saturday
      fixed_days: ['sun'],
    });
  });

  it('ignores non-recurring tasks entirely', () => {
    const tasks: Task[] = [
      baseTask({ id: 't1', due_date: new Date(Date.UTC(2020, 0, 1)) }),
    ];

    const result = evaluateTaskRecurrence(tasks, new Date(Date.UTC(2026, 0, 1)));

    expect(result).toHaveLength(0);
  });
});
