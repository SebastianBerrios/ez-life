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
