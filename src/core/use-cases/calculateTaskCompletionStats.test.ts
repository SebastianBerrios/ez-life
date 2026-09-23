import { describe, it, expect } from 'vitest';
import { calculateTaskCompletionStats } from './calculateTaskCompletionStats';
import type { Task } from '../domain/models/types';

function task(overrides: Partial<Task>): Task {
  return {
    id: 't', user_id: 'u1', title: 'Test', due_date: new Date(), status: 'pending',
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  } as Task;
}

describe('calculateTaskCompletionStats', () => {
  const today = new Date('2026-09-22');

  it('counts a done task completed on or before its due date as on time', () => {
    const tasks = [task({ status: 'done', due_date: new Date('2026-09-20'), done_at: new Date('2026-09-19') })];
    expect(calculateTaskCompletionStats(tasks, today)).toEqual({ onTime: 1, overdue: 0, pending: 0 });
  });

  it('counts a pending task whose due date already passed as overdue', () => {
    const tasks = [task({ status: 'pending', due_date: new Date('2026-09-20') })];
    expect(calculateTaskCompletionStats(tasks, today)).toEqual({ onTime: 0, overdue: 1, pending: 0 });
  });

  it('counts a done task completed after its due date as overdue', () => {
    const tasks = [task({ status: 'done', due_date: new Date('2026-09-20'), done_at: new Date('2026-09-21') })];
    expect(calculateTaskCompletionStats(tasks, today)).toEqual({ onTime: 0, overdue: 1, pending: 0 });
  });

  it('counts a pending task whose due date has not arrived yet as pending', () => {
    const tasks = [task({ status: 'pending', due_date: new Date('2026-09-25') })];
    expect(calculateTaskCompletionStats(tasks, today)).toEqual({ onTime: 0, overdue: 0, pending: 1 });
  });

  it('aggregates multiple tasks across all three buckets', () => {
    const tasks = [
      task({ status: 'done', due_date: new Date('2026-09-20'), done_at: new Date('2026-09-19') }),
      task({ status: 'pending', due_date: new Date('2026-09-20') }),
      task({ status: 'pending', due_date: new Date('2026-09-25') }),
    ];
    expect(calculateTaskCompletionStats(tasks, today)).toEqual({ onTime: 1, overdue: 1, pending: 1 });
  });
});
