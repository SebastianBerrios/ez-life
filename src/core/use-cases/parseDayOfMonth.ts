import { DomainError } from '../domain/errors/DomainError';

/**
 * Parses an optional day-of-month string (1..31). Empty/blank returns
 * `undefined`; any non-integer or out-of-range input throws `DomainError`.
 */
export function parseDayOfMonth(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (!/^\d+$/.test(trimmed)) {
    throw new DomainError('Ingresa un día entre 1 y 31.');
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 1 || value > 31) {
    throw new DomainError('Ingresa un día entre 1 y 31.');
  }
  return value;
}
