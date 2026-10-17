import { describe, expect, it } from 'vitest';
import { describeGoalStatus } from './describeGoalStatus';

const goal = (created: Date, deadline?: Date) => ({ created_at: created, deadline });
const today = new Date(2026, 9, 16, 22, 30);

describe('describeGoalStatus', () => {
  it('completed wins over everything (also past the deadline)', () => {
    expect(describeGoalStatus(goal(new Date(2026, 0, 1), new Date(2026, 5, 1)), 100, today)).toBe('completed');
    expect(describeGoalStatus(goal(new Date(2026, 0, 1)), 140, today)).toBe('completed');
  });

  it('no deadline: no status to compare against', () => {
    expect(describeGoalStatus(goal(new Date(2026, 0, 1)), 10, today)).toBe('no_deadline');
  });

  it('linear expectation: halfway through the period expects 50%, tolerance of 10 points', () => {
    // Created 2026-10-01, deadline 2026-10-31 (30 days); today is day 15 -> expects 50%.
    const g = goal(new Date(2026, 9, 1, 9), new Date(2026, 9, 31, 12));
    expect(describeGoalStatus(g, 50, today)).toBe('on_track');
    expect(describeGoalStatus(g, 40, today)).toBe('on_track'); // exactly at the tolerance
    expect(describeGoalStatus(g, 39, today)).toBe('behind');
    expect(describeGoalStatus(g, 80, today)).toBe('on_track');
  });

  it('a brand-new goal is on track with 0%', () => {
    expect(describeGoalStatus(goal(new Date(2026, 9, 16, 8), new Date(2027, 9, 16, 12)), 0, today)).toBe('on_track');
  });

  it('after the deadline an unfinished goal is behind (expects 100%)', () => {
    expect(describeGoalStatus(goal(new Date(2026, 8, 1), new Date(2026, 9, 10, 12)), 60, today)).toBe('behind');
  });

  it('a deadline on the creation day expects 100% right away; the deadline day itself expects 100%', () => {
    expect(describeGoalStatus(goal(new Date(2026, 9, 16, 8), new Date(2026, 9, 16, 12)), 50, today)).toBe('behind');
    expect(describeGoalStatus(goal(new Date(2026, 8, 16, 8), new Date(2026, 9, 16, 12)), 95, today)).toBe('on_track');
  });

  it('compares calendar days, not instants (late evening is still the same day)', () => {
    const g = goal(new Date(2026, 9, 1, 9), new Date(2026, 9, 31, 12));
    expect(describeGoalStatus(g, 40, new Date(2026, 9, 16, 0, 5))).toBe('on_track');
    expect(describeGoalStatus(g, 40, new Date(2026, 9, 16, 23, 55))).toBe('on_track');
  });
});
