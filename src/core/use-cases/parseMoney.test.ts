import { it, expect } from 'vitest';
import { parseMoney } from './parseMoney';
import { calendarKey, parseCalendarDate } from './calendar';
it('parses decimal money without floating point rounding or silent truncation', () => {
  expect(parseMoney('0.29')).toBe(29); expect(parseMoney('1,234.56')).toBe(123456);
  expect(parseMoney('12,34')).toBe(1234);
  for (const invalid of ['1.005', '-2', '3.4.5', '90071992547410']) expect(() => parseMoney(invalid)).toThrow();
});
it('matches the legacy parseFloat formula for every valid amount the debt and loan inputs can hold', () => {
  // The inputs only allow digits and ".", and the old code was Math.round(parseFloat(text) * 100).
  const legacy = (text: string) => Math.round(parseFloat(text.replace(/,/g, '')) * 100);
  const valid = ['0.01', '0.1', '0.10', '0.29', '1', '5', '10', '25.5', '99.99', '100', '100.00', '1000.5', '1234.56', '2000.00',
    '4.35', '8.2', '19.99', '33.33', '1.15', '4.10', '999999.99', '0.07', '12.30', '7.00'];
  for (const text of valid) expect(parseMoney(text), text).toBe(legacy(text));
});
it('rejects what the legacy parser silently mangled (more than two decimals, several points, nothing)', () => {
  for (const invalid of ['', '.', '1.2.3', '10.123', '.5']) expect(() => parseMoney(invalid), invalid).toThrow();
});
it('preserves calendar dates and rejects impossible days', () => {
  expect(calendarKey(parseCalendarDate('2026-10-08'))).toBe('2026-10-08');
  expect(() => parseCalendarDate('2026-02-30')).toThrow();
});
