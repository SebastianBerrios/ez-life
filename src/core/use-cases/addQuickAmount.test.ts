import { describe, it, expect } from 'vitest';
import { addQuickAmount, centsToAmountInput, normalizeAmountInput } from './addQuickAmount';

describe('addQuickAmount', () => {
  it('adds the delta to an empty amount', () => {
    expect(addQuickAmount('', 1000)).toBe('10.00');
  });

  it('adds to a typed amount keeping the cents', () => {
    expect(addQuickAmount('12.50', 2000)).toBe('32.50');
    expect(addQuickAmount('0.05', 10000)).toBe('100.05');
  });

  it('never drifts like floating point does', () => {
    // 0.1 + 0.2 style cases: 10.10 + 20.20 must be exactly 30.30
    expect(addQuickAmount('10.10', 2020)).toBe('30.30');
    expect(addQuickAmount('1.15', 5)).toBe('1.20');
  });

  it('treats invalid input as zero', () => {
    expect(addQuickAmount('abc', 1000)).toBe('10.00');
    expect(addQuickAmount('1.2.3', 2000)).toBe('20.00');
    expect(addQuickAmount('-5', 1000)).toBe('10.00');
  });

  it('accepts thousands separators, a trailing dot and a leading dot', () => {
    expect(addQuickAmount('1,234.50', 1000)).toBe('1244.50');
    expect(addQuickAmount('12.', 1000)).toBe('22.00');
    expect(addQuickAmount('.5', 1000)).toBe('10.50');
  });

  it('accepts a comma as decimal separator', () => {
    expect(addQuickAmount('12,5', 1000)).toBe('22.50');
  });

  it('clamps at zero when the delta is negative', () => {
    expect(addQuickAmount('5.00', -1000)).toBe('0.00');
  });

  it('keeps the current amount when the sum would not be a safe integer', () => {
    const huge = '90071992547409.91'; // 9007199254740991 cents = MAX_SAFE_INTEGER
    expect(addQuickAmount(huge, 1000)).toBe(huge);
  });

  it('returns a normalized string with no grouping separators', () => {
    expect(addQuickAmount('1000000', 0)).toBe('1000000.00');
  });
});

describe('centsToAmountInput', () => {
  it('formats integer cents with two decimals and no separators', () => {
    expect(centsToAmountInput(0)).toBe('0.00');
    expect(centsToAmountInput(5)).toBe('0.05');
    expect(centsToAmountInput(123456)).toBe('1234.56');
  });
});

describe('normalizeAmountInput', () => {
  it('returns the normalized amount for a valid input', () => {
    expect(normalizeAmountInput('1,500')).toBe('1500.00');
    expect(normalizeAmountInput('7.5')).toBe('7.50');
  });

  it('returns null for empty or invalid input so the caller keeps what the user typed', () => {
    expect(normalizeAmountInput('')).toBeNull();
    expect(normalizeAmountInput('1.2.3')).toBeNull();
  });
});
