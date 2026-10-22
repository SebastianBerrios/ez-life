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
