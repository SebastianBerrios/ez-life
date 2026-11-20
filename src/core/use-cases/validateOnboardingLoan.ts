import { DomainError } from '../domain/errors/DomainError';

export type OnboardingLoanDraft =
  | {
      id: string;
      lenderName: string;
      hasInstallments: true;
      amountCents: number;
      installmentAmountCents: number;
      installmentCount: number;
      alreadyPaid: number;
      paymentDay?: number;
    }
  | {
      id: string;
      lenderName: string;
      hasInstallments: false;
      pendingAmountCents: number;
    };

export function validateOnboardingLoan(draft: OnboardingLoanDraft): void {
  if (!draft.lenderName || !draft.lenderName.trim()) {
    throw new DomainError('Ingresa la entidad o persona.');
  }

  if (!draft.hasInstallments) {
    if (!Number.isSafeInteger(draft.pendingAmountCents) || draft.pendingAmountCents <= 0) {
      throw new DomainError('El saldo pendiente debe ser mayor a cero.');
    }
    return;
  }

  if (!Number.isSafeInteger(draft.amountCents) || draft.amountCents <= 0) {
    throw new DomainError('El monto del préstamo debe ser mayor a cero.');
  }
  if (!Number.isSafeInteger(draft.installmentAmountCents) || draft.installmentAmountCents <= 0) {
    throw new DomainError('El monto de la cuota debe ser mayor a cero.');
  }
  if (!Number.isSafeInteger(draft.installmentCount) || draft.installmentCount < 1) {
    throw new DomainError('Las cuotas totales deben ser al menos 1.');
  }
  if (!Number.isSafeInteger(draft.alreadyPaid) || draft.alreadyPaid < 0) {
    throw new DomainError('Las cuotas pagadas no pueden ser negativas.');
  }
  if (draft.alreadyPaid > draft.installmentCount) {
    throw new DomainError('Las cuotas pagadas no pueden superar las cuotas totales.');
  }
  if (draft.paymentDay !== undefined) {
    if (!Number.isSafeInteger(draft.paymentDay) || draft.paymentDay < 1 || draft.paymentDay > 31) {
      throw new DomainError('Ingresa un día entre 1 y 31.');
    }
  }
}
