import { describe, it, expect } from 'vitest';
import { evaluateGoalCompletion } from './evaluateGoalCompletion';

describe('evaluateGoalCompletion', () => {
  it('completes a numeric goal when current_value reaches target_value', () => {
    expect(evaluateGoalCompletion({ kind: 'numeric', target_value: 100, current_value: 100 })).toBe(true);
  });

  it('does not complete a numeric goal below its target', () => {
    expect(evaluateGoalCompletion({ kind: 'numeric', target_value: 100, current_value: 99 })).toBe(false);
  });

  it('completes a checklist goal when every milestone is done', () => {
    const milestones = [
      { id: 'm1', label: 'Paso 1', done: true },
      { id: 'm2', label: 'Paso 2', done: true },
    ];
    expect(evaluateGoalCompletion({ kind: 'checklist', milestones })).toBe(true);
  });

  it('does not complete a checklist goal with a pending milestone', () => {
    const milestones = [
      { id: 'm1', label: 'Paso 1', done: true },
      { id: 'm2', label: 'Paso 2', done: false },
    ];
    expect(evaluateGoalCompletion({ kind: 'checklist', milestones })).toBe(false);
  });

  it('does not consider an empty checklist completed (nothing to complete)', () => {
    expect(evaluateGoalCompletion({ kind: 'checklist', milestones: [] })).toBe(false);
  });
});
