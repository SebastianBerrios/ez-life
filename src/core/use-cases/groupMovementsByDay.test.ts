import { describe, expect, it } from 'vitest';
import { formatDayLabel, groupByDay } from './groupMovementsByDay';

const today = new Date(2026, 9, 16, 21, 30);

describe('formatDayLabel', () => {
  it('labels today and yesterday with the full date', () => {
    expect(formatDayLabel(new Date(2026, 9, 16, 0, 5), today)).toBe('Hoy, 16 de octubre 2026');
    expect(formatDayLabel(new Date(2026, 9, 15, 23, 59), today)).toBe('Ayer, 15 de octubre 2026');
  });
  it('uses the plain date for older days, without zero padding', () => {
    expect(formatDayLabel(new Date(2026, 9, 1, 9, 0), today)).toBe('1 de octubre 2026');
    expect(formatDayLabel(new Date(2025, 11, 31, 9, 0), today)).toBe('31 de diciembre 2025');
  });
  it('handles yesterday across a month boundary', () => {
    expect(formatDayLabel(new Date(2026, 8, 30, 8, 0), new Date(2026, 9, 1, 10, 0))).toBe('Ayer, 30 de septiembre 2026');
  });
});

describe('groupByDay', () => {
  it('groups consecutive items of the same local day and keeps the incoming order', () => {
    const items = [
      { id: 'a', date: new Date(2026, 9, 16, 14, 30) },
      { id: 'b', date: new Date(2026, 9, 16, 9, 0) },
      { id: 'c', date: new Date(2026, 9, 1, 9, 0) },
    ];
    const groups = groupByDay(items, today);
    expect(groups.map(g => [g.key, g.label, g.items.map(i => i.id)])).toEqual([
      ['2026-10-16', 'Hoy, 16 de octubre 2026', ['a', 'b']],
      ['2026-10-01', '1 de octubre 2026', ['c']],
    ]);
  });
  it('splits at local midnight, not at UTC midnight', () => {
    const groups = groupByDay([{ date: new Date(2026, 9, 16, 23, 59) }, { date: new Date(2026, 9, 17, 0, 1) }], today);
    expect(groups.map(g => g.key)).toEqual(['2026-10-16', '2026-10-17']);
  });
  it('returns no groups for an empty list', () => {
    expect(groupByDay([], today)).toEqual([]);
  });
});
