import { describe, expect, it } from 'vitest';
import { buildHabitStreak, currentHabitStreak } from './buildHabitStreak';
import type { Habit, HabitCompletion } from '../domain/models/types';

// Local-component dates only (the suite runs under several TZ values).
const habit = (o: Partial<Habit>): Habit => ({
  id: 'h', user_id: 'u', name: 'Hábito', schedule_mode: 'fixed_days', fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  created_at: new Date(2026, 9, 12, 9), updated_at: new Date(), ...o,
});
const done = (day: number, hour = 12): HabitCompletion => {
  const date = new Date(2026, 9, day, hour);
  return { id: `c-${day}-${hour}`, habit_id: 'h', date, token_used: false, created_at: date, updated_at: date };
};

describe('buildHabitStreak', () => {
  const friday = new Date(2026, 9, 16, 12);

  it('fixed days: counts consecutive scheduled days and flags today as completed', () => {
    const info = buildHabitStreak(habit({}), [done(12), done(13), done(14), done(15), done(16)], friday);
    expect(info).toMatchObject({ streak: 5, unit: 'days', completedToday: true, scheduledToday: true });
  });

  it('fixed days: a missed scheduled day resets the streak and today is not completed', () => {
    const info = buildHabitStreak(habit({}), [done(12), done(14), done(15)], friday);
    expect(info).toMatchObject({ streak: 0, unit: 'days', completedToday: false });
  });

  it('fixed days: not scheduled on a weekday outside fixed_days', () => {
    expect(buildHabitStreak(habit({ fixed_days: ['mon'] }), [], friday).scheduledToday).toBe(false);
  });

  it('fixed days: completedToday reflects a completion TODAY even when today is not a scheduled day', () => {
    // Friday, habit scheduled only on Monday: the previous scheduled day (Monday) was done, today is an extra.
    const info = buildHabitStreak(habit({ fixed_days: ['mon'] }), [done(12), done(16)], friday);
    expect(info.completedToday).toBe(true);
    const without = buildHabitStreak(habit({ fixed_days: ['mon'] }), [done(12)], friday);
    expect(without.completedToday).toBe(false);
  });

  describe('late evening (UTC-5 safe: the UTC date is already tomorrow)', () => {
    const night = new Date(2026, 9, 16, 22, 30);
    it('keeps today as Friday: scheduled, completed by a 21:50 tap, streak intact', () => {
      const info = buildHabitStreak(habit({ fixed_days: ['fri'], created_at: new Date(2026, 9, 2, 9) }), [done(2, 8), done(9, 8), done(16, 21)], night);
      expect(info).toMatchObject({ streak: 3, completedToday: true, scheduledToday: true });
    });
    it('a habit scheduled only on Saturday is NOT scheduled on Friday night', () => {
      expect(buildHabitStreak(habit({ fixed_days: ['sat'] }), [], night).scheduledToday).toBe(false);
    });
  });

  describe('frequency: consecutive full Monday-Sunday weeks that met the target', () => {
    const weekly = (target: number, created = new Date(2026, 8, 28, 9)) =>
      habit({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: target, created_at: created });
    const sept = (day: number): HabitCompletion => ({ ...done(day), date: new Date(2026, 8, day, 12) });

    it('counts weeks in a row and ignores the open current week while below target', () => {
      // Weeks 09-28 and 10-05 met (2 each), current week (10-12) has 1 of 2 so far.
      const completions = [sept(29), sept(30), done(6), done(7), done(13)];
      const info = buildHabitStreak(weekly(2), completions, friday);
      expect(info).toMatchObject({ streak: 2, unit: 'weeks', completedToday: false, scheduledToday: true });
    });

    it('adds the current week once its target is met', () => {
      const completions = [sept(29), sept(30), done(6), done(7), done(13), done(14)];
      expect(buildHabitStreak(weekly(2), completions, friday).streak).toBe(3);
    });

    it('a full week below target resets the streak', () => {
      // Week 10-05 had only one completion of 2.
      const completions = [sept(29), sept(30), done(6), done(13), done(14)];
      expect(buildHabitStreak(weekly(2), completions, friday).streak).toBe(1);
    });

    it('completedToday / scheduledToday for a frequency habit', () => {
      const met = [done(13), done(16, 21)];
      const info = buildHabitStreak(weekly(2, new Date(2026, 9, 12, 9)), met, new Date(2026, 9, 16, 22, 30));
      // Done today as the 2nd of 2: still listed today (so it shows as completed), not hidden.
      expect(info).toMatchObject({ completedToday: true, scheduledToday: true, streak: 1 });
      const early = buildHabitStreak(weekly(2, new Date(2026, 9, 12, 9)), [done(13), done(14)], friday);
      expect(early).toMatchObject({ completedToday: false, scheduledToday: false });
    });

    it('defaults the target to 1', () => {
      const w = habit({ schedule_mode: 'frequency', fixed_days: undefined, created_at: new Date(2026, 9, 12, 9) });
      expect(buildHabitStreak(w, [done(14)], friday).streak).toBe(1);
    });

    it('a Sunday-night completion belongs to the week that ends that Sunday', () => {
      // Created Mon 10-05; done Sunday 10-11 at 23:30 (last week), nothing this week yet (Monday morning).
      const monday = new Date(2026, 9, 12, 8, 0);
      const w = weekly(1, new Date(2026, 9, 5, 9));
      expect(buildHabitStreak(w, [done(11, 23)], monday)).toMatchObject({ streak: 1, scheduledToday: true, completedToday: false });
    });
  });
});

describe('currentHabitStreak (the streak to display)', () => {
  const friday = new Date(2026, 9, 16, 12);

  it('a fixed-days habit still open today shows the run through yesterday instead of 0', () => {
    const completions = [done(12), done(13), done(14), done(15)];
    expect(buildHabitStreak(habit({}), completions, friday).streak).toBe(0);
    expect(currentHabitStreak(habit({}), completions, friday)).toMatchObject({ streak: 4, completedToday: false });
  });

  it('once today is done the streak includes it', () => {
    expect(currentHabitStreak(habit({}), [done(12), done(13), done(14), done(15), done(16)], friday).streak).toBe(5);
  });

  it('frequency habits need no shift', () => {
    const w = habit({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 1, created_at: new Date(2026, 9, 5, 9) });
    expect(currentHabitStreak(w, [done(6)], friday).streak).toBe(1);
  });
});
