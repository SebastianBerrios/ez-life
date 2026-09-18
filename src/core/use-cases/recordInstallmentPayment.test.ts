import { describe, it, expect } from 'vitest';
import { recordInstallmentPayment } from './recordInstallmentPayment';
import { DomainError } from '../domain/errors/DomainError';

describe('recordInstallmentPayment', () => {
  it('decrements remaining_installments by the number of installments paid', () => {
    const result = recordInstallmentPayment({ installment_amount: 10000, remaining_installments: 12 }, 2, new Date('2026-09-18'));

    expect(result.remaining_installments).toBe(10);
    expect(result.status).toBe('active');
  });

  it('produces an InstallmentPayment with kind: installment, amount = cuotas * monto de cuota', () => {
    const date = new Date('2026-09-18');
    const result = recordInstallmentPayment({ installment_amount: 10000, remaining_installments: 12 }, 2, date);

    expect(result.payment).toEqual({ kind: 'installment', amount: 20000, date });
  });

  it('marks the loan settled when remaining_installments reaches 0', () => {
    const result = recordInstallmentPayment({ installment_amount: 10000, remaining_installments: 2 }, 2, new Date());

    expect(result.remaining_installments).toBe(0);
    expect(result.status).toBe('settled');
  });

  it('rejects paying more installments than remain — blocks with DomainError, never caps or applies partially (FR-021)', () => {
    const loan = { installment_amount: 10000, remaining_installments: 2 };

    expect(() => recordInstallmentPayment(loan, 3, new Date())).toThrow(DomainError);
    // No partial change: calling it again with a valid amount still sees the original remaining count.
    const result = recordInstallmentPayment(loan, 2, new Date());
    expect(result.remaining_installments).toBe(0);
  });

  it('rejects a zero, negative, or non-integer number of installments', () => {
    const loan = { installment_amount: 10000, remaining_installments: 5 };
    expect(() => recordInstallmentPayment(loan, 0, new Date())).toThrow(DomainError);
    expect(() => recordInstallmentPayment(loan, -1, new Date())).toThrow(DomainError);
    expect(() => recordInstallmentPayment(loan, 1.5, new Date())).toThrow(DomainError);
  });

  it('never returns anything resembling a Movement (FR-027, Principio X)', () => {
    const result = recordInstallmentPayment({ installment_amount: 10000, remaining_installments: 12 }, 2, new Date());

    expect(Object.keys(result).sort()).toEqual(['payment', 'remaining_installments', 'status']);
    expect(Object.keys(result.payment).sort()).toEqual(['amount', 'date', 'kind']);
  });
});
