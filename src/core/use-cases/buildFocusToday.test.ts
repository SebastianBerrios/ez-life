import { describe, expect, it } from 'vitest';
import { buildFocusToday } from './buildFocusToday';
import type { Habit, HabitCompletion, Task } from '../domain/models/types';

const created = new Date(2026, 8, 1);
const habit = (id: string, o: Partial<Habit> = {}): Habit => ({
  id, user_id: 'u', name: `Hábito ${id}`, schedule_mode: 'fixed_days', fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], created_at: created, updated_at: created, ...o,
});
const completion = (habitId: string, date: Date): HabitCompletion => ({
  id: `c-${habitId}-${date.getTime()}`, habit_id: habitId, date, token_used: false, created_at: created, updated_at: created,
});
const task = (id: string, due: Date, o: Partial<Task> = {}): Task => ({
  id, user_id: 'u', title: `Tarea ${id}`, due_date: due, status: 'pending', created_at: created, updated_at: created, ...o,
});

// Friday 2026-10-16, 21:30 local: already "tomorrow" in UTC when the host is UTC-5.
const today = new Date(2026, 9, 16, 21, 30);
const noon = (day: number) => new Date(2026, 9, day, 12);

describe('buildFocusToday', () => {
  it('lists scheduled habits and tasks due today, skipping others', () => {
    const items = buildFocusToday(
      [habit('a'), habit('off', { fixed_days: ['mon'] })],
      {},
      [task('t1', noon(16)), task('t2', noon(17)), task('t3', noon(15))],
      today,
    );
    expect(items.map(i => `${i.kind}:${i.id}`)).toEqual(['habit:a', 'task:t1']);
  });

  it('orders pending as urgent tasks, habits, other tasks; done items last', () => {
    const items = buildFocusToday(
      [habit('a'), habit('b')],
      { b: [completion('b', new Date(2026, 9, 16, 7, 15))] },
      [
        task('low', noon(16), { priority: 'low' }),
        task('urgent', noon(16), { priority: 'high' }),
        task('finished', noon(16), { status: 'done' }),
        task('mid', noon(16)),
      ],
      today,
    );
    expect(items.map(i => i.id)).toEqual(['urgent', 'a', 'mid', 'low', 'b', 'finished']);
    expect(items.filter(i => i.done).map(i => i.id)).toEqual(['b', 'finished']);
  });

  it('marks a habit done from a local-day completion even for frequency habits and carries streak data', () => {
    const weekly = habit('w', { schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 1 });
    const [item] = buildFocusToday([weekly], { w: [completion('w', new Date(2026, 9, 16, 20, 0))] }, [], today);
    expect(item).toMatchObject({ kind: 'habit', done: true, streakUnit: 'weeks' });
  });

  it('exposes task priority and tag, and a habit streak with its unit', () => {
    const items = buildFocusToday([habit('a')], {}, [task('t', noon(16), { priority: 'high', tag: 'Estudio' })], today);
    expect(items[0]).toMatchObject({ kind: 'task', priority: 'high', tag: 'Estudio' });
    expect(items[1]).toMatchObject({ kind: 'habit', streak: expect.any(Number), streakUnit: 'days' });
  });

  it('ignores deleted habits and tasks, and an empty day yields no items', () => {
    expect(buildFocusToday([habit('a', { deleted_at: created })], {}, [task('t', noon(16), { deleted_at: created })], today)).toEqual([]);
  });

  it('matches a task stored at noon of today regardless of the current time', () => {
    expect(buildFocusToday([], {}, [task('t', noon(16))], new Date(2026, 9, 16, 0, 5))).toHaveLength(1);
    expect(buildFocusToday([], {}, [task('t', noon(16))], new Date(2026, 9, 16, 23, 59))).toHaveLength(1);
  });

  describe('habit streak shown in the list', () => {
    const run = (done: boolean) => {
      // created Mon 12, completed Mon-Wed 12-14 and, when `done`, Fri 16 (Thu 15 skipped on purpose in the second case).
      const created12 = new Date(2026, 9, 12, 9);
      const days = done ? [12, 13, 14, 15, 16] : [12, 13, 14, 15];
      const completions = days.map(day => completion('h', new Date(2026, 9, day, 21, 15))); // evenings: next UTC day on UTC-5
      return buildFocusToday([habit('h', { created_at: created12 })], { h: completions }, [], today)[0];
    };

    it('a pending habit shows the run that today would extend (through yesterday)', () => {
      expect(run(false)).toMatchObject({ done: false, streak: 4, streakUnit: 'days' });
    });

    it('a done habit includes today', () => {
      expect(run(true)).toMatchObject({ done: true, streak: 5 });
    });

    it('a missed scheduled day resets the run', () => {
      const created12 = new Date(2026, 9, 12, 9);
      const completions = [12, 13, 15].map(day => completion('h', new Date(2026, 9, day, 10)));
      const [item] = buildFocusToday([habit('h', { created_at: created12 })], { h: completions }, [], today);
      expect(item.streak).toBe(1);
    });
  });
});
