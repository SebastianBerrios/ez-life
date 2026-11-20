import { describe, it, expect } from 'vitest';
import { validateNewCreditCard, validatePaymentAccount } from './validatePaymentAccount';

const ok = { name: 'Visa', kind: 'credit' as const, opening_balance: -15000 };

describe('validatePaymentAccount', () => {
  it('accepts valid accounts, including negative opening balances (credit) without credit_limit', () => {
    expect(() => validatePaymentAccount(ok)).not.toThrow();
    expect(() => validatePaymentAccount({ ...ok, opening_balance: 0 })).not.toThrow();
    expect(() => validatePaymentAccount({ ...ok, credit_limit: 500000, closing_day: 10, payment_day: 15, opening_date: new Date(2026, 10, 10) })).not.toThrow();
  });

  it('rejects empty names, unknown kinds and non-integer / unsafe balances', () => {
    expect(() => validatePaymentAccount({ ...ok, name: '  ' })).toThrow(/nombre/i);
    expect(() => validatePaymentAccount({ ...ok, kind: 'crypto' as never })).toThrow(/tipo/i);
    expect(() => validatePaymentAccount({ ...ok, opening_balance: 10.5 })).toThrow(/saldo/i);
    expect(() => validatePaymentAccount({ ...ok, opening_balance: Number.NaN })).toThrow(/saldo/i);
    expect(() => validatePaymentAccount({ ...ok, opening_balance: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/saldo/i);
  });

  it('rejects credit-only fields on non-credit accounts', () => {
    expect(() => validatePaymentAccount({ name: 'BCP', kind: 'debit', opening_balance: 0, credit_limit: 100000 })).toThrow(/crédito/i);
    expect(() => validatePaymentAccount({ name: 'BCP', kind: 'savings', opening_balance: 0, closing_day: 10 })).toThrow(/crédito/i);
    expect(() => validatePaymentAccount({ name: 'Efectivo', kind: 'cash', opening_balance: 0, payment_day: 15 })).toThrow(/crédito/i);
  });

  it('validates closing_day and payment_day as integers in 1..31', () => {
    expect(() => validatePaymentAccount({ ...ok, closing_day: 0 })).toThrow('Ingresa un día entre 1 y 31.');
    expect(() => validatePaymentAccount({ ...ok, closing_day: 32 })).toThrow('Ingresa un día entre 1 y 31.');
    expect(() => validatePaymentAccount({ ...ok, payment_day: 15.5 })).toThrow('Ingresa un día entre 1 y 31.');
    expect(() => validatePaymentAccount({ ...ok, payment_day: -1 })).toThrow('Ingresa un día entre 1 y 31.');
  });

  it('validates credit_limit > 0 and consumption <= credit_limit when credit_limit is provided', () => {
    expect(() => validatePaymentAccount({ ...ok, credit_limit: 0 })).toThrow('La línea de crédito es obligatoria.');
    expect(() => validatePaymentAccount({ ...ok, credit_limit: -100 })).toThrow('La línea de crédito es obligatoria.');
    expect(() => validatePaymentAccount({ ...ok, opening_balance: -600000, credit_limit: 500000 })).toThrow('El consumo no puede superar la línea de crédito.');
  });
});

describe('validateNewCreditCard', () => {
  it('requires credit_limit on new credit cards and enforces consumption <= credit_limit', () => {
    expect(() => validateNewCreditCard({ name: 'BBVA', kind: 'credit', opening_balance: -80000 })).toThrow('La línea de crédito es obligatoria.');
    expect(() => validateNewCreditCard({ name: 'BBVA', kind: 'credit', opening_balance: -80000, credit_limit: 50000 })).toThrow('El consumo no puede superar la línea de crédito.');
    expect(() => validateNewCreditCard({ name: 'BBVA', kind: 'credit', opening_balance: -80000, credit_limit: 500000, closing_day: 10, payment_day: 15 })).not.toThrow();
    expect(() => validateNewCreditCard({ name: 'BBVA', kind: 'credit', opening_balance: -500000, credit_limit: 500000 })).not.toThrow();
  });
});
