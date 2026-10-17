import { describe, expect, it } from 'vitest';
import { calculateSavingsRate } from './calculateSavingsRate';

describe('calculateSavingsRate', () => {
  it('returns null when there is no income', () => {
    expect(calculateSavingsRate(0, 0)).toBeNull();
    expect(calculateSavingsRate(0, 5000)).toBeNull();
    expect(calculateSavingsRate(-100, 0)).toBeNull();
  });
  it('computes an integer percent of income saved', () => {
    expect(calculateSavingsRate(10000, 2500)).toBe(75);
    expect(calculateSavingsRate(10000, 0)).toBe(100);
    expect(calculateSavingsRate(10000, 10000)).toBe(0);
    expect(calculateSavingsRate(3, 1)).toBe(67);
  });
  it('is negative when spending exceeds income and clamps extreme overspend', () => {
    expect(calculateSavingsRate(10000, 15000)).toBe(-50);
    expect(calculateSavingsRate(100, 1000000)).toBe(-999);
  });
});
