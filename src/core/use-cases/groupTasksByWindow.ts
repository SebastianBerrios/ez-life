import type { Task, TaskPriority } from '../domain/models/types';
import { calendarKey, weekWindow } from './calendar';

export interface TaskWindowItem {
  task: Task;
  /** Pending and due on a day before today. */
  overdue: boolean;
}

export interface TaskWindows {
  /** Pending tasks due today plus overdue ones (flagged), overdue first. */
  today: TaskWindowItem[];
  /** Pending tasks due after today and up to Sunday of the current Monday-Sunday week. */
  week: TaskWindowItem[];
  /** Pending tasks due after the current week (so no task is ever invisible). */
  later: TaskWindowItem[];
  /** Completed tasks, most recently finished first. */
  done: Task[];
}

const RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Due day (local) ascending, then priority high > medium > low (absent = medium), then title. */
function byDayThenPriority(a: Task, b: Task): number {
  return calendarKey(a.due_date).localeCompare(calendarKey(b.due_date))
    || RANK[a.priority ?? 'medium'] - RANK[b.priority ?? 'medium']
    || a.title.localeCompare(b.title);
}

/**
 * Splits tasks into the Control windows by LOCAL calendar day (`calendarKey`), never by instant:
 * a task due today at local noon is "today" at 23:00 as well. Soft-deleted tasks are dropped.
 * Overdue tasks join the "today" window (flagged) so nothing late is hidden.
 */
export function groupTasksByWindow(tasks: Task[], today: Date): TaskWindows {
  const todayKey = calendarKey(today);
  const weekEndKey = calendarKey(weekWindow(today).days[6]); // Sunday

  const pending: Task[] = [];
  const done: Task[] = [];
  for (const task of tasks) {
    if (task.deleted_at) continue;
    (task.status === 'done' ? done : pending).push(task);
  }
  pending.sort(byDayThenPriority);

  const windows: TaskWindows = { today: [], week: [], later: [], done: [] };
  for (const task of pending) {
    if (calendarKey(task.due_date) < todayKey) windows.today.push({ task, overdue: true });
  }
  for (const task of pending) {
    const key = calendarKey(task.due_date);
    if (key === todayKey) windows.today.push({ task, overdue: false });
    else if (key > todayKey) (key <= weekEndKey ? windows.week : windows.later).push({ task, overdue: false });
  }
  windows.done = done.sort((a, b) => (b.done_at ?? b.updated_at).getTime() - (a.done_at ?? a.updated_at).getTime());
  return windows;
}

/** Pending high-priority tasks due today or earlier ("tareas urgentes"). */
export function countUrgentTasks(tasks: Task[], today: Date): number {
  const todayKey = calendarKey(today);
  return tasks.filter(task => !task.deleted_at && task.status !== 'done' && task.priority === 'high' && calendarKey(task.due_date) <= todayKey).length;
}
