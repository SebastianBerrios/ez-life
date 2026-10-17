import { describe, it, expect } from 'vitest';
import { parseOpeningBalance } from './parseOpeningBalance';

describe('parseOpeningBalance', () => {
  it('treats empty input as zero', () => {
    expect(parseOpeningBalance('  ', 'cash')).toBe(0);
  });
  it('parses to integer cents', () => {
    expect(parseOpeningBalance('150.5', 'debit')).toBe(15050);
    expect(parseOpeningBalance('1,200.00', 'savings')).toBe(120000);
  });
  it('allows a negative opening balance only for credit accounts', () => {
    expect(parseOpeningBalance('-300', 'credit')).toBe(-30000);
    expect(() => parseOpeningBalance('-300', 'debit')).toThrow('crédito');
  });
  it('rejects malformed amounts', () => {
    expect(() => parseOpeningBalance('abc', 'cash')).toThrow();
    expect(() => parseOpeningBalance('1.234', 'cash')).toThrow();
  });
  it('does not produce negative zero', () => {
    expect(Object.is(parseOpeningBalance('-0', 'debit'), 0)).toBe(true);
  });
});
