import { DayOfWeek, Habit, HabitCompletion } from '../domain/models/types';
import { addDays, calendarKey, startOfDay, weekWindow } from './calendar';
import { dayCode, groupCompletionsByDay, habitHistoryStart, habitStateOnDay } from './habitDay';

// All calendar arithmetic is LOCAL (see habitDay.ts): a HabitCompletion's `date` is a calendar day,
// matched through `calendarKey`, never through UTC getters (those shift the day for users west of
// UTC late in the evening and for users east of UTC early in the morning).

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
  const byDay = groupCompletionsByDay(completions);
  const results: HabitDayResult[] = [];

  const endKey = calendarKey(toDate);
  let cursor = startOfDay(fromDate);

  while (calendarKey(cursor) <= endKey) {
    if (fixedDays.includes(dayCode(cursor))) {
      const that = byDay.get(calendarKey(cursor)) ?? [];
      // A real completion wins over a token one when both exist on the same day.
      results.push({
        completed: that.length > 0,
        tokenUsed: that.length > 0 && that.every(c => c.token_used),
      });
    }
    cursor = addDays(cursor, 1);
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

/**
 * ControlPage's "hoy" agenda (FR-008): a fixed-days habit is scheduled today
 * when today's (local) day-of-week is in its fixed_days, regardless of whether it was
 * already completed today. A frequency habit is scheduled today as long as
 * this calendar week's completions haven't yet reached its target, or when it was already
 * completed today (a done habit never disappears from today's list).
 */
export function isHabitScheduledToday(habit: Habit, completions: HabitCompletion[], today: Date): boolean {
  return habitStateOnDay(habit, completions, today, today).scheduled;
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
export interface HabitStreakHistoryPoint {
  date: Date;
  completed: boolean; // true if there was a real HabitCompletion or a token_used that day
}

/**
 * Day-by-day completion history for the streak evolution chart (FR-004) —
 * same input data as the current-streak calculators above, just reshaped
 * into a time series instead of a single number (research.md §4). For a
 * fixed-days habit, non-scheduled weekdays are excluded entirely (mirrors
 * buildFixedDaysLog); a frequency habit has no fixed schedule, so every
 * calendar day in the range gets a point. `date` is the LOCAL midnight of each day.
 */
export function calculateHabitStreakHistory(
  habit: Habit,
  completions: HabitCompletion[],
  range: { from: Date; to: Date }
): HabitStreakHistoryPoint[] {
  const byDay = groupCompletionsByDay(completions);
  const points: HabitStreakHistoryPoint[] = [];

  const endKey = calendarKey(range.to);
  let cursor = startOfDay(range.from);

  while (calendarKey(cursor) <= endKey) {
    const isScheduled =
      habit.schedule_mode !== 'fixed_days' ||
      !habit.fixed_days ||
      habit.fixed_days.includes(dayCode(cursor));

    if (isScheduled) {
      points.push({ date: new Date(cursor), completed: byDay.has(calendarKey(cursor)) });
    }

    cursor = addDays(cursor, 1);
  }

  return points;
}

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

/**
 * Builds the per-week log evaluateFrequencyStreak expects, from the habit's first day to `today`
 * (Monday-Sunday local weeks). A week still in progress, and the partial week the habit started
 * in, are only included once they met their target: an open week must not break the streak, and a
 * habit created on a Thursday cannot be expected to have a full week.
 */
export function buildFrequencyWeeks(habit: Habit, completions: HabitCompletion[], today: Date): HabitWeekResult[] {
  const target = habit.frequency_target ?? 1;
  const live = completions.filter(c => !c.deleted_at);
  const firstWeekStart = weekWindow(habitHistoryStart(habit, live)).start;
  const firstWeekKey = calendarKey(firstWeekStart);
  const currentWeekKey = calendarKey(weekWindow(today).start);

  const weeks: HabitWeekResult[] = [];
  let cursor = firstWeekStart;
  while (calendarKey(cursor) <= currentWeekKey) {
    const startKey = calendarKey(cursor);
    const endKey = calendarKey(addDays(cursor, 7));
    const inWeek = live.filter(c => {
      const key = calendarKey(c.date);
      return key >= startKey && key < endKey;
    });
    const real = inWeek.filter(c => !c.token_used).length;
    const partial = startKey === firstWeekKey || startKey === currentWeekKey;
    if (real >= target || !partial) {
      weeks.push({ completions: real, target, tokenUsed: inWeek.some(c => c.token_used) });
    }
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
