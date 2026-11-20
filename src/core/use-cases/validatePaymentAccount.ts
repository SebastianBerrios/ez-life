import { DomainError } from '../domain/errors/DomainError';
import type { PaymentAccountKind } from '../domain/models/types';

const KINDS: readonly PaymentAccountKind[] = ['debit', 'credit', 'cash', 'savings'];

export interface PaymentAccountInput {
  name: string;
  kind: PaymentAccountKind;
  opening_balance: number; // integer cents, may be negative (e.g. credit card debt)
  credit_limit?: number;
  closing_day?: number;
  payment_day?: number;
  opening_date?: Date;
}

function validateDay(day: number | undefined): void {
  if (day === undefined) return;
  if (!Number.isSafeInteger(day) || day < 1 || day > 31) {
    throw new DomainError('Ingresa un día entre 1 y 31.');
  }
}

export function validatePaymentAccount(input: PaymentAccountInput): void {
  if (!input.name || !input.name.trim()) throw new DomainError('El nombre de la cuenta es obligatorio.');
  if (!KINDS.includes(input.kind)) throw new DomainError('El tipo de cuenta no es válido.');
  if (!Number.isSafeInteger(input.opening_balance)) throw new DomainError('El saldo inicial debe ser un entero de céntimos.');

  if (input.opening_date !== undefined) {
    if (!(input.opening_date instanceof Date) || !Number.isFinite(input.opening_date.getTime())) {
      throw new DomainError('La fecha de apertura no es válida.');
    }
  }

  if (input.kind !== 'credit') {
    if (input.credit_limit !== undefined || input.closing_day !== undefined || input.payment_day !== undefined) {
      throw new DomainError('Los datos de crédito solo aplican a tarjetas de crédito.');
    }
    return;
  }

  if (input.credit_limit !== undefined) {
    if (!Number.isSafeInteger(input.credit_limit) || input.credit_limit <= 0) {
      throw new DomainError('La línea de crédito es obligatoria.');
    }
    if (-input.opening_balance > input.credit_limit) {
      throw new DomainError('El consumo no puede superar la línea de crédito.');
    }
  }

  validateDay(input.closing_day);
  validateDay(input.payment_day);
}

/**
 * Validates a brand-new credit card (FR-024): credit_limit is mandatory (> 0)
 * and initial consumption (-opening_balance) cannot exceed credit_limit.
 * Existing cards edited without a credit_limit remain valid via `validatePaymentAccount` (FR-035).
 */
export function validateNewCreditCard(input: PaymentAccountInput): void {
  validatePaymentAccount(input);
  if (input.kind !== 'credit') return;
  if (input.credit_limit === undefined || !Number.isSafeInteger(input.credit_limit) || input.credit_limit <= 0) {
    throw new DomainError('La línea de crédito es obligatoria.');
  }
  if (-input.opening_balance > input.credit_limit) {
    throw new DomainError('El consumo no puede superar la línea de crédito.');
  }
}
