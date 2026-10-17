import { describe, expect, it } from 'vitest';
import { countCompletionsInWeekOf, dayCode, groupCompletionsByDay, habitHistoryStart, habitLast7Days, habitStateOnDay, wasHabitCompletedOnDay } from './habitDay';
import { calendarKey } from './calendar';
import type { Habit, HabitCompletion } from '../domain/models/types';

const created = new Date(2026, 8, 1);
const habit = (o: Partial<Habit>): Habit => ({
  id: 'h', user_id: 'u', name: 'Hábito', schedule_mode: 'fixed_days', fixed_days: ['fri'], created_at: created, updated_at: created, ...o,
});
const completion = (date: Date, o: Partial<HabitCompletion> = {}): HabitCompletion => ({
  id: `c-${Math.random()}`, habit_id: 'h', date, token_used: false, created_at: created, updated_at: created, ...o,
});

// 2026-10-16 is a Friday; the week runs Mon 12 - Sun 18.
const friday = new Date(2026, 9, 16, 21, 30);

describe('wasHabitCompletedOnDay', () => {
  it('compares by local calendar day, also for a late-evening completion (UTC-5 safe)', () => {
    expect(wasHabitCompletedOnDay([completion(new Date(2026, 9, 16, 21, 45))], friday)).toBe(true);
    expect(wasHabitCompletedOnDay([completion(new Date(2026, 9, 16, 21, 45))], new Date(2026, 9, 17, 9))).toBe(false);
  });
  it('ignores soft-deleted completions', () => {
    expect(wasHabitCompletedOnDay([completion(friday, { deleted_at: created })], friday)).toBe(false);
  });
});

describe('habitStateOnDay', () => {
  it('fixed days: scheduled only on its local weekday (even late in the evening)', () => {
    expect(habitStateOnDay(habit({}), [], friday, friday)).toEqual({ scheduled: true, done: false });
    expect(habitStateOnDay(habit({ fixed_days: ['mon'] }), [], friday, friday)).toEqual({ scheduled: false, done: false });
  });

  it('a habit completed on an off day still counts as scheduled that day', () => {
    const state = habitStateOnDay(habit({ fixed_days: ['mon'] }), [completion(friday)], friday, friday);
    expect(state).toEqual({ scheduled: true, done: true });
  });

  it('frequency: scheduled today while the weekly target is unmet', () => {
    const weekly = habit({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 2 });
    expect(habitStateOnDay(weekly, [completion(new Date(2026, 9, 13, 12))], friday, friday).scheduled).toBe(true);
    const met = [completion(new Date(2026, 9, 13, 12)), completion(new Date(2026, 9, 14, 12))];
    expect(habitStateOnDay(weekly, met, friday, friday)).toEqual({ scheduled: false, done: false });
  });

  it('frequency: completions of other weeks do not count towards this week; Sunday evening stays in its week', () => {
    const weekly = habit({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 1 });
    const sundayLastWeek = completion(new Date(2026, 9, 11, 21, 0));
    expect(habitStateOnDay(weekly, [sundayLastWeek], friday, friday).scheduled).toBe(true);
  });

  it('frequency: past and future days are scheduled only when completed', () => {
    const weekly = habit({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 3 });
    const wednesday = new Date(2026, 9, 14);
    expect(habitStateOnDay(weekly, [], wednesday, friday).scheduled).toBe(false);
    expect(habitStateOnDay(weekly, [completion(new Date(2026, 9, 14, 8))], wednesday, friday)).toEqual({ scheduled: true, done: true });
    expect(habitStateOnDay(weekly, [], new Date(2026, 9, 18), friday).scheduled).toBe(false);
  });
});

describe('habitStateOnDay before the creation day', () => {
  it('a day before the habit existed is not scheduled (no phantom misses), unless something was completed', () => {
    const fresh = habit({ fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], created_at: new Date(2026, 9, 16, 9) });
    expect(habitStateOnDay(fresh, [], new Date(2026, 9, 14), friday)).toEqual({ scheduled: false, done: false });
    expect(habitStateOnDay(fresh, [], new Date(2026, 9, 16, 1), friday)).toEqual({ scheduled: true, done: false });
    expect(habitStateOnDay(fresh, [completion(new Date(2026, 9, 14, 12))], new Date(2026, 9, 14), friday)).toEqual({ scheduled: true, done: true });
  });
});

describe('dayCode / countCompletionsInWeekOf / groupCompletionsByDay / habitHistoryStart', () => {
  it('dayCode is the LOCAL weekday at every hour', () => {
    for (const hour of [0, 3, 12, 20, 23]) expect(dayCode(new Date(2026, 9, 16, hour))).toBe('fri');
    expect(dayCode(new Date(2026, 9, 18, 23, 59))).toBe('sun');
    expect(dayCode(new Date(2026, 9, 19, 0, 1))).toBe('mon');
  });

  it('counts completions in the Monday-Sunday week of the given day, boundaries included', () => {
    const list = [
      completion(new Date(2026, 9, 11, 23, 59)), // Sunday of the previous week
      completion(new Date(2026, 9, 12, 0, 0)), // Monday 00:00
      completion(new Date(2026, 9, 18, 23, 59)), // Sunday 23:59
      completion(new Date(2026, 9, 19, 0, 0)), // next Monday
      completion(new Date(2026, 9, 14, 9), { deleted_at: created }), // deleted: ignored
    ];
    expect(countCompletionsInWeekOf(list, friday)).toBe(2);
  });

  it('groups non-deleted completions by local day key', () => {
    const grouped = groupCompletionsByDay([completion(new Date(2026, 9, 16, 21)), completion(new Date(2026, 9, 16, 8)), completion(new Date(2026, 9, 17, 0, 5)), completion(friday, { deleted_at: created })]);
    expect([...grouped.keys()].sort()).toEqual(['2026-10-16', '2026-10-17']);
    expect(grouped.get('2026-10-16')).toHaveLength(2);
  });

  it('the history starts at the creation day or an earlier completion', () => {
    expect(calendarKey(habitHistoryStart(habit({ created_at: new Date(2026, 9, 5, 22) }), []))).toBe('2026-10-05');
    expect(calendarKey(habitHistoryStart(habit({ created_at: new Date(2026, 9, 5, 22) }), [completion(new Date(2026, 9, 1, 8))]))).toBe('2026-10-01');
  });
});

describe('habitLast7Days', () => {
  it('returns the 7 local days ending today, oldest first, with scheduled/done', () => {
    const everyOther = habit({ fixed_days: ['mon', 'wed', 'fri'] });
    const cells = habitLast7Days(everyOther, [completion(new Date(2026, 9, 14, 22, 30)), completion(new Date(2026, 9, 16, 21))], friday);
    expect(cells.map(c => calendarKey(c.date))).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    expect(cells.map(c => c.scheduled)).toEqual([false, false, true, false, true, false, true]);
    expect(cells.map(c => c.done)).toEqual([false, false, false, false, true, false, true]);
  });

  it('frequency habits are scheduled only on days they were done (and today while the week target is open)', () => {
    const weekly = habit({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 3 });
    const cells = habitLast7Days(weekly, [completion(new Date(2026, 9, 13, 8))], friday);
    expect(cells.filter(c => c.scheduled).map(c => calendarKey(c.date))).toEqual(['2026-10-13', '2026-10-16']);
    expect(cells[6]).toMatchObject({ scheduled: true, done: false });
  });

  it('crosses a month boundary', () => {
    const cells = habitLast7Days(habit({ fixed_days: ['sun'] }), [], new Date(2026, 10, 2, 22));
    expect(calendarKey(cells[0].date)).toBe('2026-10-27');
    expect(calendarKey(cells[6].date)).toBe('2026-11-02');
  });
});
