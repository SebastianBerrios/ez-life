import { calendarKey, daysBetween } from './calendar';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export type TaskDueTone = 'overdue' | 'today' | 'upcoming' | 'done';

export interface TaskDueDescription {
  text: string;
  tone: TaskDueTone;
}

function shortDay(date: Date, today: Date): string {
  const year = date.getFullYear() === today.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
}

/**
 * Due-date label by LOCAL calendar day: "Hoy", "Mañana", "Vence 25 oct" (adds the year when it is
 * not the current one), "Atrasada · 14 oct" for a pending task due earlier, "Hecha" for done tasks.
 * Task due dates carry no time of day, so none is shown.
 */
export function describeTaskDue(task: { due_date: Date; status: 'pending' | 'done' }, today: Date): TaskDueDescription {
  if (task.status === 'done') return { text: `Vencía ${shortDay(task.due_date, today)}`, tone: 'done' };
  const diff = daysBetween(today, task.due_date);
  if (calendarKey(task.due_date) < calendarKey(today)) return { text: `Atrasada · ${shortDay(task.due_date, today)}`, tone: 'overdue' };
  if (diff === 0) return { text: 'Hoy', tone: 'today' };
  if (diff === 1) return { text: 'Mañana', tone: 'upcoming' };
  return { text: `Vence ${shortDay(task.due_date, today)}`, tone: 'upcoming' };
}
