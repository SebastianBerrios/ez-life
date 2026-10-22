import { describe, it, expect } from 'vitest';
import { parseCurrentBalance } from './parseCurrentBalance';
import { DomainError } from '../domain/errors/DomainError';

describe('parseCurrentBalance', () => {
  it('treats an empty or blank balance as zero', () => {
    expect(parseCurrentBalance('')).toBe(0);
    expect(parseCurrentBalance('   ')).toBe(0);
  });

  it('converts amounts to integer cents', () => {
    expect(parseCurrentBalance('800')).toBe(80000);
    expect(parseCurrentBalance('800.5')).toBe(80050);
    expect(parseCurrentBalance('800,50')).toBe(80050);
    expect(parseCurrentBalance('1,200.00')).toBe(120000);
    expect(parseCurrentBalance('0')).toBe(0);
  });

  it('rejects negative balances with a specific message', () => {
    for (const raw of ['-5', '-0', '-0.01', ' -5']) {
      expect(() => parseCurrentBalance(raw)).toThrow(DomainError);
      expect(() => parseCurrentBalance(raw)).toThrow('El saldo actual no puede ser negativo.');
    }
  });

  it('rejects non numeric input and more than two decimals', () => {
    expect(() => parseCurrentBalance('abc')).toThrow(DomainError);
    expect(() => parseCurrentBalance('1.234')).toThrow(DomainError);
  });

  it('rejects amounts that do not fit a safe integer of cents', () => {
    expect(() => parseCurrentBalance('90071992547409.92')).toThrow('El monto es demasiado grande.');
  });
});
