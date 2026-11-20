import { describe, it, expect } from 'vitest';
import {
  formatCreditCardPhrase,
  formatInformalDebtPhrase,
  formatInstallmentLoanPhrase,
  formatRuleBucketPhrase,
} from './formatFinancesPhrases';

describe('formatRuleBucketPhrase', () => {
  it('formats expense buckets within budget, exceeded, and without budget', () => {
    expect(
      formatRuleBucketPhrase({
        name: 'Deseos',
        spent: 13000,
        budget: 63000,
        remaining: 50000,
        status: 'ok',
      }),
    ).toBe('Llevas S/ 130.00 de S/ 630.00 en deseos');

    expect(
      formatRuleBucketPhrase({
        name: 'Deseos',
        spent: 65000,
        budget: 63000,
        remaining: -2000,
        status: 'over',
      }),
    ).toBe('Te pasaste S/ 20.00 en deseos');

    expect(
      formatRuleBucketPhrase({
        name: 'Necesidades',
        spent: 13000,
        budget: 0,
        remaining: -13000,
        status: 'ok',
      }),
    ).toBe('Llevas S/ 130.00 en necesidades');
  });

  it('formats savings buckets in progress, met, exceeded, and without budget', () => {
    expect(
      formatRuleBucketPhrase(
        { name: 'Ahorro', spent: 15000, budget: 42000, remaining: 27000, status: 'ok' },
        true,
      ),
    ).toBe('Ahorraste S/ 150.00 de S/ 420.00');

    expect(
      formatRuleBucketPhrase(
        { name: 'Ahorro', spent: 42000, budget: 42000, remaining: 0, status: 'over' },
        true,
      ),
    ).toBe('Ahorraste S/ 420.00 · meta cumplida');

    expect(
      formatRuleBucketPhrase(
        { name: 'Ahorro', spent: 50000, budget: 42000, remaining: -8000, status: 'over' },
        true,
      ),
    ).toBe('Ahorraste S/ 500.00 · superaste tu meta de S/ 420.00');

    expect(
      formatRuleBucketPhrase(
        { name: 'Ahorro', spent: 15000, budget: 0, remaining: -15000, status: 'ok' },
        true,
      ),
    ).toBe('Ahorraste S/ 150.00');
  });
});

describe('formatInstallmentLoanPhrase', () => {
  it('handles singular, plural, missing payment_day, and settled loans', () => {
    expect(
      formatInstallmentLoanPhrase({ status: 'active', remaining_installments: 8, payment_day: 15 }),
    ).toBe('Te faltan 8 cuotas · próxima el 15');

    expect(
      formatInstallmentLoanPhrase({ status: 'active', remaining_installments: 1, payment_day: 15 }),
    ).toBe('Te falta 1 cuota · próxima el 15');

    expect(
      formatInstallmentLoanPhrase({ status: 'active', remaining_installments: 3 }),
    ).toBe('Te faltan 3 cuotas');

    expect(
      formatInstallmentLoanPhrase({ status: 'settled', remaining_installments: 0, payment_day: 15 }),
    ).toBe('Préstamo saldado');
  });
});

describe('formatInformalDebtPhrase', () => {
  it('formats borrowed, lent, and settled debts', () => {
    expect(
      formatInformalDebtPhrase({
        direction: 'borrowed',
        counterparty_name: 'Juan',
        amount: 12000,
        settled_amount: 0,
      }),
    ).toBe('Le debes S/ 120.00 a Juan');

    expect(
      formatInformalDebtPhrase({
        direction: 'lent',
        counterparty_name: 'Juan',
        amount: 10000,
        settled_amount: 2000,
      }),
    ).toBe('Juan te debe S/ 80.00');

    expect(
      formatInformalDebtPhrase({
        direction: 'borrowed',
        counterparty_name: 'Juan',
        amount: 10000,
        settled_amount: 10000,
      }),
    ).toBe('Saldado con Juan');
  });
});

describe('formatCreditCardPhrase', () => {
  it('formats cards with and without credit limit', () => {
    expect(
      formatCreditCardPhrase({ owedCents: 45000, creditLimitCents: 200000, paymentDay: 15 }),
    ).toBe('Usaste S/ 450.00 de S/ 2,000.00 · Pagas el 15');

    expect(formatCreditCardPhrase({ owedCents: 45000 })).toBe('Debes S/ 450.00');
  });
});
