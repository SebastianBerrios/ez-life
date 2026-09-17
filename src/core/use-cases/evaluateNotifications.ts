import { Debt, Goal, Notification, SavingsGoal, SharedMovement, Task, UUID } from '../domain/models/types';
import { evaluateGoalCompletion } from './evaluateGoalCompletion';
import { BudgetedCategory } from './calculateBudgets';

interface SavingsGoalWithProgress {
  goal: SavingsGoal;
  currentAmountCents: number;
}

export interface HabitPendingToday {
  habitId: UUID;
  habitName: string;
  hasTokensAvailable: boolean;
}

export interface EvaluateNotificationsParams {
  userId: UUID;
  now: Date;
  budgetedCategories: BudgetedCategory[];
  spentByBucketId: Record<UUID, number>;
  savingsGoals: SavingsGoalWithProgress[];
  debts: Debt[];
  sharedMovements: SharedMovement[];
  habitsPendingToday: HabitPendingToday[];
  goals: Goal[];
  tasks: Task[];
  notificationHour: number | undefined;
  existingNotifications: Notification[];
}

export type NewNotification = Omit<Notification, 'id' | 'created_at' | 'updated_at'>;

const BUDGET_ALERT_THRESHOLD = 0.8;
const LOAN_DUE_SOON_DAYS_THRESHOLD = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function cycleMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function cycleDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hasEquivalent(
  existing: Notification[],
  type: Notification['type'],
  relatedId: string | undefined,
  cycleKey: string | undefined
): boolean {
  return existing.some(
    n => n.type === type && n.related_id === relatedId && n.cycle_key === cycleKey
  );
}

/**
 * Pure evaluator for RF-16's three notification triggers. Framework-free —
 * no React/Dexie/Supabase — so it can be exercised with plain fixtures. The
 * caller (useNotificationEvaluator) is responsible for persisting the
 * returned notifications (ids/timestamps are assigned by the repository,
 * same pattern LocalSavingsGoalRepository/LocalMovementRepository already
 * use) and for firing the browser Notification API when applicable.
 *
 * Deduplication key: `type` + `related_id` + `cycle_key`, checked against
 * `existingNotifications` — an exact match means "already notified, skip".
 */
export function evaluateNotifications(params: EvaluateNotificationsParams): NewNotification[] {
  const {
    userId,
    now,
    budgetedCategories,
    spentByBucketId,
    savingsGoals,
    debts,
    sharedMovements,
    habitsPendingToday,
    goals,
    tasks,
    notificationHour,
    existingNotifications,
  } = params;

  const notifications: NewNotification[] = [];
  const monthKey = cycleMonthKey(now);

  // 1. budget_over_80 — one per bucket per month, once it crosses 80% of its budget.
  for (const bucket of budgetedCategories) {
    if (bucket.budget <= 0) continue; // avoid division by zero on an unbudgeted bucket

    const spent = spentByBucketId[bucket.id] ?? 0;
    const ratio = spent / bucket.budget;
    if (ratio < BUDGET_ALERT_THRESHOLD) continue;

    if (hasEquivalent(existingNotifications, 'budget_over_80', bucket.id, monthKey)) continue;

    notifications.push({
      user_id: userId,
      type: 'budget_over_80',
      title: 'Presupuesto casi agotado',
      body: `Superaste el 80% de tu presupuesto en ${bucket.name}.`,
      related_id: bucket.id,
      cycle_key: monthKey,
    });
  }

  // 2. goal_completed — a lifetime, one-time event per goal (no cycle_key).
  for (const { goal, currentAmountCents } of savingsGoals) {
    if (currentAmountCents < goal.target_amount) continue;

    if (hasEquivalent(existingNotifications, 'goal_completed', goal.id, undefined)) continue;

    notifications.push({
      user_id: userId,
      type: 'goal_completed',
      title: '¡Meta cumplida!',
      body: `Alcanzaste el 100% de tu meta "${goal.name}".`,
      related_id: goal.id,
      cycle_key: undefined,
    });
  }

  // 3. daily_reminder — once per day, only once the configured hour has passed.
  if (notificationHour !== undefined && now.getHours() >= notificationHour) {
    const dayKey = cycleDayKey(now);

    if (!hasEquivalent(existingNotifications, 'daily_reminder', undefined, dayKey)) {
      notifications.push({
        user_id: userId,
        type: 'daily_reminder',
        title: 'Recordatorio diario',
        body: 'No olvides registrar tus movimientos de hoy en ez-life.',
        related_id: undefined,
        cycle_key: dayKey,
      });
    }
  }

  // 4. loan_due_soon — re-fires once per day (like daily_reminder) while the
  // due date is within the reminder window and the debt isn't fully settled.
  for (const debt of debts) {
    if (!debt.due_date) continue;
    if (debt.settled_amount >= debt.amount) continue;

    const daysUntilDue = Math.ceil((debt.due_date.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysUntilDue < 0 || daysUntilDue > LOAN_DUE_SOON_DAYS_THRESHOLD) continue;

    const dayKey = cycleDayKey(now);
    if (hasEquivalent(existingNotifications, 'loan_due_soon', debt.id, dayKey)) continue;

    const directionLabel = debt.direction === 'lent' ? 'te debe' : 'le debés';
    notifications.push({
      user_id: userId,
      type: 'loan_due_soon',
      title: 'Préstamo por vencer',
      body: `${debt.counterparty_name} ${directionLabel} — el préstamo vence pronto.`,
      related_id: debt.id,
      cycle_key: dayKey,
    });
  }

  // 5. shared_movement_added — once per movement someone else registered
  // (mirrors goal_completed: a lifetime, one-time event, no cycle_key).
  for (const movement of sharedMovements) {
    if (movement.created_by === userId) continue;
    if (hasEquivalent(existingNotifications, 'shared_movement_added', movement.id, undefined)) continue;

    notifications.push({
      user_id: userId,
      type: 'shared_movement_added',
      title: 'Nuevo movimiento compartido',
      body: 'Alguien registró un movimiento en tu espacio compartido.',
      related_id: movement.id,
      cycle_key: undefined,
    });
  }

  // 6. habit_reminder / streak_at_risk — one per pending habit, once the
  // configured hour has passed (same gate as daily_reminder). A habit with
  // no streak-protection token left gets the sharper streak_at_risk instead
  // of the plain reminder, since missing it today has no safety net.
  if (notificationHour !== undefined && now.getHours() >= notificationHour) {
    const dayKey = cycleDayKey(now);

    for (const habit of habitsPendingToday) {
      const type = habit.hasTokensAvailable ? 'habit_reminder' : 'streak_at_risk';
      if (hasEquivalent(existingNotifications, type, habit.habitId, dayKey)) continue;

      notifications.push({
        user_id: userId,
        type,
        title: type === 'streak_at_risk' ? 'Tu racha está en riesgo' : 'Hábito pendiente hoy',
        body: type === 'streak_at_risk'
          ? `Todavía no marcaste "${habit.habitName}" hoy y no te quedan comodines.`
          : `No olvides "${habit.habitName}" hoy.`,
        related_id: habit.habitId,
        cycle_key: dayKey,
      });
    }
  }

  // 7. goal_completed (generic Goal, FR-020) — reuses the same type as the
  // SavingsGoal branch above (both are "you completed X" events); dedup by
  // related_id already keeps them from colliding since ids are unique
  // across entities.
  for (const goal of goals) {
    if (!evaluateGoalCompletion(goal)) continue;
    if (hasEquivalent(existingNotifications, 'goal_completed', goal.id, undefined)) continue;

    notifications.push({
      user_id: userId,
      type: 'goal_completed',
      title: '¡Meta cumplida!',
      body: `Alcanzaste tu meta "${goal.name}".`,
      related_id: goal.id,
      cycle_key: undefined,
    });
  }

  // 8. task_due — re-fires once per day (like loan_due_soon) while a
  // pending task's due date is within the reminder window.
  for (const task of tasks) {
    if (task.status !== 'pending') continue;

    const daysUntilDue = Math.ceil((task.due_date.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysUntilDue < 0 || daysUntilDue > LOAN_DUE_SOON_DAYS_THRESHOLD) continue;

    const dayKey = cycleDayKey(now);
    if (hasEquivalent(existingNotifications, 'task_due', task.id, dayKey)) continue;

    notifications.push({
      user_id: userId,
      type: 'task_due',
      title: 'Tarea por vencer',
      body: `"${task.title}" vence pronto.`,
      related_id: task.id,
      cycle_key: dayKey,
    });
  }

  return notifications;
}
