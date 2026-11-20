import { DomainError } from '../domain/errors/DomainError';

export interface OnboardingCardDraft {
  id: string;
  name: string;
  creditLimitCents: number;
  consumedCents: number;
  closingDay?: number;
  paymentDay?: number;
}

function validateOptionalDay(day: number | undefined): void {
  if (day === undefined) return;
  if (!Number.isSafeInteger(day) || day < 1 || day > 31) {
    throw new DomainError('Ingresa un día entre 1 y 31.');
  }
}

export function validateOnboardingCard(draft: OnboardingCardDraft): void {
  if (!draft.name || !draft.name.trim()) {
    throw new DomainError('El nombre de la tarjeta es obligatorio.');
  }
  if (!Number.isSafeInteger(draft.creditLimitCents) || draft.creditLimitCents <= 0) {
    throw new DomainError('La línea de crédito es obligatoria.');
  }
  if (!Number.isSafeInteger(draft.consumedCents) || draft.consumedCents < 0) {
    throw new DomainError('El consumo no puede ser negativo.');
  }
  if (draft.consumedCents > draft.creditLimitCents) {
    throw new DomainError('El consumo no puede superar la línea de crédito.');
  }
  validateOptionalDay(draft.closingDay);
  validateOptionalDay(draft.paymentDay);
}
