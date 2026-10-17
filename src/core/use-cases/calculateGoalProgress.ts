import { Goal } from '../domain/models/types';

/**
 * Goal progress as a fraction in [0, 1] (FR-006). Extracted from the goals list's
 * previously-inline formula (research.md §6) so the goals panel and GoalDashboard share the
 * exact same rule instead of duplicating it (Principio III).
 */
export function calculateGoalProgress(goal: Goal): number {
  if (goal.kind === 'numeric') {
    const target = goal.target_value ?? 0;
    if (target <= 0) return 0;
    const current = goal.current_value ?? 0;
    return Math.min(current / target, 1);
  }

  const milestones = goal.milestones ?? [];
  if (milestones.length === 0) return 0;
  const done = milestones.filter(m => m.done).length;
  return done / milestones.length;
}
