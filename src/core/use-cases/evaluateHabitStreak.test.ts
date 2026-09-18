import { describe, it, expect } from 'vitest';
import { buildFixedDaysLog, evaluateFixedDaysStreak, evaluateFrequencyStreak, isHabitScheduledToday, HabitDayResult, HabitWeekResult } from './evaluateHabitStreak';
import type { Habit, HabitCompletion } from '../domain/models/types';

describe('evaluateFixedDaysStreak', () => {
  function day(completed: boolean, tokenUsed = false): HabitDayResult {
    return { completed, tokenUsed };
  }

  it('increases the streak by one per consecutive scheduled day completed', () => {
    const result = evaluateFixedDaysStreak([day(true), day(true), day(true)]);
    expect(result.streak).toBe(3);
  });

  it('grants one streak-protection token every 7 consecutive completed days, up to 3 (FR-019)', () => {
    const sevenDays = Array.from({ length: 7 }, () => day(true));
    expect(evaluateFixedDaysStreak(sevenDays).tokensAvailable).toBe(1);

    const twentyOneDays = Array.from({ length: 21 }, () => day(true));
    expect(evaluateFixedDaysStreak(twentyOneDays).tokensAvailable).toBe(3);

    const twentyEightDays = Array.from({ length: 28 }, () => day(true));
    expect(evaluateFixedDaysStreak(twentyEightDays).tokensAvailable).toBe(3); // capped, not 4
  });

  it('resets the streak to 0 on a scheduled day missed with no token used', () => {
    const days = [day(true), day(true), day(false)];
    expect(evaluateFixedDaysStreak(days).streak).toBe(0);
  });

  it('a token-covered day keeps the streak alive and spends one token', () => {
    const sevenDays = Array.from({ length: 7 }, () => day(true));
    const withMissedDayCovered = [...sevenDays, day(true, true)]; // day 8, covered by token

    const result = evaluateFixedDaysStreak(withMissedDayCovered);

    expect(result.streak).toBe(8);
    expect(result.tokensAvailable).toBe(0); // earned 1 at day 7, spent it at day 8
  });
});

describe('buildFixedDaysLog', () => {
  function completion(date: string, tokenUsed = false): HabitCompletion {
    return { id: date, habit_id: 'h1', date: new Date(date), token_used: tokenUsed, created_at: new Date(), updated_at: new Date() };
  }

  it('includes only scheduled weekdays between the two dates, marking completed ones', () => {
    // 2026-09-14 is a Monday
    const log = buildFixedDaysLog(
      ['mon', 'wed'],
      [completion('2026-09-14')], // Monday, completed
      new Date('2026-09-14'),
      new Date('2026-09-16') // Wednesday
    );

    // Mon (completed), Wed (not completed) — Tue is not scheduled, excluded
    expect(log).toEqual([
      { completed: true, tokenUsed: false },
      { completed: false, tokenUsed: false },
    ]);
  });

  it('marks a day covered by a token as completed with tokenUsed=true', () => {
    const log = buildFixedDaysLog(
      ['mon'],
      [completion('2026-09-14', true)],
      new Date('2026-09-14'),
      new Date('2026-09-14')
    );

    expect(log).toEqual([{ completed: true, tokenUsed: true }]);
  });
});

describe('evaluateFrequencyStreak', () => {
  function week(completions: number, target: number, tokenUsed = false): HabitWeekResult {
    return { completions, target, tokenUsed };
  }

  it('increases the streak by one per week the target was met', () => {
    const result = evaluateFrequencyStreak([week(3, 3), week(4, 3), week(3, 3)]);
    expect(result.streak).toBe(3);
  });

  it('grants one token per 7 accumulated individual completions, up to 3 (FR-019a)', () => {
    // 3+3+1 = 7 completions total across 3 weeks
    const result = evaluateFrequencyStreak([week(3, 3), week(3, 3), week(1, 3)]);
    expect(result.tokensAvailable).toBe(1);
  });

  it('a token covers a week missing exactly one completion, keeping the streak alive', () => {
    const result = evaluateFrequencyStreak([
      week(3, 1), week(3, 1), week(1, 1), // each week meets its own target=1; 7 completions total -> 1 token earned
      week(1, 2, true), // this week's target is 2, only 1 done (shortfall of exactly 1), token used to cover it
    ]);

    expect(result.streak).toBe(4);
    expect(result.tokensAvailable).toBe(0);
  });

  it('resets the streak when a week misses the target with no token available', () => {
    const result = evaluateFrequencyStreak([week(3, 3), week(1, 3)]);
    expect(result.streak).toBe(0);
  });
});

describe('isHabitScheduledToday', () => {
  const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const today = new Date(Date.UTC(2026, 8, 18)); // fixed reference date — deterministic regardless of when the suite runs
  const todayCode = DAY_CODES[today.getUTCDay()];
  const otherCode = DAY_CODES[(today.getUTCDay() + 1) % 7];

  function habit(overrides: Partial<Habit>): Habit {
    return {
      id: 'h1', user_id: 'u1', name: 'Test',
      schedule_mode: 'fixed_days', fixed_days: [],
      created_at: today, updated_at: today,
      ...overrides,
    } as Habit;
  }

  function completion(date: Date): HabitCompletion {
    return { id: 'c1', habit_id: 'h1', date, token_used: false, created_at: date, updated_at: date };
  }

  it('a fixed-days habit is scheduled today when today\'s day code is in fixed_days (FR-008)', () => {
    expect(isHabitScheduledToday(habit({ schedule_mode: 'fixed_days', fixed_days: [todayCode] }), [], today)).toBe(true);
  });

  it('a fixed-days habit is NOT scheduled today when today is not in fixed_days', () => {
    expect(isHabitScheduledToday(habit({ schedule_mode: 'fixed_days', fixed_days: [otherCode] }), [], today)).toBe(false);
  });

  it('a frequency habit is scheduled today while this week\'s completions are below target', () => {
    const h = habit({ schedule_mode: 'frequency', frequency_target: 3 });
    expect(isHabitScheduledToday(h, [], today)).toBe(true);
  });

  it('a frequency habit is NOT scheduled today once this week\'s target is already met', () => {
    const h = habit({ schedule_mode: 'frequency', frequency_target: 1 });
    expect(isHabitScheduledToday(h, [completion(today)], today)).toBe(false);
  });

  it('a completion from a previous calendar week does not count toward the current week\'s target', () => {
    const h = habit({ schedule_mode: 'frequency', frequency_target: 1 });
    const eightDaysAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 8));
    expect(isHabitScheduledToday(h, [completion(eightDaysAgo)], today)).toBe(true);
  });
});
