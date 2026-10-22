import { DomainError } from '../domain/errors/DomainError';
import { parseMoney } from './parseMoney';

/**
 * Current balance typed in onboarding step 1 -> integer cents. Empty means 0. It is the money the user
 * holds today, so it can never be negative (unlike a credit account's opening balance).
 */
export function parseCurrentBalance(raw: string): number {
  const value = raw.trim();
  if (value === '') return 0;
  if (value.startsWith('-')) throw new DomainError('El saldo actual no puede ser negativo.');
  return parseMoney(value);
}
