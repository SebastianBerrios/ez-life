import { describe, expect, it } from 'vitest';
import { calculateAdherence } from './calculateAdherence';
import type { Habit, HabitCompletion } from '../domain/models/types';

const everyDay = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const habit = (id: string, o: Partial<Habit> = {}): Habit => ({
  id, user_id: 'u', name: id, schedule_mode: 'fixed_days', fixed_days: [...everyDay], created_at: new Date(2026, 9, 7, 9), updated_at: new Date(), ...o,
});
const done = (habitId: string, day: number, hour = 12): HabitCompletion => {
  const date = new Date(2026, 9, day, hour);
  return { id: `${habitId}-${day}`, habit_id: habitId, date, token_used: false, created_at: date, updated_at: date };
};
const today = new Date(2026, 9, 16, 22, 0); // Friday night

describe('calculateAdherence', () => {
  it('averages the 30-day rate of every habit (integer percent)', () => {
    // Oct 7..16 = 10 scheduled days. "a" done 10/10, "b" done 5/10 -> average 75.
    const a = Array.from({ length: 10 }, (_, i) => done('a', 7 + i));
    const b = Array.from({ length: 5 }, (_, i) => done('b', 7 + i));
    expect(calculateAdherence([habit('a'), habit('b')], { a, b }, today)).toBe(75);
  });

  it('rounds the average to an integer', () => {
    const a = Array.from({ length: 10 }, (_, i) => done('a', 7 + i));
    const b = Array.from({ length: 3 }, (_, i) => done('b', 7 + i));
    const c = Array.from({ length: 4 }, (_, i) => done('c', 7 + i));
    expect(calculateAdherence([habit('a'), habit('b'), habit('c')], { a, b, c }, today)).toBe(57);
  });

  it('is null without habits, with only deleted habits, or when nothing is measurable yet', () => {
    expect(calculateAdherence([], {}, today)).toBeNull();
    expect(calculateAdherence([habit('a', { deleted_at: new Date() })], {}, today)).toBeNull();
    // Created today, scheduled only on Saturday: no scheduled day in its window yet.
    expect(calculateAdherence([habit('s', { fixed_days: ['sat'], created_at: new Date(2026, 9, 16, 21) })], {}, today)).toBeNull();
  });

  it('skips unmeasurable habits instead of dragging the average to 0', () => {
    const a = Array.from({ length: 10 }, (_, i) => done('a', 7 + i));
    const fresh = habit('s', { fixed_days: ['sat'], created_at: new Date(2026, 9, 16, 21) });
    expect(calculateAdherence([habit('a'), fresh], { a }, today)).toBe(100);
  });

  it('credits a late-evening completion to its own local day', () => {
    const only = habit('x', { fixed_days: ['fri'], created_at: new Date(2026, 9, 16, 8) });
    expect(calculateAdherence([only], { x: [done('x', 16, 21)] }, today)).toBe(100);
  });
});
