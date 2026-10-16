import { describe, expect, it } from 'vitest';
import { completedHabitWeeks, evaluateAchievements, reconcileAchievements, type AchievementData, type AchievementReceipt } from './evaluateAchievements';
import { parseCalendarDate } from './calendar';
import type { Habit, HabitCompletion, Movement } from '../domain/models/types';

const date = parseCalendarDate;
const base = { created_at: date('2026-09-07'), updated_at: date('2026-09-07') };
const empty: AchievementData = { movements: [], tasks: [], goals: [], habits: [], completions: [], savingsGoals: [] };
const movement = (day: number, extra: Partial<Movement> = {}): Movement => ({ ...base, id: String(day), user_id: 'u', amount: 100, type: 'EXPENSE', date: date(`2026-09-${String(day).padStart(2, '0')}`), is_recurring: false, ...extra });
const habit: Habit = { ...base, id: 'h', user_id: 'u', name: 'Leer', schedule_mode: 'fixed_days', fixed_days: ['mon', 'wed'] };
const completion = (day: string, extra: Partial<HabitCompletion> = {}): HabitCompletion => ({ ...base, id: day, habit_id: 'h', date: date(day), token_used: false, ...extra });
const fourWeeks = ['07', '09', '14', '16', '21', '23', '28', '30'].map(d => completion(`2026-09-${d}`));

describe('personal achievements', () => {
  it('counts distinct calendar dates and excludes generated movements and adjustments', () => {
    const excluded: Partial<Movement>[] = [{ is_adjustment: true }, { recurrence_rule_id: 'r' }, { recurrence_month: '2026-09' }, { installment_payment_id: 'p' }, { shared_movement_id: 's' }, { deleted_at: new Date() }, { is_linked: true }];
    const movements = [...Array.from({ length: 6 }, (_, i) => movement(i + 1)), movement(1), ...excluded.map((extra, i) => movement(i + 7, extra))];
    expect(evaluateAchievements({ ...empty, movements })[0]).toMatchObject({ current: 6, earned: false });
    expect(evaluateAchievements({ ...empty, movements: [...movements, movement(20, { is_recurring: true })] })[0].earned).toBe(true);
  });
  it('uses exact thresholds, current task/goal states and real savings contributions', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({ ...base, id: String(i), user_id: 'u', title: 'Tarea', due_date: new Date(), status: 'done' as const }));
    const goals = [{ ...base, id: 'g', user_id: 'u', name: 'Meta', kind: 'numeric' as const, status: 'completed' as const, target_value: 1, current_value: 1 }];
    const savingsGoals = [{ ...base, id: 's', user_id: 'u', name: 'Viaje', target_amount: 200 }];
    const data = { ...empty, tasks, goals, savingsGoals, movements: [movement(1, { savings_goal_id: 's' })] };
    expect(evaluateAchievements(data).map(p => p.earned)).toEqual([false, true, true, false, true, false]);
    expect(evaluateAchievements({ ...data, movements: [movement(1, { savings_goal_id: 's', amount: 200 })] })[5].earned).toBe(true);
    expect(evaluateAchievements({ ...data, tasks: tasks.slice(1), goals: [], movements: [] }).every(p => !p.earned)).toBe(true);
  });
  it('requires four full consecutive scheduled weeks, excluding tokens, deletions and duplicate dates', () => {
    expect(completedHabitWeeks(habit, fourWeeks, date('2026-10-05'))).toBe(4);
    expect(completedHabitWeeks(habit, fourWeeks, date('2026-10-04'))).toBe(3);
    for (const extra of [{ token_used: true }, { deleted_at: new Date() }]) {
      expect(completedHabitWeeks(habit, [completion('2026-09-07', extra), ...fourWeeks.slice(1)], date('2026-10-05'))).toBe(3);
    }
    expect(completedHabitWeeks({ ...habit, schedule_mode: 'frequency', frequency_target: 2 }, fourWeeks.flatMap(c => [c, c]), date('2026-10-05'))).toBe(4);
    expect(completedHabitWeeks({ ...habit, created_at: date('2026-09-08') }, fourWeeks, date('2026-10-05'))).toBe(3);
  });
  it('recognizes history silently and never celebrates recovery twice', () => {
    const progress = evaluateAchievements({ ...empty, movements: Array.from({ length: 7 }, (_, i) => movement(i + 1)) });
    expect(reconcileAchievements(progress, [])[0]).toMatchObject({ celebrate: false, handled: true });
    const receipt: AchievementReceipt = { ...base, id: 'r', user_id: 'u', achievement_id: 'registration', celebration_handled: false };
    expect(reconcileAchievements(progress, [receipt])[0].celebrate).toBe(true);
    expect(reconcileAchievements(progress, [{ ...receipt, celebration_handled: true }])[0].celebrate).toBe(false);
    expect(reconcileAchievements(evaluateAchievements(empty), [{ ...receipt, celebration_handled: true }])[0]).toMatchObject({ earned: false, handled: true });
  });
});
