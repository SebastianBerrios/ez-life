import { describe, it, expect } from 'vitest';
import { calculateHabitCompletionRate } from './calculateHabitCompletionRate';
import type { Habit, HabitCompletion } from '../domain/models/types';
import { parseCalendarDate } from './calendar';

describe('calculateHabitCompletionRate', () => {
  const today = new Date(2026, 8, 17, 22, 0); // 2026-09-17, Thursday evening (already Friday in UTC when UTC-5)

  function completion(date: string): HabitCompletion {
    return { id: date, habit_id: 'h1', date: parseCalendarDate(date), token_used: false, created_at: new Date(), updated_at: new Date() };
  }

  it('gives a non-zero rate even after missing several days (SC-006, non-punitive)', () => {
    const habit: Habit = {
      id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon', 'wed', 'fri'],
      created_at: new Date(2026, 7, 1, 9), updated_at: new Date(),
    };
    // Completed most Mondays/Wednesdays/Fridays in the last 30 days, missed the most recent one.
    const completions = [
      completion('2026-08-17'), completion('2026-08-19'), completion('2026-08-21'),
      completion('2026-08-24'), completion('2026-08-26'), completion('2026-08-28'),
      completion('2026-08-31'), completion('2026-09-02'), completion('2026-09-04'),
      completion('2026-09-07'), completion('2026-09-09'), completion('2026-09-11'),
    ];

    const rate = calculateHabitCompletionRate(habit, completions, today);

    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(100);
  });

  it('returns 100 when every scheduled day in the window was completed', () => {
    const habit: Habit = {
      id: 'h1', user_id: 'u1', name: 'Meditar', schedule_mode: 'fixed_days', fixed_days: ['mon'],
      created_at: new Date(2026, 8, 14, 9), updated_at: new Date(),
    };
    const completions = [completion('2026-09-14')]; // the one Monday in this short window

    const rate = calculateHabitCompletionRate(habit, completions, today);

    expect(rate).toBe(100);
  });

  it('returns 0 when nothing was ever completed', () => {
    const habit: Habit = {
      id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon'],
      created_at: new Date(2026, 7, 1, 9), updated_at: new Date(),
    };

    expect(calculateHabitCompletionRate(habit, [], today)).toBe(0);
  });

  it('computes a rate for frequency-mode habits from total completions vs. expected pace', () => {
    const habit: Habit = {
      id: 'h1', user_id: 'u1', name: 'Gimnasio', schedule_mode: 'frequency', frequency_target: 3,
      created_at: new Date(2026, 7, 18, 9), updated_at: new Date(), // 30 days before `today`
    };
    // ~3x/week for ~4.3 weeks -> expected ~13; provide 6 -> well under 100%, but > 0.
    const completions = [
      completion('2026-08-20'), completion('2026-08-24'), completion('2026-08-28'),
      completion('2026-09-01'), completion('2026-09-05'), completion('2026-09-09'),
    ];

    const rate = calculateHabitCompletionRate(habit, completions, today);

    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(100);
  });
  it('counts a late-evening completion on its own local day (Thursday 22:30 is not Friday)', () => {
    const habit: Habit = {
      id: 'h1', user_id: 'u1', name: 'Meditar', schedule_mode: 'fixed_days', fixed_days: ['thu'],
      created_at: new Date(2026, 8, 17, 9), updated_at: new Date(),
    };
    const lateThursday: HabitCompletion = { id: 'late', habit_id: 'h1', date: new Date(2026, 8, 17, 22, 30), token_used: false, created_at: new Date(), updated_at: new Date() };
    expect(calculateHabitCompletionRate(habit, [lateThursday], today)).toBe(100);
  });

  it('frequency mode: a one-day-old habit and the boundaries of the window use whole local days', () => {
    const habit: Habit = {
      id: 'h1', user_id: 'u1', name: 'Gimnasio', schedule_mode: 'frequency', frequency_target: 7,
      created_at: new Date(2026, 8, 17, 6), updated_at: new Date(),
    };
    const sameDay: HabitCompletion = { id: 'x', habit_id: 'h1', date: new Date(2026, 8, 17, 23, 30), token_used: false, created_at: new Date(), updated_at: new Date() };
    // 1 day of history at 7/week -> 1 expected; 1 done -> 100%.
    expect(calculateHabitCompletionRate(habit, [sameDay], today)).toBe(100);
  });
});
