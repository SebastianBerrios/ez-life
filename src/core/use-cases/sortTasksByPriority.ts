import type { Task, TaskPriority } from '../domain/models/types';

const RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Orders tasks high > medium > low (absent = medium), then due date ascending, then title. Returns a new array. */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) =>
    RANK[a.priority ?? 'medium'] - RANK[b.priority ?? 'medium']
    || a.due_date.getTime() - b.due_date.getTime()
    || a.title.localeCompare(b.title));
}
