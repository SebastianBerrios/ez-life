import { describe, it, expect } from 'vitest';
import { sortTasksByPriority } from './sortTasksByPriority';
import type { Task } from '../domain/models/types';

const d = (day: number) => new Date(2026, 9, day, 12);
const task = (title: string, due: Date, priority?: Task['priority']): Task => ({
  id: title, user_id: 'u', title, due_date: due, status: 'pending', priority, created_at: d(1), updated_at: d(1),
});

describe('sortTasksByPriority', () => {
  it('orders high > medium > low, with a missing priority treated as medium', () => {
    const result = sortTasksByPriority([
      task('low', d(1), 'low'), task('none', d(1)), task('high', d(1), 'high'), task('medium', d(1), 'medium'),
    ]);
    expect(result.map(t => t.title)).toEqual(['high', 'medium', 'none', 'low']);
  });

  it('breaks priority ties by due date ascending, then by title', () => {
    const result = sortTasksByPriority([
      task('b', d(5), 'high'), task('z', d(2), 'high'), task('a', d(5), 'high'), task('c', d(1), 'low'),
    ]);
    expect(result.map(t => t.title)).toEqual(['z', 'a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = [task('b', d(2), 'low'), task('a', d(1), 'high')];
    const snapshot = [...input];
    sortTasksByPriority(input);
    expect(input).toEqual(snapshot);
  });

  it('returns an empty array for no tasks', () => {
    expect(sortTasksByPriority([])).toEqual([]);
  });
});
