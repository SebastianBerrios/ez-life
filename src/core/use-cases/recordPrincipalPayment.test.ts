import { describe, it, expect } from 'vitest';
import { recordPrincipalPayment } from './recordPrincipalPayment';
import { DomainError } from '../domain/errors/DomainError';

describe('recordPrincipalPayment', () => {
  it('applies a reduce_term adjustment exactly as the user entered it, without recalculating (FR-017)', () => {
    const loan = { installment_amount: 10000, remaining_installments: 12 };
    const result = recordPrincipalPayment(loan, 50000, new Date('2026-09-18'), { type: 'reduce_term', newRemainingInstallments: 7 });

    expect(result.remaining_installments).toBe(7);
    expect(result.installment_amount).toBe(10000); // unchanged
    expect(result.payment.adjustment_type).toBe('reduce_term');
    expect(result.payment.resulting_value).toBe(7);
  });

  it('applies a reduce_installment_amount adjustment exactly as entered, without recalculating (FR-017)', () => {
    const loan = { installment_amount: 10000, remaining_installments: 12 };
    const result = recordPrincipalPayment(loan, 50000, new Date(), { type: 'reduce_installment_amount', newInstallmentAmountCents: 7500 });

    expect(result.remaining_installments).toBe(12); // unchanged
    expect(result.installment_amount).toBe(7500);
    expect(result.payment.adjustment_type).toBe('reduce_installment_amount');
    expect(result.payment.resulting_value).toBe(7500);
  });

  it('marks the loan settled if the chosen adjustment brings remaining_installments to 0', () => {
    const loan = { installment_amount: 10000, remaining_installments: 12 };
    const result = recordPrincipalPayment(loan, 120000, new Date(), { type: 'reduce_term', newRemainingInstallments: 0 });

    expect(result.status).toBe('settled');
  });

  it('rejects a payment larger than the outstanding balance — blocks with DomainError, never applies partially (FR-021)', () => {
    const loan = { installment_amount: 10000, remaining_installments: 2 }; // saldo pendiente = 20000
    expect(() =>
      recordPrincipalPayment(loan, 20001, new Date(), { type: 'reduce_term', newRemainingInstallments: 1 })
    ).toThrow(DomainError);
  });

  it('rejects a zero, negative, or non-integer payment amount', () => {
    const loan = { installment_amount: 10000, remaining_installments: 5 };
    const adjustment = { type: 'reduce_term' as const, newRemainingInstallments: 4 };
    expect(() => recordPrincipalPayment(loan, 0, new Date(), adjustment)).toThrow(DomainError);
    expect(() => recordPrincipalPayment(loan, -100, new Date(), adjustment)).toThrow(DomainError);
    expect(() => recordPrincipalPayment(loan, 40.5, new Date(), adjustment)).toThrow(DomainError);
  });

  it('rejects a reduce_term value greater than the current remaining_installments (it can only go down)', () => {
    const loan = { installment_amount: 10000, remaining_installments: 5 };
    expect(() =>
      recordPrincipalPayment(loan, 10000, new Date(), { type: 'reduce_term', newRemainingInstallments: 6 })
    ).toThrow(DomainError);
  });

  it('rejects a reduce_installment_amount value that is zero or negative', () => {
    const loan = { installment_amount: 10000, remaining_installments: 5 };
    expect(() =>
      recordPrincipalPayment(loan, 10000, new Date(), { type: 'reduce_installment_amount', newInstallmentAmountCents: 0 })
    ).toThrow(DomainError);
  });

  it('never touches any DB — it is a pure function returning only descriptions (Principio III)', () => {
    const loan = { installment_amount: 10000, remaining_installments: 12 };
    const result = recordPrincipalPayment(loan, 50000, new Date(), { type: 'reduce_term', newRemainingInstallments: 7 });

    expect(Object.keys(result).sort()).toEqual(['installment_amount', 'movement', 'payment', 'remaining_installments', 'status']);
    expect(Object.keys(result.payment).sort()).toEqual(['adjustment_type', 'amount', 'date', 'kind', 'resulting_value']);
  });

  it('includes a Movement description (amount in cents, date, distribution_category_id from the loan) for BOTH adjustment types — FR-010, constitution v2.0.0 Principio X', () => {
    const date = new Date('2026-09-18');
    const loan = { installment_amount: 10000, remaining_installments: 12, distribution_category_id: 'bucket-1' };

    const reduceTermResult = recordPrincipalPayment(loan, 50000, date, { type: 'reduce_term', newRemainingInstallments: 7 });
    expect(reduceTermResult.movement).toEqual({ amount: 50000, date, distribution_category_id: 'bucket-1' });

    const reduceAmountResult = recordPrincipalPayment(loan, 50000, date, { type: 'reduce_installment_amount', newInstallmentAmountCents: 7500 });
    expect(reduceAmountResult.movement).toEqual({ amount: 50000, date, distribution_category_id: 'bucket-1' });
  });

  it('leaves the Movement description\'s distribution_category_id undefined when the loan has none yet', () => {
    const date = new Date('2026-09-18');
    const loan = { installment_amount: 10000, remaining_installments: 12 };
    const result = recordPrincipalPayment(loan, 50000, date, { type: 'reduce_term', newRemainingInstallments: 7 });

    expect(result.movement).toEqual({ amount: 50000, date, distribution_category_id: undefined });
  });
});
