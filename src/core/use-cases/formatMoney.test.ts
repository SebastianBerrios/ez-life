import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyParts } from './formatMoney';

describe('formatMoney', () => {
  it.each([
    [0, 'S/ 0.00'],
    [5, 'S/ 0.05'],
    [99, 'S/ 0.99'],
    [100, 'S/ 1.00'],
    [1200, 'S/ 12.00'],
    [210000, 'S/ 2,100.00'],
    [1234567, 'S/ 12,345.67'],
    [100000000, 'S/ 1,000,000.00'],
    [123456789012, 'S/ 1,234,567,890.12'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });

  it('puts an ASCII minus before the symbol for negatives', () => {
    expect(formatMoney(-1200)).toBe('-S/ 12.00');
    expect(formatMoney(-5)).toBe('-S/ 0.05');
    expect(formatMoney(-210000)).toBe('-S/ 2,100.00');
  });

  it('supports sign "always" without signing zero', () => {
    expect(formatMoney(1200, { sign: 'always' })).toBe('+S/ 12.00');
    expect(formatMoney(-1200, { sign: 'always' })).toBe('-S/ 12.00');
    expect(formatMoney(0, { sign: 'always' })).toBe('S/ 0.00');
  });

  it('supports sign "never" (absolute value)', () => {
    expect(formatMoney(-1200, { sign: 'never' })).toBe('S/ 12.00');
    expect(formatMoney(1200, { sign: 'never' })).toBe('S/ 12.00');
  });

  it('can omit the currency symbol', () => {
    expect(formatMoney(210000, { symbol: false })).toBe('2,100.00');
    expect(formatMoney(-1200, { symbol: false })).toBe('-12.00');
  });

  it('rounds non-integer cents and never prints negative zero', () => {
    expect(formatMoney(10.4)).toBe('S/ 0.10');
    expect(formatMoney(10.5)).toBe('S/ 0.11');
    expect(formatMoney(-10.5)).toBe('-S/ 0.11');
    expect(formatMoney(-0.4)).toBe('S/ 0.00');
    expect(formatMoney(-0.4, { sign: 'always' })).toBe('S/ 0.00');
  });

  it('treats non-finite input as zero', () => {
    expect(formatMoney(Number.NaN)).toBe('S/ 0.00');
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('S/ 0.00');
  });
});

describe('formatMoneyParts', () => {
  it('splits a value into render-friendly parts', () => {
    expect(formatMoneyParts(210000)).toEqual({
      negative: false,
      symbol: 'S/',
      integer: '2,100',
      decimals: '00',
    });
    expect(formatMoneyParts(-1205)).toEqual({
      negative: true,
      symbol: 'S/',
      integer: '12',
      decimals: '05',
    });
  });

  it('reports zero as non-negative', () => {
    expect(formatMoneyParts(-0.2).negative).toBe(false);
  });
});
