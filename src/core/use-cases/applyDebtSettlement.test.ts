import { describe, it, expect } from 'vitest';
import { applyDebtSettlement } from './applyDebtSettlement';
import { DomainError } from '../domain/errors/DomainError';

describe('applyDebtSettlement', () => {
  it('accumulates a partial payment without marking the debt as fully settled', () => {
    const result = applyDebtSettlement({ amount: 10000, settled_amount: 0 }, 4000);

    expect(result.settled_amount).toBe(4000);
    expect(result.is_fully_settled).toBe(false);
  });

  it('accumulates a second partial payment on top of the first', () => {
    const result = applyDebtSettlement({ amount: 10000, settled_amount: 4000 }, 6000);

    expect(result.settled_amount).toBe(10000);
    expect(result.is_fully_settled).toBe(true);
  });

  it('marks the debt fully settled when a single payment covers the whole amount', () => {
    const result = applyDebtSettlement({ amount: 5000, settled_amount: 0 }, 5000);

    expect(result.is_fully_settled).toBe(true);
  });

  it('rejects a payment larger than the remaining balance', () => {
    expect(() => applyDebtSettlement({ amount: 10000, settled_amount: 4000 }, 7000)).toThrow(DomainError);
  });

  it('rejects a zero or negative payment', () => {
    expect(() => applyDebtSettlement({ amount: 10000, settled_amount: 0 }, 0)).toThrow(DomainError);
    expect(() => applyDebtSettlement({ amount: 10000, settled_amount: 0 }, -100)).toThrow(DomainError);
  });

  it('rejects a non-integer payment', () => {
    expect(() => applyDebtSettlement({ amount: 10000, settled_amount: 0 }, 40.5)).toThrow(DomainError);
  });

  it('never returns anything resembling a Movement (FR-004, Principio X)', () => {
    const result = applyDebtSettlement({ amount: 10000, settled_amount: 0 }, 4000);

    expect(Object.keys(result).sort()).toEqual(['is_fully_settled', 'settled_amount']);
  });
});
