import { describe, it, expect } from 'vitest';
import { validateOnboardingLoan, type OnboardingLoanDraft } from './validateOnboardingLoan';
import { DomainError } from '../domain/errors/DomainError';

const validInstallment: OnboardingLoanDraft = {
  id: 'loan-1',
  lenderName: 'BCP',
  hasInstallments: true,
  amountCents: 1200000,
  installmentAmountCents: 100000,
  installmentCount: 12,
  alreadyPaid: 6,
  paymentDay: 5,
};

const validInformal: OnboardingLoanDraft = {
  id: 'debt-1',
  lenderName: 'Carlos',
  hasInstallments: false,
  pendingAmountCents: 25000,
};

describe('validateOnboardingLoan', () => {
  it('accepts valid installment and informal loans (including alreadyPaid === installmentCount)', () => {
    expect(() => validateOnboardingLoan(validInstallment)).not.toThrow();
    expect(() => validateOnboardingLoan({ ...validInstallment, alreadyPaid: 0, paymentDay: undefined })).not.toThrow();
    expect(() => validateOnboardingLoan({ ...validInstallment, alreadyPaid: 12 })).not.toThrow();
    expect(() => validateOnboardingLoan(validInformal)).not.toThrow();
  });

  it('requires lender/person name for both types', () => {
    expect(() => validateOnboardingLoan({ ...validInstallment, lenderName: '  ' })).toThrow(DomainError);
    expect(() => validateOnboardingLoan({ ...validInformal, lenderName: '' })).toThrow(DomainError);
  });

  it('validates installment loan numeric bounds and paymentDay', () => {
    expect(() => validateOnboardingLoan({ ...validInstallment, amountCents: 0 })).toThrow(DomainError);
    expect(() => validateOnboardingLoan({ ...validInstallment, installmentAmountCents: 0 })).toThrow(DomainError);
    expect(() => validateOnboardingLoan({ ...validInstallment, installmentCount: 0 })).toThrow(DomainError);
    expect(() => validateOnboardingLoan({ ...validInstallment, alreadyPaid: -1 })).toThrow(DomainError);
    expect(() => validateOnboardingLoan({ ...validInstallment, alreadyPaid: 13 })).toThrow('Las cuotas pagadas no pueden superar las cuotas totales.');
    expect(() => validateOnboardingLoan({ ...validInstallment, paymentDay: 0 })).toThrow('Ingresa un día entre 1 y 31.');
    expect(() => validateOnboardingLoan({ ...validInstallment, paymentDay: 32 })).toThrow('Ingresa un día entre 1 y 31.');
  });

  it('requires pendingAmountCents > 0 for informal loans', () => {
    expect(() => validateOnboardingLoan({ ...validInformal, pendingAmountCents: 0 })).toThrow(DomainError);
    expect(() => validateOnboardingLoan({ ...validInformal, pendingAmountCents: -500 })).toThrow(DomainError);
  });
});
