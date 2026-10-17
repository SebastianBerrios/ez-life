import type { Habit, HabitCompletion, Task, TaskPriority } from '../domain/models/types';
import { calendarKey } from './calendar';
import { currentHabitStreak } from './buildHabitStreak';
import { habitStateOnDay } from './habitDay';
import { sortTasksByPriority } from './sortTasksByPriority';

export interface FocusItem {
  kind: 'habit' | 'task';
  id: string;
  title: string;
  done: boolean;
  /** Tasks only (absent = medium). */
  priority?: TaskPriority;
  /** Tasks only: free-form context label. */
  tag?: string;
  /** Habits only. */
  streak?: number;
  streakUnit?: 'days' | 'weeks';
  tokensAvailable?: number;
}

/**
 * "Foco de Hoy": habits scheduled today plus tasks due today (local calendar day), done ones last.
 * Pending order: high-priority tasks, then habits, then the remaining tasks (by priority/date).
 * Tasks carry no time of day (`due_date` is a calendar day stored at noon), so no due time is exposed.
 *
 * `completionsByHabit` maps habit id -> its completions; a missing key means "no completions".
 */
export function buildFocusToday(
  habits: Habit[],
  completionsByHabit: Record<string, HabitCompletion[]>,
  tasks: Task[],
  today: Date,
): FocusItem[] {
  const todayKey = calendarKey(today);

  const habitItems: FocusItem[] = [];
  for (const habit of habits) {
    if (habit.deleted_at) continue;
    const completions = completionsByHabit[habit.id] ?? [];
    const state = habitStateOnDay(habit, completions, today, today);
    if (!state.scheduled) continue;
    const { streak, unit, tokensAvailable } = currentHabitStreak(habit, completions, today);
    habitItems.push({ kind: 'habit', id: habit.id, title: habit.name, done: state.done, streak, streakUnit: unit, tokensAvailable });
  }

  const dueToday = sortTasksByPriority(
    tasks.filter(task => !task.deleted_at && calendarKey(task.due_date) === todayKey),
  );
  const taskItems: FocusItem[] = dueToday.map(task => ({
    kind: 'task',
    id: task.id,
    title: task.title,
    done: task.status === 'done',
    priority: task.priority,
    tag: task.tag,
  }));

  const pendingHabits = habitItems.filter(item => !item.done);
  const pendingTasks = taskItems.filter(item => !item.done);
  const urgentTasks = pendingTasks.filter(item => item.priority === 'high');
  const otherTasks = pendingTasks.filter(item => item.priority !== 'high');
  const doneItems = [...habitItems.filter(item => item.done), ...taskItems.filter(item => item.done)];

  return [...urgentTasks, ...pendingHabits, ...otherTasks, ...doneItems];
}
