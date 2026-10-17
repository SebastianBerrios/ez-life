import { describe, expect, it } from 'vitest';
import { calculateWeeklyPerformance, summarizeWeek, type DayPerformance } from './calculateWeeklyPerformance';
import { calendarKey } from './calendar';
import type { Habit, HabitCompletion, Task } from '../domain/models/types';

const created = new Date(2026, 8, 1);
const habit = (id: string, o: Partial<Habit> = {}): Habit => ({
  id, user_id: 'u', name: id, schedule_mode: 'fixed_days', fixed_days: ['mon', 'wed', 'fri'], created_at: created, updated_at: created, ...o,
});
const completion = (habitId: string, date: Date): HabitCompletion => ({
  id: `c-${habitId}-${date.getTime()}`, habit_id: habitId, date, token_used: false, created_at: created, updated_at: created,
});
const task = (id: string, due: Date, o: Partial<Task> = {}): Task => ({
  id, user_id: 'u', title: id, due_date: due, status: 'pending', created_at: created, updated_at: created, ...o,
});

// Week of Mon 2026-10-12 .. Sun 2026-10-18; "today" is Friday the 16th, 21:30 local.
const today = new Date(2026, 9, 16, 21, 30);
const monday = new Date(2026, 9, 12);

describe('calculateWeeklyPerformance', () => {
  it('returns 7 local days Monday to Sunday starting from any date inside the week', () => {
    for (const anyDay of [new Date(2026, 9, 12), new Date(2026, 9, 14, 15), new Date(2026, 9, 18, 23, 59)]) {
      const week = calculateWeeklyPerformance([], {}, [], anyDay, today);
      expect(week.map(d => calendarKey(d.date))).toEqual([
        '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
      ]);
    }
  });

  it('flags today and future days', () => {
    const week = calculateWeeklyPerformance([], {}, [], monday, today);
    expect(week.map(d => d.isToday)).toEqual([false, false, false, false, true, false, false]);
    expect(week.map(d => d.isFuture)).toEqual([false, false, false, false, false, true, true]);
  });

  it('counts fixed-day habits on their weekdays and tasks on their due day', () => {
    const week = calculateWeeklyPerformance(
      [habit('h')],
      { h: [completion('h', new Date(2026, 9, 12, 8)), completion('h', new Date(2026, 9, 14, 22, 15))] },
      [task('t1', new Date(2026, 9, 14, 12), { status: 'done' }), task('t2', new Date(2026, 9, 14, 12)), task('t3', new Date(2026, 9, 16, 12))],
      monday,
      today,
    );
    expect(week.map(d => [d.done, d.scheduled])).toEqual([
      [1, 1], // Mon: habit done
      [0, 0], // Tue
      [2, 3], // Wed: habit done (22:15 stays on Wednesday) + 1 of 2 tasks
      [0, 0], // Thu
      [0, 2], // Fri (today): habit pending + task pending
      [0, 0], // Sat
      [0, 0], // Sun
    ]);
  });

  it('keeps future days at done = 0 but still shows what is scheduled for them', () => {
    const week = calculateWeeklyPerformance([], {}, [task('t', new Date(2026, 9, 17, 12), { status: 'done' })], monday, today);
    expect(week[5]).toMatchObject({ isFuture: true, done: 0, scheduled: 1 });
  });

  it('ignores deleted habits/tasks and handles a week boundary crossing a month', () => {
    const week = calculateWeeklyPerformance(
      [habit('gone', { deleted_at: created })],
      {},
      [task('x', new Date(2026, 10, 1, 12), { deleted_at: created }), task('y', new Date(2026, 10, 1, 12))],
      new Date(2026, 9, 28),
      new Date(2026, 10, 3),
    );
    expect(week.map(d => calendarKey(d.date))[0]).toBe('2026-10-26');
    expect(week[6]).toMatchObject({ scheduled: 1, done: 0 });
    expect(calendarKey(week[6].date)).toBe('2026-11-01');
  });
});

describe('summarizeWeek', () => {
  const day = (done: number, scheduled: number, isFuture = false): DayPerformance => ({ date: new Date(2026, 9, 12), done, scheduled, isToday: false, isFuture });

  it('adds up the elapsed days and ignores the future ones', () => {
    expect(summarizeWeek([day(3, 4), day(1, 2), day(0, 5, true)])).toEqual({ done: 4, scheduled: 6, pct: 67 });
  });
  it('has no percentage when nothing was scheduled so far', () => {
    expect(summarizeWeek([day(0, 0), day(0, 3, true)])).toEqual({ done: 0, scheduled: 0, pct: null });
  });
});
