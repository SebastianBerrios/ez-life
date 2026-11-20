import { beforeEach, it, expect, vi } from 'vitest';
import { db } from '../../db/db';
import { LocalOnboardingRepository } from './LocalOnboardingRepository';
import { LocalProfileRepository } from './LocalProfileRepository';
import { defaultCashAccountId } from '../../../core/use-cases/defaultPaymentAccount';
beforeEach(async () => { await db.delete(); await db.open(); vi.restoreAllMocks(); });
const start = (income = 10000, openingBalance = 0) => ({ income, openingBalance });
it('atomically persists completed income step and retries without duplicate sources', async () => {
  const repo = new LocalOnboardingRepository(); await repo.saveStartingPoint('A', start()); await repo.saveStartingPoint('A', start());
  expect(await db.income_sources.count()).toBe(1); expect(await repo.progress('A')).toBe(1);
  expect((await db.profiles.get('A'))?.onboarding_income_source_id).toBe((await db.income_sources.toArray())[0].id);
});
it('rolls back initial income and account if persisting the step fails', async () => {
  vi.spyOn(LocalProfileRepository.prototype, 'save').mockRejectedValue(new Error('failed'));
  await expect(new LocalOnboardingRepository().saveStartingPoint('A', start(10000, 80000))).rejects.toThrow();
  expect(await db.income_sources.count()).toBe(0); expect(await db.payment_accounts.count()).toBe(0); expect(await db.sync_queue.count()).toBe(0);
});
it('does not infer completed distribution when an explicit income-only step was saved', async () => {
  await new LocalOnboardingRepository().saveStartingPoint('A', start());
  await db.distribution_categories.put({ id: 'bucket', user_id: 'A', name: 'Ahorro', percentage: 100, is_default: true, is_savings: true, created_at: new Date(), updated_at: new Date() });
  expect(await new LocalOnboardingRepository().progress('A')).toBe(1);
});
it('creates the "Efectivo" account with the current balance as its opening balance', async () => {
  await new LocalOnboardingRepository().saveStartingPoint('A', start(300000, 80000));
  const account = await db.payment_accounts.get(defaultCashAccountId('A'));
  expect(account).toMatchObject({ user_id: 'A', name: 'Efectivo', kind: 'cash', opening_balance: 80000 });
  expect(await db.payment_accounts.count()).toBe(1);
  expect((await db.income_sources.toArray())[0].amount).toBe(300000);
});
it('defaults the opening balance to zero and queues the new account for sync', async () => {
  await new LocalOnboardingRepository().saveStartingPoint('A', start());
  expect((await db.payment_accounts.get(defaultCashAccountId('A')))?.opening_balance).toBe(0);
  expect((await db.sync_queue.toArray()).some(item => item.table_name === 'payment_accounts')).toBe(true);
});
it('is idempotent: retrying never duplicates the account nor overwrites its balance', async () => {
  const repo = new LocalOnboardingRepository();
  await repo.saveStartingPoint('A', start(300000, 80000));
  await repo.saveStartingPoint('A', start(300000, 99900));
  expect(await db.payment_accounts.count()).toBe(1);
  expect((await db.payment_accounts.get(defaultCashAccountId('A')))?.opening_balance).toBe(80000);
});
it('never modifies an existing "Efectivo" account, even an archived or soft-deleted one', async () => {
  const id = defaultCashAccountId('A'); const now = new Date();
  await db.payment_accounts.put({ id, user_id: 'A', name: 'Efectivo', kind: 'cash', opening_balance: 5000, archived: true, deleted_at: now, created_at: now, updated_at: now });
  await new LocalOnboardingRepository().saveStartingPoint('A', start(300000, 80000));
  expect(await db.payment_accounts.get(id)).toMatchObject({ opening_balance: 5000, archived: true });
  expect((await db.payment_accounts.get(id))?.deleted_at).toBeTruthy();
});
it('rejects a negative or non integer opening balance without writing anything', async () => {
  const repo = new LocalOnboardingRepository();
  await expect(repo.saveStartingPoint('A', start(10000, -1))).rejects.toThrow();
  await expect(repo.saveStartingPoint('A', start(10000, 10.5))).rejects.toThrow();
  expect(await db.income_sources.count()).toBe(0); expect(await db.payment_accounts.count()).toBe(0); expect(await db.profiles.count()).toBe(0);
});
it('rejects an invalid income before touching the account', async () => {
  await expect(new LocalOnboardingRepository().saveStartingPoint('A', start(0, 80000))).rejects.toThrow();
  expect(await db.payment_accounts.count()).toBe(0);
});

it('v2 saveIncome saves income, pay_day, received_month, balance_since and onboarding_version atomically and idempotently', async () => {
  const repo = new LocalOnboardingRepository();
  const now = new Date(2026, 10, 10, 12, 0);

  await repo.saveIncome('u1', { income: 300000, payDay: 28, receivedThisMonth: true, now });
  await repo.saveIncome('u1', { income: 320000, payDay: 28, receivedThisMonth: false, now });

  expect(await db.income_sources.count()).toBe(1);
  const [source] = await db.income_sources.toArray();
  expect(source).toMatchObject({ amount: 320000, pay_day: 28, received_month: undefined });
  const profile = await db.profiles.get('u1');
  expect(profile).toMatchObject({ onboarding_step: 1, onboarding_version: 2, balance_since: '2026-11' });
  expect(await db.movements.count()).toBe(0);
});

it('v2 saveAccounts always creates Efectivo, creates banks idempotently with opening_date, and handles declareNoBanks', async () => {
  const repo = new LocalOnboardingRepository();
  const now = new Date(2026, 10, 10, 12, 0);

  await repo.saveAccounts('u1', {
    cash: 10000,
    banks: [
      { id: 'bank-1', name: 'BCP', kind: 'debit', balance: 150000 },
      { id: 'bank-2', name: 'Ahorros', kind: 'savings', balance: 50000 },
    ],
    now,
  });
  // Retry with same draft IDs does not duplicate
  await repo.saveAccounts('u1', {
    cash: 99999,
    banks: [{ id: 'bank-1', name: 'BCP', kind: 'debit', balance: 150000 }],
    now,
  });

  const accounts = await db.payment_accounts.where('user_id').equals('u1').toArray();
  expect(accounts).toHaveLength(3);
  expect(await db.payment_accounts.get(defaultCashAccountId('u1'))).toMatchObject({
    name: 'Efectivo', kind: 'cash', opening_balance: 10000,
  });
  expect((await db.payment_accounts.get('bank-1'))?.opening_date).toBeInstanceOf(Date);
  expect(await repo.progress('u1')).toBe(2);
  expect(await db.movements.count()).toBe(0);

  // declareNoBanks with cash 100 -> saves Efectivo 10000 and marks 'accounts' not applicable without duplicating on retry
  await repo.saveAccounts('u2', { cash: 10000, banks: [], declareNoBanks: true, now });
  await repo.saveAccounts('u2', { cash: 10000, banks: [], declareNoBanks: true, now });
  expect((await db.payment_accounts.get(defaultCashAccountId('u2')))?.opening_balance).toBe(10000);
  expect((await db.profiles.get('u2'))?.checklist_not_applicable).toEqual(['accounts']);

  // declareNoBanks with non-empty banks -> rejects without writing
  await expect(repo.saveAccounts('u3', {
    cash: 0,
    banks: [{ id: 'b3', name: 'BBVA', kind: 'debit', balance: 1000 }],
    declareNoBanks: true,
    now,
  })).rejects.toThrow();
  expect(await db.payment_accounts.where('user_id').equals('u3').count()).toBe(0);

  // Negative balance -> rejects with exact copy
  await expect(repo.saveAccounts('u4', { cash: -100, banks: [], now })).rejects.toThrow('El saldo no puede ser negativo.');
  await expect(repo.saveAccounts('u4', {
    cash: 0,
    banks: [{ id: 'b4', name: 'BCP', kind: 'debit', balance: -1 }],
    now,
  })).rejects.toThrow('El saldo no puede ser negativo.');
});

it('v2 saveCards creates credit cards idempotently without movements, and declareNotApplicable/skipStep work atomically', async () => {
  const repo = new LocalOnboardingRepository();
  const now = new Date(2026, 10, 10, 12, 0);

  await repo.saveCards('u1', [{
    id: 'card-1', name: 'BBVA', creditLimitCents: 500000, consumedCents: 80000, closingDay: 10, paymentDay: 15,
  }], now);
  await repo.saveCards('u1', [{
    id: 'card-1', name: 'BBVA', creditLimitCents: 500000, consumedCents: 80000, closingDay: 10, paymentDay: 15,
  }], now);

  expect(await db.payment_accounts.where('user_id').equals('u1').count()).toBe(1);
  expect(await db.payment_accounts.get('card-1')).toMatchObject({
    kind: 'credit', opening_balance: -80000, credit_limit: 500000, closing_day: 10, payment_day: 15,
  });
  expect(await repo.progress('u1')).toBe(3);

  await repo.declareNotApplicable('u2', 'cards');
  await repo.declareNotApplicable('u2', 'cards');
  await repo.declareNotApplicable('u2', 'loans');
  expect((await db.profiles.get('u2'))?.checklist_not_applicable).toEqual(['cards', 'loans']);
  expect(await repo.progress('u2')).toBe(4);

  await repo.skipStep('u3', 3);
  expect(await repo.progress('u3')).toBe(3);
  expect((await db.profiles.get('u3'))?.checklist_not_applicable).toBeUndefined();
  expect(await db.movements.count()).toBe(0);
});

it('v2 saveLoans creates installment loans (with alreadyPaid) and informal borrowed debts without movements, idempotently', async () => {
  const repo = new LocalOnboardingRepository();
  const now = new Date(2026, 10, 10, 12, 0);

  const drafts = [
    { id: 'loan-1', lenderName: 'BCP', hasInstallments: true as const, amountCents: 1200000, installmentAmountCents: 100000, installmentCount: 12, alreadyPaid: 6, paymentDay: 5 },
    { id: 'debt-1', lenderName: 'Carlos', hasInstallments: false as const, pendingAmountCents: 30000 },
  ];
  await repo.saveLoans('u1', drafts, now);
  await repo.saveLoans('u1', drafts, now);

  expect(await db.installment_loans.where('user_id').equals('u1').count()).toBe(1);
  expect(await db.installment_loans.get('loan-1')).toMatchObject({
    remaining_installments: 6, status: 'active', payment_day: 5,
  });
  expect(await db.debts.where('user_id').equals('u1').count()).toBe(1);
  expect(await db.debts.get('debt-1')).toMatchObject({
    direction: 'borrowed', origin: 'manual', amount: 30000, settled_amount: 0,
  });
  expect(await db.installment_payments.count()).toBe(0);
  expect(await db.movements.count()).toBe(0);
  expect(await repo.progress('u1')).toBe(4);
});

it('maps legacy v1 profiles end-to-end via resolveOnboardingProgress without losing progress', async () => {
  const repo = new LocalOnboardingRepository();
  const now = new Date();
  await db.profiles.put({ id: 'v1-0', onboarding_step: 0, created_at: now, updated_at: now });
  await db.profiles.put({ id: 'v1-1', onboarding_step: 1, created_at: now, updated_at: now });
  await db.profiles.put({ id: 'v1-2', onboarding_step: 2, created_at: now, updated_at: now });
  await db.profiles.put({ id: 'v1-3', onboarding_step: 3, created_at: now, updated_at: now });

  expect(await repo.progress('v1-0')).toBe(0);
  expect(await repo.progress('v1-1')).toBe(1);
  expect(await repo.progress('v1-2')).toBe(5);
  expect(await repo.progress('v1-3')).toBe(6);
});

it('does not write a stub profile or queue sync when progress() runs on an empty fresh device', async () => {
  const repo = new LocalOnboardingRepository();
  expect(await repo.progress('fresh-user')).toBe(0);
  expect(await db.profiles.get('fresh-user')).toBeUndefined();
  expect(await db.sync_queue.count()).toBe(0);
});
