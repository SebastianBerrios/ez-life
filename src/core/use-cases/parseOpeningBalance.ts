import { DomainError } from '../domain/errors/DomainError';
import type { PaymentAccountKind } from '../domain/models/types';
import { parseMoney } from './parseMoney';

/**
 * Opening balance typed in the account form -> integer cents. Empty means 0. Only a credit account
 * may start negative (debt already owed), written with a leading "-".
 */
export function parseOpeningBalance(raw: string, kind: PaymentAccountKind): number {
  const value = raw.trim();
  if (value === '') return 0;
  const negative = value.startsWith('-');
  const cents = parseMoney(negative ? value.slice(1).trim() : value);
  if (!negative || cents === 0) return cents;
  if (kind !== 'credit') throw new DomainError('Solo una cuenta de crédito puede empezar con saldo negativo.');
  return -cents;
}
