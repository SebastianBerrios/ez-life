import type { SavingsGoal } from '../domain/models/types';
import { calendarKey, daysBetween } from './calendar';

export type GoalStatus = 'on_track' | 'behind' | 'no_deadline' | 'completed';

/** A goal is "behind" only when it trails the linear expectation by MORE than this many points. */
export const BEHIND_TOLERANCE_POINTS = 10;

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: 'En objetivo',
  behind: 'Atrasada',
  no_deadline: 'Sin fecha límite',
  completed: 'Completada',
};

/**
 * Derived status of a savings goal (the only goal with a deadline in the domain: `Goal` has none).
 * Rule, all on LOCAL calendar days:
 * - `completed`: progress >= 100%.
 * - `no_deadline`: no deadline.
 * - otherwise the expected progress is linear between the day the goal was created and its
 *   deadline: `elapsedDays / totalDays * 100` (clamped 0..100; a deadline on/before the creation day,
 *   or already past, expects 100). The goal is `behind` when its real progress is more than
 *   `BEHIND_TOLERANCE_POINTS` below that expectation, `on_track` otherwise.
 * `percentage` is the raw progress (`calculateSavingsGoalProgress().percentage`, not capped).
 */
export function describeGoalStatus(goal: Pick<SavingsGoal, 'deadline' | 'created_at'>, percentage: number, today: Date): GoalStatus {
  if (percentage >= 100) return 'completed';
  if (!goal.deadline) return 'no_deadline';

  const total = daysBetween(goal.created_at, goal.deadline);
  const elapsed = daysBetween(goal.created_at, today);
  let expected: number;
  if (calendarKey(today) >= calendarKey(goal.deadline) || total <= 0) expected = 100;
  else expected = Math.min(100, Math.max(0, (elapsed / total) * 100));

  return percentage < expected - BEHIND_TOLERANCE_POINTS ? 'behind' : 'on_track';
}
