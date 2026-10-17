import { describe, it, expect } from 'vitest';
import type { PaymentAccount } from '../domain/models/types';
import { defaultCashAccountId } from './defaultPaymentAccount';
import { canArchiveAccount, canTransfer, defaultTransferPair, selectTransferAccount, swapTransferPair, usableAccounts } from './transferAccounts';

const now = new Date(2026, 9, 16);
const acc = (id: string, extra: Partial<PaymentAccount> = {}): PaymentAccount => ({
  id, user_id: 'u', name: id, kind: 'debit', opening_balance: 0, created_at: now, updated_at: now, ...extra,
});

describe('usableAccounts / canTransfer', () => {
  it('drops archived and deleted accounts unless kept', () => {
    const list = [acc('a'), acc('b', { archived: true }), acc('c', { deleted_at: now })];
    expect(usableAccounts(list).map(a => a.id)).toEqual(['a']);
    expect(usableAccounts(list, 'b').map(a => a.id)).toEqual(['a', 'b']);
  });
  it('needs two usable accounts', () => {
    expect(canTransfer([acc('a')])).toBe(false);
    expect(canTransfer([acc('a'), acc('b', { archived: true })])).toBe(false);
    expect(canTransfer([acc('a'), acc('b')])).toBe(true);
  });
});

describe('defaultTransferPair', () => {
  it('is null with fewer than two accounts', () => {
    expect(defaultTransferPair([acc('a')], 'u')).toBeNull();
  });
  it('starts from the Efectivo account of the user', () => {
    const cash = defaultCashAccountId('u');
    expect(defaultTransferPair([acc('bank'), acc(cash)], 'u')).toEqual({ fromId: cash, toId: 'bank' });
  });
  it('falls back to the first two accounts', () => {
    expect(defaultTransferPair([acc('a'), acc('b'), acc('c')], 'u')).toEqual({ fromId: 'a', toId: 'b' });
  });
});

describe('selectTransferAccount / swapTransferPair', () => {
  const pair = { fromId: 'a', toId: 'b' };
  it('sets one side at a time', () => {
    expect(selectTransferAccount(pair, 'from', 'c')).toEqual({ fromId: 'c', toId: 'b' });
    expect(selectTransferAccount(pair, 'to', 'c')).toEqual({ fromId: 'a', toId: 'c' });
  });
  it('swaps instead of repeating the same account on both sides', () => {
    expect(selectTransferAccount(pair, 'from', 'b')).toEqual({ fromId: 'b', toId: 'a' });
    expect(selectTransferAccount(pair, 'to', 'a')).toEqual({ fromId: 'b', toId: 'a' });
  });
  it('swaps the pair on demand', () => {
    expect(swapTransferPair(pair)).toEqual({ fromId: 'b', toId: 'a' });
  });
});

describe('canArchiveAccount', () => {
  it('keeps at least one usable account', () => {
    expect(canArchiveAccount([acc('a')], 'a')).toBe(false);
    expect(canArchiveAccount([acc('a'), acc('b')], 'a')).toBe(true);
  });
  it('does not offer to archive an account that is already archived or unknown', () => {
    expect(canArchiveAccount([acc('a'), acc('b', { archived: true })], 'b')).toBe(false);
    expect(canArchiveAccount([acc('a'), acc('b')], 'zzz')).toBe(false);
  });
});
