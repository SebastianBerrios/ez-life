import { useEffect } from 'react';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { evaluateTaskRecurrence } from '../../core/use-cases/evaluateTaskRecurrence';

const EVALUATION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Generates the next occurrence of a recurring Task once it's due
 * (research.md §2) — on mount and every 5 minutes thereafter, same interval
 * pattern as useNotificationEvaluator (a due date can be crossed by time
 * passing during the session, so a single mount-time check isn't enough).
 * Deliberately separate from useRecurrenceEvaluator (Movement-only, monthly)
 * and from the Notification pipeline (Principio XI — this is a data change,
 * not a reminder).
 */
export function useTaskRecurrenceEvaluator(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const taskRepo = new LocalTaskRepository();

    const run = async () => {
      try {
        // Regardless of completion status (FR-003): a done or overdue
        // occurrence must still be able to trigger the next one.
        const tasks = await taskRepo.getAllIncludingDone(userId);
        const newOccurrences = evaluateTaskRecurrence(tasks, new Date());

        for (const occurrence of newOccurrences) {
          await taskRepo.save({ ...occurrence, id: '' });
        }
      } catch (err) {
        console.error('Error evaluating task recurrence:', err);
      }
    };

    run();
    const interval = setInterval(run, EVALUATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [userId]);
}
