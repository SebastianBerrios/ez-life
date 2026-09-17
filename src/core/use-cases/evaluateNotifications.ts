import { Notification, SavingsGoal, UUID } from '../domain/models/types';
import { BudgetedCategory } from './calculateBudgets';

interface SavingsGoalWithProgress {
  goal: SavingsGoal;
  currentAmountCents: number;
}

export interface EvaluateNotificationsParams {
  userId: UUID;
  now: Date;
  budgetedCategories: BudgetedCategory[];
  spentByBucketId: Record<UUID, number>;
  savingsGoals: SavingsGoalWithProgress[];
  notificationHour: number | undefined;
  existingNotifications: Notification[];
}

export type NewNotification = Omit<Notification, 'id' | 'created_at' | 'updated_at'>;

const BUDGET_ALERT_THRESHOLD = 0.8;

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

  return notifications;
}
