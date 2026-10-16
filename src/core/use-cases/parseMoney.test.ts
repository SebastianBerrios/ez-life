import { it, expect } from 'vitest';
import { parseMoney } from './parseMoney';
import { calendarKey, parseCalendarDate } from './calendar';
it('parses decimal money without floating point rounding or silent truncation', () => {
  expect(parseMoney('0.29')).toBe(29); expect(parseMoney('1,234.56')).toBe(123456);
  expect(parseMoney('12,34')).toBe(1234);
  for (const invalid of ['1.005', '-2', '3.4.5', '90071992547410']) expect(() => parseMoney(invalid)).toThrow();
});
it('preserves calendar dates and rejects impossible days', () => {
  expect(calendarKey(parseCalendarDate('2026-10-08'))).toBe('2026-10-08');
  expect(() => parseCalendarDate('2026-02-30')).toThrow();
});
