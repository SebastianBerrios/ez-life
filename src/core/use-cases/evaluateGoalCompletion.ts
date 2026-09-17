import { Goal } from '../domain/models/types';

type GoalCompletionInput = Pick<Goal, 'kind'> & Partial<Pick<Goal, 'target_value' | 'current_value' | 'milestones'>>;

export function evaluateGoalCompletion(goal: GoalCompletionInput): boolean {
  if (goal.kind === 'numeric') {
    return (goal.current_value ?? 0) >= (goal.target_value ?? Infinity);
  }

  const milestones = goal.milestones ?? [];
  if (milestones.length === 0) return false; // nothing to complete
  return milestones.every(m => m.done);
}
