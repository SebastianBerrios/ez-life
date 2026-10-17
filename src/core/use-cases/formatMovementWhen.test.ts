import { describe, expect, it } from 'vitest';
import { formatMovementWhen, formatShortDate } from './formatMovementWhen';

const today = new Date(2026, 9, 16, 21, 30);

describe('formatMovementWhen', () => {
  it('labels today and yesterday with the local time', () => {
    expect(formatMovementWhen(new Date(2026, 9, 16, 13, 42), today)).toBe('Hoy, 13:42');
    expect(formatMovementWhen(new Date(2026, 9, 15, 9, 5), today)).toBe('Ayer, 09:05');
  });
  it('uses day and month for older dates, adding the year only when it differs', () => {
    expect(formatMovementWhen(new Date(2026, 9, 1, 9, 0), today)).toBe('01 oct, 09:00');
    expect(formatMovementWhen(new Date(2025, 11, 31, 23, 59), today)).toBe('31 dic 2025, 23:59');
  });
  it('treats late evening as the same local day as "today"', () => {
    expect(formatMovementWhen(new Date(2026, 9, 16, 23, 50), new Date(2026, 9, 16, 0, 10))).toBe('Hoy, 23:50');
  });
  it('handles yesterday across a month boundary', () => {
    expect(formatMovementWhen(new Date(2026, 9, 31, 8, 0), new Date(2026, 10, 1, 10, 0))).toBe('Ayer, 08:00');
  });
});

describe('formatShortDate', () => {
  it('prints day, short month and year', () => {
    expect(formatShortDate(new Date(2027, 11, 5, 12))).toBe('05 dic 2027');
  });
});
