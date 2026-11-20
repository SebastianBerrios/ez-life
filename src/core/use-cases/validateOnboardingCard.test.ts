import { describe, it, expect } from 'vitest';
import { validateOnboardingCard, type OnboardingCardDraft } from './validateOnboardingCard';
import { DomainError } from '../domain/errors/DomainError';

const valid: OnboardingCardDraft = {
  id: 'card-1',
  name: 'BBVA',
  creditLimitCents: 500000,
  consumedCents: 80000,
  closingDay: 10,
  paymentDay: 15,
};

describe('validateOnboardingCard', () => {
  it('accepts a valid card with optional days omitted or present', () => {
    expect(() => validateOnboardingCard(valid)).not.toThrow();
    expect(() => validateOnboardingCard({ ...valid, consumedCents: 0, closingDay: undefined, paymentDay: undefined })).not.toThrow();
    expect(() => validateOnboardingCard({ ...valid, consumedCents: 500000 })).not.toThrow();
  });

  it('requires name and credit limit > 0', () => {
    expect(() => validateOnboardingCard({ ...valid, name: '   ' })).toThrow(DomainError);
    expect(() => validateOnboardingCard({ ...valid, creditLimitCents: 0 })).toThrow('La línea de crédito es obligatoria.');
    expect(() => validateOnboardingCard({ ...valid, creditLimitCents: -100 })).toThrow('La línea de crédito es obligatoria.');
  });

  it('rejects negative consumption or consumption exceeding the credit limit', () => {
    expect(() => validateOnboardingCard({ ...valid, consumedCents: -1 })).toThrow(DomainError);
    expect(() => validateOnboardingCard({ ...valid, consumedCents: 500001 })).toThrow('El consumo no puede superar la línea de crédito.');
  });

  it('validates closingDay and paymentDay as integers in 1..31', () => {
    expect(() => validateOnboardingCard({ ...valid, closingDay: 0 })).toThrow('Ingresa un día entre 1 y 31.');
    expect(() => validateOnboardingCard({ ...valid, closingDay: 32 })).toThrow('Ingresa un día entre 1 y 31.');
    expect(() => validateOnboardingCard({ ...valid, paymentDay: 15.5 })).toThrow('Ingresa un día entre 1 y 31.');
  });
});
