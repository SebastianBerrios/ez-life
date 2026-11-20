import { DomainError } from '../domain/errors/DomainError';
import type { RegistrationKind } from '../domain/models/types';

const VALID_KINDS: readonly RegistrationKind[] = ['income', 'recurrence', 'installment', 'card'];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface ParsedItemKey {
  kind: RegistrationKind;
  refId: string;
  month: string;
}

/**
 * Builds the canonical identifier for a "Por registrar" item, its skip row and
 * its `register_due` notification: `<kind>:<refId>:<YYYY-MM>`.
 * `refId` cannot contain `:` so `parseItemKey` is unambiguously invertible.
 */
export function registrationItemKey(kind: RegistrationKind, refId: string, month: string): string {
  if (!VALID_KINDS.includes(kind)) {
    throw new DomainError('El tipo de recordatorio no es válido.');
  }
  const cleanRef = refId.trim();
  if (!cleanRef || cleanRef.includes(':')) {
    throw new DomainError('El identificador del recordatorio no es válido.');
  }
  if (!MONTH_PATTERN.test(month)) {
    throw new DomainError('El mes del recordatorio no es válido.');
  }
  return `${kind}:${cleanRef}:${month}`;
}

export function parseItemKey(key: string): ParsedItemKey {
  const parts = key.split(':');
  if (parts.length !== 3) {
    throw new DomainError('La clave del recordatorio no es válida.');
  }
  const [kind, refId, month] = parts;
  if (!VALID_KINDS.includes(kind as RegistrationKind) || !refId || !MONTH_PATTERN.test(month)) {
    throw new DomainError('La clave del recordatorio no es válida.');
  }
  return { kind: kind as RegistrationKind, refId, month };
}
