import { describe, it, expect } from 'vitest';
import { clampDayToMonth } from './clampDayToMonth';

describe('clampDayToMonth', () => {
  it('keeps days that exist in the month unchanged', () => {
    expect(clampDayToMonth(2026, 0, 31)).toBe(31); // Jan
    expect(clampDayToMonth(2026, 10, 15)).toBe(15); // Nov
    expect(clampDayToMonth(2026, 1, 28)).toBe(28); // Feb non-leap
  });

  it('clamps 29, 30 and 31 in non-leap February to 28', () => {
    expect(clampDayToMonth(2026, 1, 29)).toBe(28);
    expect(clampDayToMonth(2026, 1, 30)).toBe(28);
    expect(clampDayToMonth(2026, 1, 31)).toBe(28);
  });

  it('clamps 30 and 31 in leap February to 29 while preserving 29', () => {
    expect(clampDayToMonth(2028, 1, 29)).toBe(29);
    expect(clampDayToMonth(2028, 1, 30)).toBe(29);
    expect(clampDayToMonth(2028, 1, 31)).toBe(29);
  });

  it('clamps 31 in 30-day months to 30', () => {
    expect(clampDayToMonth(2026, 3, 31)).toBe(30); // Apr
    expect(clampDayToMonth(2026, 5, 31)).toBe(30); // Jun
    expect(clampDayToMonth(2026, 8, 31)).toBe(30); // Sep
    expect(clampDayToMonth(2026, 10, 31)).toBe(30); // Nov
  });
});
