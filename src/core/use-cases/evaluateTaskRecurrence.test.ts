import { describe, it, expect } from 'vitest';
import { evaluateTaskRecurrence } from './evaluateTaskRecurrence';
import type { Task } from '../domain/models/types';
import { calendarKey } from './calendar';

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
        due_date: new Date(2026, 0, 3, 12), // Saturday
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
    ];

    const today = new Date(2026, 0, 11, 12); // Sunday, after the next Saturday
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      recurrence_series_id: 'series-1',
      due_date: new Date(2026, 0, 10, 12), // next Saturday
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
        due_date: new Date(2026, 0, 1, 12), // Thursday
        schedule_mode: 'frequency',
        frequency_target: 2, // interval of floor(7/2) = 3 days
        recurrence_series_id: 'series-2',
        recurrence_active: true,
      }),
    ];

    const today = new Date(2026, 0, 5, 12);
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      recurrence_series_id: 'series-2',
      due_date: new Date(2026, 0, 4, 12),
      status: 'pending',
      schedule_mode: 'frequency',
      frequency_target: 2,
    });
  });

  it('does not duplicate an occurrence that already exists for the period (FR-003)', () => {
    const tasks: Task[] = [
      baseTask({
        id: 't1',
        due_date: new Date(2026, 0, 3, 12),
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
      baseTask({
        id: 't1-next',
        due_date: new Date(2026, 0, 10, 12), // already generated
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
    ];

    const today = new Date(2026, 0, 11, 12); // next Saturday (17th) not due yet
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(0);
  });

  it('never generates a new occurrence once recurrence_active is false (FR-004)', () => {
    const tasks: Task[] = [
      baseTask({
        id: 't1',
        due_date: new Date(2026, 0, 3, 12),
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: false,
      }),
    ];

    const today = new Date(2026, 0, 11, 12);
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(0);
  });

  it('an edited pattern on the most recent occurrence only affects future generation (FR-005)', () => {
    const tasks: Task[] = [
      // Original occurrence — created with 'sat', now superseded.
      baseTask({
        id: 't1',
        due_date: new Date(2026, 0, 3, 12),
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
      // Most recent occurrence — pattern edited to 'sun'.
      baseTask({
        id: 't1-next',
        due_date: new Date(2026, 0, 10, 12),
        schedule_mode: 'fixed_days',
        fixed_days: ['sun'],
        recurrence_series_id: 'series-1',
        recurrence_active: true,
      }),
    ];

    const today = new Date(2026, 0, 12, 12); // next Sunday after Jan 10
    const result = evaluateTaskRecurrence(tasks, today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      due_date: new Date(2026, 0, 11, 12), // next Sunday, not Saturday
      fixed_days: ['sun'],
    });
  });

  it('ignores non-recurring tasks entirely', () => {
    const tasks: Task[] = [
      baseTask({ id: 't1', due_date: new Date(2020, 0, 1, 12) }),
    ];

    const result = evaluateTaskRecurrence(tasks, new Date(2026, 0, 1, 12));

    expect(result).toHaveLength(0);
  });
  // Local-day semantics (the suite runs under several TZ values: Lima, Tokyo, Auckland, UTC).
  it('keeps the local calendar day: a generated due date is that day at local noon, never the previous day (UTC-5)', () => {
    const [occurrence] = evaluateTaskRecurrence([
      baseTask({ due_date: new Date(2026, 9, 12, 12), schedule_mode: 'fixed_days', fixed_days: ['fri'], recurrence_series_id: 's', recurrence_active: true }),
    ], new Date(2026, 9, 16, 8, 0));
    expect(calendarKey(occurrence.due_date)).toBe('2026-10-16');
    expect(occurrence.due_date).toEqual(new Date(2026, 9, 16, 12));
    expect(occurrence.due_date.getDay()).toBe(5);
  });

  it('is due as soon as its local day starts (not only after the noon instant)', () => {
    const series = [baseTask({ due_date: new Date(2026, 9, 15, 12), schedule_mode: 'frequency', frequency_target: 7, recurrence_series_id: 's', recurrence_active: true })];
    expect(evaluateTaskRecurrence(series, new Date(2026, 9, 16, 0, 5))).toHaveLength(1);
    expect(evaluateTaskRecurrence(series, new Date(2026, 9, 15, 23, 59))).toHaveLength(0);
  });

  it('late evening is still the same day for the next-fixed-day search and the duplicate check', () => {
    const tasks = [
      baseTask({ id: 'a', due_date: new Date(2026, 9, 9, 12), schedule_mode: 'fixed_days', fixed_days: ['fri'], recurrence_series_id: 's', recurrence_active: true }),
      baseTask({ id: 'b', due_date: new Date(2026, 9, 16, 12), schedule_mode: 'fixed_days', fixed_days: ['fri'], recurrence_series_id: 's', recurrence_active: true }),
    ];
    expect(evaluateTaskRecurrence(tasks, new Date(2026, 9, 16, 23, 30))).toHaveLength(0);
    expect(evaluateTaskRecurrence(tasks, new Date(2026, 9, 23, 22, 0))).toHaveLength(1);
  });

  it('carries the priority and the tag to the next occurrence', () => {
    const [occurrence] = evaluateTaskRecurrence([
      baseTask({ due_date: new Date(2026, 9, 12, 12), priority: 'high', tag: 'Casa', schedule_mode: 'frequency', frequency_target: 7, recurrence_series_id: 's', recurrence_active: true }),
    ], new Date(2026, 9, 14, 12));
    expect(occurrence).toMatchObject({ priority: 'high', tag: 'Casa' });
  });
});
