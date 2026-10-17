import { describe, it, expect } from 'vitest';
import { addDays, calendarKey, combineDateAndTime, daysBetween, formatCycleLabel, parseCalendarDate, shiftMonth, startOfDay, timeKey, weekWindow } from './calendar';

describe('timeKey', () => {
  it('formats local time as zero-padded HH:mm', () => {
    expect(timeKey(new Date(2026, 9, 16, 7, 5))).toBe('07:05');
    expect(timeKey(new Date(2026, 9, 16, 23, 59))).toBe('23:59');
    expect(timeKey(new Date(2026, 9, 16, 0, 0))).toBe('00:00');
  });
});

describe('combineDateAndTime', () => {
  it('builds a local Date from the date key and the time', () => {
    const result = combineDateAndTime('2026-10-16', '19:30');
    expect(result).toEqual(new Date(2026, 9, 16, 19, 30));
    expect(calendarKey(result)).toBe('2026-10-16');
    expect(timeKey(result)).toBe('19:30');
  });

  it('round-trips with calendarKey/timeKey so editing keeps the time', () => {
    const original = new Date(2026, 0, 5, 21, 7);
    expect(combineDateAndTime(calendarKey(original), timeKey(original))).toEqual(original);
  });

  it('keeps the local calendar day for evening times (no UTC shift in UTC-5 style offsets)', () => {
    const evening = combineDateAndTime('2026-10-16', '23:45');
    expect(evening.getDate()).toBe(16);
    expect(calendarKey(evening)).toBe('2026-10-16');
  });

  it('is consistent with parseCalendarDate at noon', () => {
    expect(combineDateAndTime('2026-10-16', '12:00')).toEqual(parseCalendarDate('2026-10-16'));
  });

  it('rejects invalid dates and times', () => {
    expect(() => combineDateAndTime('2026-02-31', '10:00')).toThrow(/fecha/i);
    expect(() => combineDateAndTime('2026-10-16', '25:00')).toThrow(/hora/i);
    expect(() => combineDateAndTime('2026-10-16', '10:60')).toThrow(/hora/i);
    expect(() => combineDateAndTime('2026-10-16', '')).toThrow(/hora/i);
    expect(() => combineDateAndTime('2026-10-16', '9:05')).toThrow(/hora/i);
  });
});

describe('shiftMonth', () => {
  it('returns the first day of the shifted month', () => {
    expect(shiftMonth(new Date(2026, 9, 16), 1)).toEqual(new Date(2026, 10, 1));
    expect(shiftMonth(new Date(2026, 9, 31), -1)).toEqual(new Date(2026, 8, 1));
  });

  it('crosses year boundaries in both directions', () => {
    expect(shiftMonth(new Date(2026, 11, 20), 1)).toEqual(new Date(2027, 0, 1));
    expect(shiftMonth(new Date(2026, 0, 5), -1)).toEqual(new Date(2025, 11, 1));
  });

  it('does not overflow from a 31st into a shorter month', () => {
    expect(shiftMonth(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
  });
});

describe('formatCycleLabel', () => {
  it('capitalizes the es-PE month and appends the year', () => {
    expect(formatCycleLabel(new Date(2026, 9, 1))).toBe('Octubre 2026');
    expect(formatCycleLabel(new Date(2027, 0, 15))).toBe('Enero 2027');
  });
});

describe('local-day helpers', () => {
  it('startOfDay / addDays work on local components (late evening stays on its day)', () => {
    const evening = new Date(2026, 9, 16, 22, 30);
    expect(startOfDay(evening)).toEqual(new Date(2026, 9, 16));
    expect(addDays(evening, 1)).toEqual(new Date(2026, 9, 17, 22, 30));
    expect(addDays(evening, -16)).toEqual(new Date(2026, 8, 30, 22, 30));
    expect(addDays(new Date(2026, 11, 31, 12), 1)).toEqual(new Date(2027, 0, 1, 12));
  });

  it('daysBetween counts calendar days regardless of time of day', () => {
    expect(daysBetween(new Date(2026, 9, 16, 23, 59), new Date(2026, 9, 17, 0, 1))).toBe(1);
    expect(daysBetween(new Date(2026, 9, 17, 0, 1), new Date(2026, 9, 16, 23, 59))).toBe(-1);
    expect(daysBetween(new Date(2026, 9, 16, 8), new Date(2026, 9, 16, 20))).toBe(0);
    expect(daysBetween(new Date(2026, 0, 1), new Date(2027, 0, 1))).toBe(365);
  });

  it('weekWindow returns Monday..Sunday of the local week, also on Sunday night and Monday morning', () => {
    for (const today of [new Date(2026, 9, 16, 22, 0), new Date(2026, 9, 12, 0, 5), new Date(2026, 9, 18, 23, 59)]) {
      const week = weekWindow(today);
      expect(week.start).toEqual(new Date(2026, 9, 12));
      expect(week.end).toEqual(new Date(2026, 9, 19));
      expect(week.days.map(day => day.getDate())).toEqual([12, 13, 14, 15, 16, 17, 18]);
      expect(week.days.map(day => day.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
    }
  });

  it('weekWindow crosses month and year boundaries', () => {
    expect(weekWindow(new Date(2026, 11, 31, 20)).days.map(calendarKey)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });
});
