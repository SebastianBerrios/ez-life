import { describe, it, expect } from 'vitest';
import { calculateGoalProgress } from './calculateGoalProgress';
import type { Goal } from '../domain/models/types';

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: 'g1', user_id: 'u1', name: 'Test', kind: 'numeric', status: 'active',
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  } as Goal;
}

describe('calculateGoalProgress', () => {
  it('computes numeric progress as current/target', () => {
    expect(calculateGoalProgress(goal({ kind: 'numeric', current_value: 40, target_value: 100 }))).toBe(0.4);
  });

  it('clamps numeric progress to 1 when current exceeds target', () => {
    expect(calculateGoalProgress(goal({ kind: 'numeric', current_value: 150, target_value: 100 }))).toBe(1);
  });

  it('computes checklist progress as done milestones / total milestones', () => {
    const g = goal({
      kind: 'checklist',
      milestones: [{ id: 'm1', label: 'a', done: true }, { id: 'm2', label: 'b', done: false }],
    });
    expect(calculateGoalProgress(g)).toBe(0.5);
  });

  it('returns 0 for a numeric goal with no target', () => {
    expect(calculateGoalProgress(goal({ kind: 'numeric', current_value: 10, target_value: 0 }))).toBe(0);
  });

  it('returns 0 for a checklist goal with no milestones', () => {
    expect(calculateGoalProgress(goal({ kind: 'checklist', milestones: [] }))).toBe(0);
  });
});
