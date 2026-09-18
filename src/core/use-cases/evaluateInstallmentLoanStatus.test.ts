import { describe, it, expect } from 'vitest';
import { evaluateInstallmentLoanStatus } from './evaluateInstallmentLoanStatus';

describe('evaluateInstallmentLoanStatus', () => {
  it('returns active while remaining_installments > 0', () => {
    expect(evaluateInstallmentLoanStatus(5, 'active')).toBe('active');
    expect(evaluateInstallmentLoanStatus(1, 'active')).toBe('active');
  });

  it('returns settled once remaining_installments = 0', () => {
    expect(evaluateInstallmentLoanStatus(0, 'active')).toBe('settled');
  });

  it('never reverts to active once already settled (FR-025)', () => {
    // Even if something upstream miscounts and reports remaining_installments > 0
    // for an already-settled loan, the derived status must not un-settle it.
    expect(evaluateInstallmentLoanStatus(3, 'settled')).toBe('settled');
    expect(evaluateInstallmentLoanStatus(0, 'settled')).toBe('settled');
  });
});
