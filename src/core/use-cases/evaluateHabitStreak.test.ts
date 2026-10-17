import { describe, it, expect } from 'vitest';
import { buildFixedDaysLog, buildFrequencyWeeks, evaluateFixedDaysStreak, evaluateFrequencyStreak, isHabitScheduledToday, calculateHabitStreakHistory, HabitDayResult, HabitWeekResult } from './evaluateHabitStreak';
import { calendarKey } from './calendar';
import type { Habit, HabitCompletion } from '../domain/models/types';

// All dates are built from LOCAL components; the suite runs under several TZ values
// (America/Lima, Asia/Tokyo, Pacific/Auckland, UTC).
const at = (day: number, hour = 12, month = 9) => new Date(2026, month, day, hour);

function habitOf(overrides: Partial<Habit>): Habit {
  return {
    id: 'h1', user_id: 'u1', name: 'Test', schedule_mode: 'fixed_days', fixed_days: [],
    created_at: new Date(2026, 8, 1), updated_at: new Date(2026, 8, 1),
    ...overrides,
  } as Habit;
}

function completionOn(date: Date, tokenUsed = false): HabitCompletion {
  return { id: `c-${date.getTime()}-${tokenUsed}`, habit_id: 'h1', date, token_used: tokenUsed, created_at: date, updated_at: date };
}

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
  it('includes only scheduled weekdays between the two dates, marking completed ones', () => {
    // 2026-10-12 is a Monday, 2026-10-14 a Wednesday.
    const log = buildFixedDaysLog(['mon', 'wed'], [completionOn(at(12))], at(12, 0), at(14, 23));

    // Mon (completed), Wed (not completed) — Tue is not scheduled, excluded
    expect(log).toEqual([
      { completed: true, tokenUsed: false },
      { completed: false, tokenUsed: false },
    ]);
  });

  it('marks a day covered by a token as completed with tokenUsed=true', () => {
    const log = buildFixedDaysLog(['mon'], [completionOn(at(12), true)], at(12), at(12));
    expect(log).toEqual([{ completed: true, tokenUsed: true }]);
  });

  it('a real completion wins over a token one recorded the same day', () => {
    const log = buildFixedDaysLog(['mon'], [completionOn(at(12, 8), true), completionOn(at(12, 9))], at(12), at(12));
    expect(log).toEqual([{ completed: true, tokenUsed: false }]);
  });

  it('ignores soft-deleted completions', () => {
    const deleted = { ...completionOn(at(12)), deleted_at: new Date(2026, 9, 13) };
    expect(buildFixedDaysLog(['mon'], [deleted], at(12), at(12))).toEqual([{ completed: false, tokenUsed: false }]);
  });

  it('matches a late-evening completion to its own local day, and includes the end day regardless of its hour', () => {
    // Monday 22:00 local is already Tuesday in UTC when the host is UTC-5: it must stay Monday.
    const log = buildFixedDaysLog(['mon', 'tue'], [completionOn(at(12, 22))], at(12, 23), at(13, 0));
    expect(log).toEqual([
      { completed: true, tokenUsed: false },
      { completed: false, tokenUsed: false },
    ]);
  });

  it('matches a remote completion (local noon of its day) and crosses month boundaries', () => {
    // Wed 2026-09-30 and Thu 2026-10-01
    const log = buildFixedDaysLog(
      ['wed', 'thu'],
      [completionOn(new Date(2026, 8, 30, 12)), completionOn(new Date(2026, 9, 1, 12))],
      new Date(2026, 8, 30),
      new Date(2026, 9, 1, 23, 59),
    );
    expect(log).toEqual([
      { completed: true, tokenUsed: false },
      { completed: true, tokenUsed: false },
    ]);
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
  // Friday 2026-10-16 at 22:00 local: already "tomorrow" in UTC when the host is UTC-5.
  const today = at(16, 22);

  it("a fixed-days habit is scheduled today when today's day code is in fixed_days (FR-008)", () => {
    expect(isHabitScheduledToday(habitOf({ fixed_days: ['fri'] }), [], today)).toBe(true);
  });

  it('a fixed-days habit is NOT scheduled today when today is not in fixed_days', () => {
    expect(isHabitScheduledToday(habitOf({ fixed_days: ['sat'] }), [], today)).toBe(false);
  });

  it('uses the LOCAL weekday at any hour of the day (never the UTC one)', () => {
    for (const hour of [0, 1, 7, 12, 19, 21, 23]) {
      const when = at(16, hour);
      expect(isHabitScheduledToday(habitOf({ fixed_days: ['fri'] }), [], when)).toBe(true);
      expect(isHabitScheduledToday(habitOf({ fixed_days: ['thu', 'sat'] }), [], when)).toBe(false);
    }
  });

  it("a frequency habit is scheduled today while this week's completions are below target", () => {
    expect(isHabitScheduledToday(habitOf({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 3 }), [], today)).toBe(true);
  });

  it("a frequency habit is NOT scheduled today once this week's target is already met by earlier days", () => {
    const h = habitOf({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 1 });
    expect(isHabitScheduledToday(h, [completionOn(at(13))], today)).toBe(false);
  });

  it('a frequency habit completed today stays scheduled today (a done habit does not vanish from the agenda)', () => {
    const h = habitOf({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 1 });
    expect(isHabitScheduledToday(h, [completionOn(at(16, 21))], today)).toBe(true);
  });

  it("a completion from a previous calendar week does not count toward the current week's target", () => {
    const h = habitOf({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 1 });
    expect(isHabitScheduledToday(h, [completionOn(at(11, 21))], today)).toBe(true); // Sunday night of the previous week
    expect(isHabitScheduledToday(h, [completionOn(at(12, 0))], today)).toBe(false); // Monday 00:00 of this week
  });
});

describe('calculateHabitStreakHistory', () => {
  it('lists local days oldest first with their completion (frequency habits get every day)', () => {
    const h = habitOf({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 3 });
    const points = calculateHabitStreakHistory(h, [completionOn(at(13, 22))], { from: at(12, 8), to: at(14, 0) });
    expect(points.map(p => [calendarKey(p.date), p.completed])).toEqual([
      ['2026-10-12', false], ['2026-10-13', true], ['2026-10-14', false],
    ]);
    expect(points.every(p => p.date.getHours() === 0)).toBe(true);
  });

  it('skips non-scheduled weekdays of a fixed-days habit using the local weekday', () => {
    const h = habitOf({ fixed_days: ['mon', 'wed'] });
    const points = calculateHabitStreakHistory(h, [completionOn(at(12, 23))], { from: at(12), to: at(15) });
    expect(points.map(p => [calendarKey(p.date), p.completed])).toEqual([['2026-10-12', true], ['2026-10-14', false]]);
  });
});

describe('buildFrequencyWeeks', () => {
  const weekly = (target: number, created = new Date(2026, 8, 7)) =>
    habitOf({ schedule_mode: 'frequency', fixed_days: undefined, frequency_target: target, created_at: created });
  const today = at(16, 22); // Friday of the week of 2026-10-12

  it('builds one entry per full Monday-Sunday week and leaves an open current week out until it is met', () => {
    // Weeks starting 09-07, 09-14, 09-21, 09-28, 10-05 (full) and 10-12 (current, open).
    const done = [at(8, 12, 8), at(10, 12, 8), at(15, 12, 8), at(17, 12, 8), at(22, 12, 8)];
    const weeks = buildFrequencyWeeks(weekly(2), done.map(d => completionOn(d)), today);
    expect(weeks.map(w => w.completions)).toEqual([2, 2, 1, 0, 0]);
  });

  it('includes the current week once it met the target', () => {
    const weeks = buildFrequencyWeeks(weekly(1, new Date(2026, 9, 5)), [completionOn(at(6)), completionOn(at(13))], today);
    expect(weeks.map(w => w.completions)).toEqual([1, 1]);
  });

  it('does not penalize the partial week the habit was created in', () => {
    // Created Thursday 2026-10-08; nothing done that week, but 2 this week.
    const weeks = buildFrequencyWeeks(weekly(2, at(8)), [completionOn(at(13)), completionOn(at(14))], today);
    expect(weeks.map(w => w.completions)).toEqual([2]);
  });

  it('counts a Sunday-night completion in its own week, not the next one', () => {
    const weeks = buildFrequencyWeeks(weekly(1, new Date(2026, 9, 5)), [completionOn(at(11, 23))], today);
    expect(weeks).toEqual([{ completions: 1, target: 1, tokenUsed: false }]);
  });
});
