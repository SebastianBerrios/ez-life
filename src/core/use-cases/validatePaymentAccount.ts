import { DomainError } from '../domain/errors/DomainError';
import type { PaymentAccountKind } from '../domain/models/types';

const KINDS: readonly PaymentAccountKind[] = ['debit', 'credit', 'cash', 'savings'];

export interface PaymentAccountInput {
  name: string;
  kind: PaymentAccountKind;
  opening_balance: number; // integer cents, may be negative (e.g. credit card debt)
}

export function validatePaymentAccount(input: PaymentAccountInput): void {
  if (!input.name || !input.name.trim()) throw new DomainError('El nombre de la cuenta es obligatorio.');
  if (!KINDS.includes(input.kind)) throw new DomainError('El tipo de cuenta no es válido.');
  if (!Number.isSafeInteger(input.opening_balance)) throw new DomainError('El saldo inicial debe ser un entero de céntimos.');
}
