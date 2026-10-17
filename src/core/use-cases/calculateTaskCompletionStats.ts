import { Task } from '../domain/models/types';
import { calendarKey } from './calendar';

export interface TaskCompletionStats {
  onTime: number; // status='done' && done_at <= due_date
  overdue: number; // status='pending' && due_date < today, OR status='done' && done_at > due_date
  pending: number; // status='pending' && due_date >= today
}

/**
 * Days are compared as LOCAL calendar days (`calendarKey`): a task due today is not overdue at 21:00
 * (its `due_date` is stored at local noon) and one finished any time on its due day is on time.
 *
 * On-time vs. overdue vs. pending breakdown for the tasks dashboard (FR-005).
 * Pure function; `today` is an explicit parameter (not `new Date()` read
 * internally) to keep it deterministic and testable, matching the existing
 * `calculateHabitCompletionRate(habit, completions, today)` convention.
 */
export function calculateTaskCompletionStats(tasks: Task[], today: Date): TaskCompletionStats {
  const todayKey = calendarKey(today);
  return tasks.reduce<TaskCompletionStats>(
    (stats, task) => {
      if (task.status === 'done') {
        if (task.done_at && calendarKey(task.done_at) > calendarKey(task.due_date)) {
          stats.overdue += 1;
        } else {
          stats.onTime += 1;
        }
        return stats;
      }

      if (calendarKey(task.due_date) < todayKey) {
        stats.overdue += 1;
      } else {
        stats.pending += 1;
      }
      return stats;
    },
    { onTime: 0, overdue: 0, pending: 0 }
  );
}
