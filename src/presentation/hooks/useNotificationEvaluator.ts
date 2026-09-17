import { useEffect } from 'react';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { SharedMovement } from '../../core/domain/models/types';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { buildFixedDaysLog, evaluateFixedDaysStreak } from '../../core/use-cases/evaluateHabitStreak';
import { HabitPendingToday } from '../../core/use-cases/evaluateNotifications';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { calculateBudgets } from '../../core/use-cases/calculateBudgets';
import { calculateSpentByBucket } from '../../core/use-cases/calculateCategoryBreakdown';
import { calculateSavingsGoalProgress } from '../../core/use-cases/calculateSavingsGoalProgress';
import { evaluateNotifications } from '../../core/use-cases/evaluateNotifications';

const EVALUATION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Evaluates RF-16's notification triggers (80%-of-budget, goal completed,
 * daily reminder) on mount and every 5 minutes thereafter — unlike
 * useRecurrenceEvaluator (which only needs to run once per session), a
 * budget/goal threshold can be crossed by movements the user loads during
 * the session, so a single mount-time check isn't enough.
 */
export function useNotificationEvaluator(userId: string | null) {
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

    const run = async () => {
      try {
        const profile = await profileRepo.get(userId);
        const [start, end] = calculateMonthlyCycle(new Date());

        const [cycleMovements, allMovements, distributionCategories, savingsGoals, existingNotifications, debts] =
          await Promise.all([
            movementRepo.getAllByCycle(userId, start, end),
            movementRepo.getAll(userId), // savings goal progress is lifetime, not cycle-scoped
            categoryRepo.getDistributionCategories(userId),
            goalRepo.getAll(userId),
            notificationRepo.getAllByUser(userId),
            debtRepo.getAll(userId),
          ]);

        const sharedSpaces = await sharedSpaceRepo.getAllForUser(userId);
        const sharedMovementLists = await Promise.all(
          sharedSpaces.map(space => sharedMovementRepo.getAllForSpace(space.id))
        );
        const sharedMovements: SharedMovement[] = sharedMovementLists.flat();

        const habits = await habitRepo.getAll(userId);
        const fixedDaysHabits = habits.filter(h => h.schedule_mode === 'fixed_days');
        const today = new Date();
        const todayCode = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getUTCDay()];

        const habitsPendingToday: HabitPendingToday[] = [];
        for (const habit of fixedDaysHabits) {
          if (!habit.fixed_days?.includes(todayCode as typeof habit.fixed_days[number])) continue;

          const completions = await habitRepo.getCompletions(habit.id);
          const todayLog = buildFixedDaysLog(habit.fixed_days, completions, today, today);
          if (todayLog[0]?.completed) continue; // already done today

          const historyLog = buildFixedDaysLog(habit.fixed_days, completions, habit.created_at, today);
          const { tokensAvailable } = evaluateFixedDaysStreak(historyLog.slice(0, -1)); // exclude today (not completed)

          habitsPendingToday.push({ habitId: habit.id, habitName: habit.name, hasTokensAvailable: tokensAvailable > 0 });
        }

        const goals = await goalRepoGeneric.getAll(userId);
        const tasks = await taskRepo.getAll(userId);

        const totalIncome = cycleMovements
          .filter(m => m.type === 'INCOME')
          .reduce((acc, m) => acc + m.amount, 0);

        const budgetedCategories = calculateBudgets(totalIncome, distributionCategories);
        const spentByBucketId = calculateSpentByBucket(cycleMovements, distributionCategories);

        const savingsGoalsWithProgress = savingsGoals.map(goal => ({
          goal,
          currentAmountCents: calculateSavingsGoalProgress(goal, allMovements).currentAmountCents,
        }));

        const newNotifications = evaluateNotifications({
          userId,
          now: new Date(),
          budgetedCategories,
          spentByBucketId,
          savingsGoals: savingsGoalsWithProgress,
          debts,
          sharedMovements,
          habitsPendingToday,
          goals,
          tasks,
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
    const interval = setInterval(run, EVALUATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [userId]);
}
