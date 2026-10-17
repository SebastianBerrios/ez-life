import { describe, expect, it } from 'vitest';
import { describeTaskDue } from './describeTaskDue';

const today = new Date(2026, 9, 16, 22, 30); // Friday night (already Saturday in UTC when the host is UTC-5)
const due = (day: number, month = 9, year = 2026) => ({ due_date: new Date(year, month, day, 12), status: 'pending' as const });

describe('describeTaskDue', () => {
  it('Hoy / Mañana by local calendar day, also late in the evening', () => {
    expect(describeTaskDue(due(16), today)).toEqual({ text: 'Hoy', tone: 'today' });
    expect(describeTaskDue(due(17), today)).toEqual({ text: 'Mañana', tone: 'upcoming' });
    expect(describeTaskDue(due(16), new Date(2026, 9, 16, 0, 1))).toEqual({ text: 'Hoy', tone: 'today' });
  });

  it('later dates read "Vence D mes", with the year only when it differs', () => {
    expect(describeTaskDue(due(25), today)).toEqual({ text: 'Vence 25 oct', tone: 'upcoming' });
    expect(describeTaskDue(due(5, 0, 2027), today)).toEqual({ text: 'Vence 5 ene 2027', tone: 'upcoming' });
  });

  it('a pending task due before today is "Atrasada"', () => {
    expect(describeTaskDue(due(14), today)).toEqual({ text: 'Atrasada · 14 oct', tone: 'overdue' });
    expect(describeTaskDue(due(15), today).tone).toBe('overdue');
  });

  it('a done task keeps its due day, never "Atrasada"', () => {
    expect(describeTaskDue({ due_date: new Date(2026, 9, 14, 12), status: 'done' }, today)).toEqual({ text: 'Vencía 14 oct', tone: 'done' });
  });

  it('crosses a month boundary for "Mañana"', () => {
    expect(describeTaskDue(due(1, 10), new Date(2026, 9, 31, 23, 0))).toEqual({ text: 'Mañana', tone: 'upcoming' });
  });
});
