import { LocalAchievementRepository } from '../../infrastructure/repositories/local/LocalAchievementRepository';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { onSyncCompleted } from '../../infrastructure/sync/syncEvents';
import { useEffect, useState } from 'react';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { LocalRegistrationRepository } from '../../infrastructure/repositories/local/LocalRegistrationRepository';
import { SharedMovement } from '../../core/domain/models/types';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { findHabitsPendingToday } from '../../core/use-cases/findHabitsPendingToday';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { calculateBudgets } from '../../core/use-cases/calculateBudgets';
import { calculateSpentByBucket } from '../../core/use-cases/calculateCategoryBreakdown';
import { calculateSavingsGoalProgress } from '../../core/use-cases/calculateSavingsGoalProgress';
import { calculateMonthBalance } from '../../core/use-cases/calculateMonthBalance';
import { selectCardOwed } from '../../core/use-cases/selectCardOwed';
import { buildPendingRegistrations } from '../../core/use-cases/buildPendingRegistrations';
import { evaluateNotifications } from '../../core/use-cases/evaluateNotifications';

const EVALUATION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Evaluates notification triggers (80%-of-budget, goal completed, daily reminder,
 * pending registrations `register_due`, debts, tasks, habits) on mount and every
 * 5 minutes thereafter. A threshold or due item can change while the user works
 * in the session, so a single mount-time check isn't enough (Principio XI).
 */
export function useNotificationEvaluator(userId: string | null) {
  const [celebration, setCelebration] = useState<{ userId: string; count: number } | null>(null);
  useEffect(() => {
    if (!userId) return;

    const profileRepo = new LocalProfileRepository();
    const movementRepo = new LocalMovementRepository();
    const categoryRepo = new LocalCategoryRepository();
    const goalRepo = new LocalSavingsGoalRepository();
    const notificationRepo = new LocalNotificationRepository();
    const debtRepo = new LocalDebtRepository();
    const sharedSpaceRepo = new LocalSharedSpaceRepository();
    const sharedMovementRepo = new LocalSharedMovementRepository();
    const habitRepo = new LocalHabitRepository();
    const goalRepoGeneric = new LocalGoalRepository();
    const taskRepo = new LocalTaskRepository();
    const registrationRepo = new LocalRegistrationRepository();

    let active = true;
    const runProgress = async () => {
      try {
        const ids = await new LocalAchievementRepository().reconcile(userId);
        if (active && ids.length) setCelebration({ userId, count: ids.length });
      } catch (error) { console.error('Error evaluating achievements:', error); }
    };
    const unsubscribeProgress = onLocalChanges(['movements', 'tasks', 'goals', 'habits', 'habit_completions', 'savings_goals', 'profiles'], runProgress);
    const unsubscribeSync = onSyncCompleted(runProgress);
    void runProgress();
    const run = async () => {
      try {
        const now = new Date();
        const profile = await profileRepo.get(userId);
        const [start, end] = calculateMonthlyCycle(now);

        const [cycleMovements, allMovements, distributionCategories, savingsGoals, existingNotifications, debts, regInputs] =
          await Promise.all([
            movementRepo.getAllByCycle(userId, start, end),
            movementRepo.getAll(userId), // savings goal progress & month balance are lifetime, not cycle-scoped
            categoryRepo.getDistributionCategories(userId),
            goalRepo.getAll(userId),
            notificationRepo.getAllByUser(userId),
            debtRepo.getAll(userId),
            registrationRepo.getInputs(userId, now),
          ]);

        const sharedSpaces = await sharedSpaceRepo.getAllForUser(userId);
        const sharedMovementLists = await Promise.all(
          sharedSpaces.map(space => sharedMovementRepo.getAllForSpace(space.id))
        );
        const sharedMovements: SharedMovement[] = sharedMovementLists.flat();

        const habits = await habitRepo.getAll(userId);
        const completionsByHabit = Object.fromEntries(
          await Promise.all(habits.map(async habit => [habit.id, await habitRepo.getCompletions(habit.id)] as const)),
        );
        const habitsPendingToday = findHabitsPendingToday(habits, completionsByHabit, now);

        const goals = await goalRepoGeneric.getAll(userId);
        const tasks = await taskRepo.getAll(userId);

        const totalIncome = regInputs.incomeSources.reduce((total, source) => total + source.amount, 0);

        const budgetedCategories = calculateBudgets(totalIncome, distributionCategories);
        const spentByBucketId = calculateSpentByBucket(cycleMovements, distributionCategories);

        const savingsGoalsWithProgress = savingsGoals.map(goal => ({
          goal,
          currentAmountCents: calculateSavingsGoalProgress(goal, allMovements).currentAmountCents,
        }));

        const monthBalance = calculateMonthBalance({
          month: now,
          accounts: regInputs.accounts,
          movements: allMovements,
          distributionCategories,
          balanceSince: profile?.balance_since,
        });
        const pendingRegistrations = buildPendingRegistrations({
          today: now,
          rules: regInputs.rules,
          incomeSources: regInputs.incomeSources,
          loans: regInputs.loans,
          loanIdByPaymentId: regInputs.loanIdByPaymentId,
          accounts: regInputs.accounts,
          cardOwed: selectCardOwed(monthBalance),
          monthMovements: regInputs.monthMovements,
          skips: regInputs.skips,
        });

        const newNotifications = evaluateNotifications({
          userId,
          now,
          budgetedCategories,
          spentByBucketId,
          savingsGoals: savingsGoalsWithProgress,
          debts,
          sharedMovements,
          habitsPendingToday,
          goals,
          tasks,
          pendingRegistrations,
          notificationHour: profile?.notification_hour,
          existingNotifications,
        });

        const canPush =
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'granted' &&
          profile?.push_enabled !== false;

        for (const notification of newNotifications) {
          const saved = await notificationRepo.save({ ...notification, id: '' });

          if (canPush) {
            new window.Notification(saved.title, { body: saved.body });
          }
        }
      } catch (err) {
        console.error('Error evaluating notifications:', err);
      }
    };

    run();
    const interval = setInterval(() => { void run(); void runProgress(); }, EVALUATION_INTERVAL_MS);

    return () => { active = false; clearInterval(interval); unsubscribeProgress(); unsubscribeSync(); };
  }, [userId]);
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 5000);
    return () => clearTimeout(timer);
  }, [celebration]);
  return celebration?.userId === userId ? celebration : null;
}
