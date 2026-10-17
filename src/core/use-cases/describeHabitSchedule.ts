import type { DayOfWeek, Habit } from '../domain/models/types';

const ORDER: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SHORT: Record<DayOfWeek, string> = { mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom' };

/** Human schedule: "Todos los días", "Lun · Mié · Vie" (Monday first) or "3 veces por semana". */
export function describeHabitSchedule(habit: Pick<Habit, 'schedule_mode' | 'fixed_days' | 'frequency_target'>): string {
  const fixed = habit.fixed_days;
  if (habit.schedule_mode === 'fixed_days' && fixed && fixed.length > 0) {
    const days = ORDER.filter(day => fixed.includes(day));
    if (days.length === 7) return 'Todos los días';
    return days.map(day => SHORT[day]).join(' · ');
  }
  const times = habit.frequency_target ?? 1;
  return `${times} ${times === 1 ? 'vez' : 'veces'} por semana`;
}
