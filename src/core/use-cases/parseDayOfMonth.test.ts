import { describe, it, expect } from 'vitest';
import { parseDayOfMonth } from './parseDayOfMonth';
import { DomainError } from '../domain/errors/DomainError';

describe('parseDayOfMonth', () => {
  it('returns undefined for empty or whitespace text', () => {
    expect(parseDayOfMonth('')).toBeUndefined();
    expect(parseDayOfMonth('   ')).toBeUndefined();
  });

  it('parses valid integer days 1..31', () => {
    expect(parseDayOfMonth('1')).toBe(1);
    expect(parseDayOfMonth(' 15 ')).toBe(15);
    expect(parseDayOfMonth('31')).toBe(31);
  });

  it('throws DomainError in tuteo for out-of-range or non-integer values', () => {
    for (const invalid of ['0', '32', '-5', '15.5', '15a', 'abc', '+5']) {
      expect(() => parseDayOfMonth(invalid)).toThrow(DomainError);
      expect(() => parseDayOfMonth(invalid)).toThrow('Ingresa un día entre 1 y 31.');
    }
  });
});
