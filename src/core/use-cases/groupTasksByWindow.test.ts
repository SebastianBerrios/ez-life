import { describe, expect, it } from 'vitest';
import { countUrgentTasks, groupTasksByWindow } from './groupTasksByWindow';
import type { Task } from '../domain/models/types';

const created = new Date(2026, 8, 1);
const noon = (day: number, month = 9) => new Date(2026, month, day, 12);
const task = (id: string, due: Date, o: Partial<Task> = {}): Task => ({
  id, user_id: 'u', title: `Tarea ${id}`, due_date: due, status: 'pending', created_at: created, updated_at: created, ...o,
});

// Friday 2026-10-16 22:30 local (already Saturday in UTC when the host is UTC-5); week = Mon 12 .. Sun 18.
const today = new Date(2026, 9, 16, 22, 30);
const ids = (items: { task: Task }[]) => items.map(item => item.task.id);

describe('groupTasksByWindow', () => {
  it('puts tasks due today (also late in the evening) in "today", rest of the week in "week", later beyond Sunday', () => {
    const windows = groupTasksByWindow([
      task('today', noon(16)), task('sat', noon(17)), task('sun', noon(18)), task('mon', noon(19)), task('nov', noon(2, 10)),
    ], today);
    expect(ids(windows.today)).toEqual(['today']);
    expect(ids(windows.week)).toEqual(['sat', 'sun']);
    expect(ids(windows.later)).toEqual(['mon', 'nov']);
    expect(windows.done).toEqual([]);
  });

  it('sends overdue pending tasks to "today", flagged and first (oldest first)', () => {
    const windows = groupTasksByWindow([
      task('today-low', noon(16), { priority: 'low' }), task('late-b', noon(15)), task('late-a', noon(10)), task('today-high', noon(16), { priority: 'high' }),
    ], today);
    expect(ids(windows.today)).toEqual(['late-a', 'late-b', 'today-high', 'today-low']);
    expect(windows.today.map(item => item.overdue)).toEqual([true, true, false, false]);
  });

  it('a task due earlier this week is overdue even though it belongs to the current week', () => {
    const windows = groupTasksByWindow([task('mon', noon(12))], today);
    expect(windows.today).toEqual([{ task: expect.objectContaining({ id: 'mon' }), overdue: true }]);
    expect(windows.week).toEqual([]);
  });

  it('orders a window by day, then priority, then title', () => {
    const windows = groupTasksByWindow([
      task('b', noon(18), { priority: 'low' }), task('a', noon(17), { priority: 'low' }), task('c', noon(17), { priority: 'high' }), task('d', noon(17), { title: 'Aaa' }),
    ], today);
    expect(ids(windows.week)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('done tasks go to "done" by completion time (newest first), whatever their due date; deleted tasks vanish', () => {
    const windows = groupTasksByWindow([
      task('old', noon(1), { status: 'done', done_at: new Date(2026, 9, 2, 9) }),
      task('new', noon(30), { status: 'done', done_at: new Date(2026, 9, 16, 8) }),
      task('gone', noon(16), { deleted_at: created }),
      task('gone-done', noon(16), { status: 'done', deleted_at: created }),
    ], today);
    expect(windows.done.map(t => t.id)).toEqual(['new', 'old']);
    expect(windows.today).toEqual([]);
  });

  it('crosses a month boundary for the end of the week', () => {
    const lateOct = new Date(2026, 9, 29, 21); // Thursday; week ends Sunday Nov 1
    const windows = groupTasksByWindow([task('sun', noon(1, 10)), task('mon', noon(2, 10))], lateOct);
    expect(ids(windows.week)).toEqual(['sun']);
    expect(ids(windows.later)).toEqual(['mon']);
  });

  it('on Sunday the week window is empty and Monday goes to "later"', () => {
    const sunday = new Date(2026, 9, 18, 23, 50);
    const windows = groupTasksByWindow([task('mon', noon(19))], sunday);
    expect(windows.week).toEqual([]);
    expect(ids(windows.later)).toEqual(['mon']);
  });
});

describe('countUrgentTasks', () => {
  it('counts pending high-priority tasks due today or earlier only', () => {
    const tasks = [
      task('a', noon(16), { priority: 'high' }),
      task('b', noon(10), { priority: 'high' }), // overdue counts
      task('c', noon(17), { priority: 'high' }), // tomorrow: no
      task('d', noon(16), { priority: 'medium' }),
      task('e', noon(16), { priority: 'high', status: 'done' }),
      task('f', noon(16), { priority: 'high', deleted_at: created }),
    ];
    expect(countUrgentTasks(tasks, today)).toBe(2);
  });
});
