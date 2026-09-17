import { DomainError } from '../domain/errors/DomainError';

/**
 * Validates a movement/goal amount already expressed in integer cents.
 * Rejects NaN, non-finite values, non-integers, and values <= 0.
 */
export function validateMovementAmount(amountInCents: number): void {
  if (Number.isNaN(amountInCents) || !Number.isFinite(amountInCents)) {
    throw new DomainError('El monto ingresado no es válido.');
  }

  if (!Number.isInteger(amountInCents)) {
    throw new DomainError('El monto debe ser un número entero de céntimos.');
  }

  if (amountInCents <= 0) {
    throw new DomainError('El monto debe ser mayor a 0.');
  }
}
