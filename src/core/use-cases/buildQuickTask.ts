import { uuidv7 } from 'uuidv7';
import type { Task } from '../domain/models/types';
import { calendarKey, parseCalendarDate } from './calendar';

export const QUICK_TASK_MAX_LENGTH = 120;

export type QuickTaskResult =
  | { ok: true; task: Omit<Task, 'created_at' | 'updated_at'> }
  | { ok: false; error: string };

/**
 * "Añadir tarea rápida": a pending, medium-priority task due TODAY (local calendar day, stored at
 * local noon like every due date). The title is trimmed and capped at `QUICK_TASK_MAX_LENGTH`;
 * an empty or whitespace-only title is rejected with a message the UI can show inline.
 */
export function buildQuickTask(title: string, userId: string, today: Date): QuickTaskResult {
  const trimmed = title.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Escribe un título para la tarea.' };
  return {
    ok: true,
    task: {
      id: uuidv7(),
      user_id: userId,
      title: trimmed.slice(0, QUICK_TASK_MAX_LENGTH).trimEnd(),
      due_date: parseCalendarDate(calendarKey(today)),
      status: 'pending',
      priority: 'medium',
    },
  };
}
