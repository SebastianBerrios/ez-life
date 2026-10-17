import { describe, it, expect } from 'vitest';
import { validatePaymentAccount } from './validatePaymentAccount';

const ok = { name: 'Visa', kind: 'credit' as const, opening_balance: -15000 };

describe('validatePaymentAccount', () => {
  it('accepts valid accounts, including negative opening balances (credit)', () => {
    expect(() => validatePaymentAccount(ok)).not.toThrow();
    expect(() => validatePaymentAccount({ ...ok, opening_balance: 0 })).not.toThrow();
  });
  it('rejects empty names, unknown kinds and non-integer / unsafe balances', () => {
    expect(() => validatePaymentAccount({ ...ok, name: '  ' })).toThrow(/nombre/i);
    expect(() => validatePaymentAccount({ ...ok, kind: 'crypto' as never })).toThrow(/tipo/i);
    expect(() => validatePaymentAccount({ ...ok, opening_balance: 10.5 })).toThrow(/saldo/i);
    expect(() => validatePaymentAccount({ ...ok, opening_balance: Number.NaN })).toThrow(/saldo/i);
    expect(() => validatePaymentAccount({ ...ok, opening_balance: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/saldo/i);
  });
});
