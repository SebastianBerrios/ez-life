import { describe, expect, it } from 'vitest';
import { nextInstallment } from './nextInstallment';
import type { InstallmentLoan } from '../domain/models/types';

const now = new Date(2026, 9, 1);
const loan = (o: Partial<InstallmentLoan> = {}): InstallmentLoan => ({
  id: 'l', user_id: 'u', lender_name: 'Banco', amount: 1000000, installment_count: 24, remaining_installments: 21,
  installment_amount: 52000, status: 'active', created_at: now, updated_at: now, ...o,
});

describe('nextInstallment', () => {
  it('derives the next number from the installments already paid', () => {
    expect(nextInstallment(loan())).toEqual({ number: 4, total: 24, amountCents: 52000, remaining: 21 });
  });
  it('starts at 1 when nothing was paid', () => {
    expect(nextInstallment(loan({ remaining_installments: 24 }))?.number).toBe(1);
  });
  it('is null for settled, finished or deleted loans', () => {
    expect(nextInstallment(loan({ status: 'settled' }))).toBeNull();
    expect(nextInstallment(loan({ remaining_installments: 0 }))).toBeNull();
    expect(nextInstallment(loan({ deleted_at: now }))).toBeNull();
  });
});
