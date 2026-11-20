import { describe, it, expect } from 'vitest';
import { selectCardOwed } from './selectCardOwed';
import type { MonthBalance } from '../domain/models/types';

describe('selectCardOwed', () => {
  it('maps every card accountId to its owed cents, including zero-owed cards', () => {
    const balance: MonthBalance = {
      opening: 0, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 0, savingsNet: 0,
      cards: [
        { accountId: 'c1', name: 'BBVA', owed: 80000, previousDebt: 80000, creditLimit: 500000, paymentDay: 15 },
        { accountId: 'c2', name: 'BCP', owed: 0, previousDebt: 0, creditLimit: 300000, paymentDay: 20 },
      ],
    };
    expect(selectCardOwed(balance)).toEqual({ c1: 80000, c2: 0 });
  });
});
