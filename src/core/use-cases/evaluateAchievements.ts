import type { Goal, Habit, HabitCompletion, Movement, SavingsGoal, Task } from '../domain/models/types';
import { calendarKey, startOfWeek } from './calendar';
import { calculateSavingsGoalProgress } from './calculateSavingsGoalProgress';
import { evaluateGoalCompletion } from './evaluateGoalCompletion';

export const achievementIds = ['registration', 'tasks', 'goal', 'consistency', 'savings_half', 'savings_full'] as const;
export type AchievementId = typeof achievementIds[number];
export interface AchievementProgress { id: AchievementId; current: number; target: number; earned: boolean }
export interface AchievementData {
  movements: Movement[]; tasks: Task[]; goals: Goal[]; habits: Habit[];
  completions: HabitCompletion[]; savingsGoals: SavingsGoal[];
}
export interface AchievementReceipt {
  id: string; user_id: string; achievement_id: AchievementId;
  celebration_handled: boolean; created_at: Date; updated_at: Date; deleted_at?: Date;
}

/** Best historical run of full Monday–Sunday weeks, using real calendar days. */
export function completedHabitWeeks(habit: Habit, completions: HabitCompletion[], now: Date): number {
  const days = new Set(completions.filter(c => c.habit_id === habit.id && !c.deleted_at && !c.token_used && c.date <= now).map(c => calendarKey(c.date)));
  const cursor = startOfWeek(habit.created_at);
  if (calendarKey(cursor) !== calendarKey(habit.created_at)) cursor.setDate(cursor.getDate() + 7);
  const end = startOfWeek(now);
  const codes = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  let run = 0;
  let best = 0;
  while (cursor < end) {
    let count = 0;
    let scheduled = 0;
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(cursor);
      day.setDate(day.getDate() + offset);
      if (habit.schedule_mode === 'frequency' || habit.fixed_days?.some(code => code === codes[offset])) {
        scheduled++;
        if (days.has(calendarKey(day))) count++;
      }
    }
    const target = habit.schedule_mode === 'frequency' ? habit.frequency_target ?? 1 : scheduled;
    run = target > 0 && count >= target ? run + 1 : 0;
    best = Math.max(best, run);
    cursor.setDate(cursor.getDate() + 7);
  }
  return best;
}

export function evaluateAchievements(data: AchievementData, now = new Date()): AchievementProgress[] {
  const movements = data.movements.filter(m => !m.deleted_at);
  const dates = new Set(movements.filter(m => !m.is_adjustment && !m.recurrence_rule_id && !m.recurrence_month && !m.installment_payment_id && !m.shared_movement_id && !m.is_linked).map(m => calendarKey(m.date)));
  const savings = data.savingsGoals.filter(g => !g.deleted_at).map(g => calculateSavingsGoalProgress(g, movements).percentage);
  const values: [AchievementId, number, number][] = [
    ['registration', dates.size, 7],
    ['tasks', data.tasks.filter(t => !t.deleted_at && t.status === 'done').length, 10],
    ['goal', data.goals.filter(g => !g.deleted_at && g.status === 'completed' && evaluateGoalCompletion(g)).length, 1],
    ['consistency', Math.max(0, ...data.habits.filter(h => !h.deleted_at).map(h => completedHabitWeeks(h, data.completions, now))), 4],
    ['savings_half', Math.max(0, ...savings), 50],
    ['savings_full', Math.max(0, ...savings), 100],
  ];
  return values.map(([id, current, target]) => ({ id, current: Math.min(current, target), target, earned: current >= target }));
}

export function reconcileAchievements(progress: AchievementProgress[], receipts: AchievementReceipt[], data?: AchievementData) {
  const byId = new Map(receipts.filter(r => !r.deleted_at).map(r => [r.achievement_id, r]));
  return progress.map(item => {
    const receipt = byId.get(item.id);
    // A first pull may deliver history after local initialization. Evaluate
    // records already existing at that baseline so it remains silent too.
    const historical = receipt && data ? evaluateAchievements({
      movements: data.movements.filter(row => row.updated_at <= receipt.created_at),
      tasks: data.tasks.filter(row => row.updated_at <= receipt.created_at),
      goals: data.goals.filter(row => row.updated_at <= receipt.created_at),
      habits: data.habits.filter(row => row.updated_at <= receipt.created_at),
      completions: data.completions.filter(row => row.updated_at <= receipt.created_at),
      savingsGoals: data.savingsGoals.filter(row => row.updated_at <= receipt.created_at),
    }, receipt.created_at).find(row => row.id === item.id)?.earned : false;
    return { ...item, celebrate: Boolean(receipt && item.earned && !receipt.celebration_handled && !historical),
      handled: Boolean(receipt?.celebration_handled || item.earned) };
  });
}
