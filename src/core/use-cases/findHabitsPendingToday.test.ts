import { describe, expect, it } from 'vitest';
import { findHabitsPendingToday } from './findHabitsPendingToday';
import type { Habit, HabitCompletion } from '../domain/models/types';

const created = new Date(2026, 8, 1, 9);
const habit = (id: string, o: Partial<Habit> = {}): Habit => ({
  id, user_id: 'u', name: `Hábito ${id}`, schedule_mode: 'fixed_days', fixed_days: ['fri'], created_at: created, updated_at: created, ...o,
});
const done = (habitId: string, date: Date): HabitCompletion => ({ id: `c-${habitId}-${date.getTime()}`, habit_id: habitId, date, token_used: false, created_at: date, updated_at: date });

describe('findHabitsPendingToday', () => {
  // Friday 2026-10-16, 22:30 local: already Saturday in UTC when the host is UTC-5.
  const night = new Date(2026, 9, 16, 22, 30);

  it('uses the LOCAL weekday: a Friday habit is pending on Friday night, a Saturday habit is not', () => {
    const result = findHabitsPendingToday([habit('fri'), habit('sat', { fixed_days: ['sat'] })], {}, night);
    expect(result.map(item => item.habitId)).toEqual(['fri']);
  });

  it('skips a habit already completed today, including by a late-evening tap', () => {
    expect(findHabitsPendingToday([habit('fri')], { fri: [done('fri', new Date(2026, 9, 16, 21, 55))] }, night)).toEqual([]);
  });

  it('ignores frequency and deleted habits', () => {
    const habits = [
      habit('freq', { schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 2 }),
      habit('gone', { deleted_at: created }),
    ];
    expect(findHabitsPendingToday(habits, {}, night)).toEqual([]);
  });

  it('reports a token when a 7-day run was earned before today', () => {
    const everyDay = habit('d', { fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], created_at: new Date(2026, 9, 9, 9) });
    const run = [9, 10, 11, 12, 13, 14, 15].map(day => done('d', new Date(2026, 9, day, 20)));
    expect(findHabitsPendingToday([everyDay], { d: run }, night)).toEqual([{ habitId: 'd', habitName: 'Hábito d', hasTokensAvailable: true }]);
  });
});
