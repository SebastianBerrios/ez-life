import { DayOfWeek, Habit, HabitCompletion } from '../domain/models/types';

const DAY_CODES: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Calendar-date arithmetic done entirely in UTC, on purpose: a date-only
// value like a HabitCompletion's `date` is a calendar day, not an instant,
// and comparing/iterating it via local-timezone methods (getDay/setHours)
// silently shifts it by a day for any user west of UTC once parsed from an
// ISO string (new Date('2026-09-14') is UTC midnight, not local midnight).
function dateOnlyKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/**
 * Bridges real calendar dates to the abstract per-scheduled-day log
 * evaluateFixedDaysStreak expects — non-scheduled weekdays are excluded
 * entirely (they never affect the streak either way).
 */
export function buildFixedDaysLog(
  fixedDays: DayOfWeek[],
  completions: HabitCompletion[],
  fromDate: Date,
  toDate: Date
): HabitDayResult[] {
  const completionByDate = new Map(completions.map(c => [dateOnlyKey(c.date), c]));
  const results: HabitDayResult[] = [];

  const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));

  while (cursor <= end) {
    const code = DAY_CODES[cursor.getUTCDay()];
    if (fixedDays.includes(code)) {
      const completion = completionByDate.get(dateOnlyKey(cursor));
      results.push({
        completed: Boolean(completion),
        tokenUsed: completion?.token_used ?? false,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

export interface StreakResult {
  streak: number;
  tokensAvailable: number;
}

const TOKEN_EVERY_N = 7;
const MAX_TOKENS = 3;

export interface HabitDayResult {
  completed: boolean;
  tokenUsed: boolean; // true = this day was covered by a token instead of a real completion
}

/**
 * Fixed-days habits (FR-018, FR-019): the caller supplies one entry per
 * SCHEDULED day only (non-scheduled days never appear here — they don't
 * affect the streak either way), in chronological order.
 */
export function evaluateFixedDaysStreak(days: HabitDayResult[]): StreakResult {
  let streak = 0;
  let tokensAvailable = 0;
  let sinceLastToken = 0;

  for (const day of days) {
    if (day.tokenUsed) {
      tokensAvailable = Math.max(0, tokensAvailable - 1);
      streak += 1;
      // Doesn't count toward earning a new token — that would let a token
      // pay for itself.
    } else if (day.completed) {
      streak += 1;
      sinceLastToken += 1;
      if (sinceLastToken === TOKEN_EVERY_N) {
        tokensAvailable = Math.min(tokensAvailable + 1, MAX_TOKENS);
        sinceLastToken = 0;
      }
    } else {
      streak = 0;
      sinceLastToken = 0;
    }
  }

  return { streak, tokensAvailable };
}

function startOfWeekUTC(d: Date): Date {
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // calendar week is Monday-Sunday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday));
}

/**
 * ControlPage's "hoy" agenda (FR-008): a fixed-days habit is scheduled today
 * when today's day-of-week is in its fixed_days, regardless of whether it was
 * already completed today. A frequency habit is scheduled today as long as
 * this calendar week's completions haven't yet reached its target.
 */
export function isHabitScheduledToday(habit: Habit, completions: HabitCompletion[], today: Date): boolean {
  if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
    return habit.fixed_days.includes(DAY_CODES[today.getUTCDay()]);
  }

  const weekStart = startOfWeekUTC(today);
  const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 7));
  const completionsThisWeek = completions.filter(c => c.date >= weekStart && c.date < weekEnd).length;
  return completionsThisWeek < (habit.frequency_target ?? 1);
}

export interface HabitWeekResult {
  completions: number; // how many times the habit was done that week
  target: number; // frequency_target for that habit
  tokenUsed: boolean; // true if a token was spent to cover a one-completion shortfall
}

/**
 * Frequency habits (FR-018, FR-019a): one entry per calendar week, in
 * chronological order. Streak unit is weeks, not days; tokens are earned per
 * 7 accumulated individual completions (not per week of racha).
 */
export function evaluateFrequencyStreak(weeks: HabitWeekResult[]): StreakResult {
  let streak = 0;
  let tokensAvailable = 0;
  let completionsSinceLastToken = 0;

  for (const week of weeks) {
    completionsSinceLastToken += week.completions;
    while (completionsSinceLastToken >= TOKEN_EVERY_N) {
      tokensAvailable = Math.min(tokensAvailable + 1, MAX_TOKENS);
      completionsSinceLastToken -= TOKEN_EVERY_N;
    }

    const met = week.completions >= week.target;
    const shortfall = week.target - week.completions;

    if (met) {
      streak += 1;
    } else if (week.tokenUsed && shortfall === 1 && tokensAvailable > 0) {
      tokensAvailable -= 1;
      streak += 1;
    } else {
      streak = 0;
    }
  }

  return { streak, tokensAvailable };
}
