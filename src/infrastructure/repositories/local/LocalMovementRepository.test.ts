import { beforeEach, it, expect } from 'vitest';
import { db } from '../../db/db';
import { LocalMovementRepository } from './LocalMovementRepository';
import { LocalIncomeSourceRepository } from './LocalIncomeSourceRepository';
const now = new Date(2026, 9, 8);
const base = { id: '', user_id: 'A', type: 'EXPENSE' as const, amount: 100, date: now, is_recurring: false, distribution_category_id: 'bucket', expense_category_id: 'category' };
beforeEach(async () => {
  await db.delete(); await db.open();
  await db.distribution_categories.put({ id: 'bucket', user_id: 'A', name: 'Ahorro', percentage: 100, is_default: true, is_savings: true, created_at: now, updated_at: now });
  await db.expense_categories.put({ id: 'category', user_id: 'A', distribution_category_id: 'bucket', name: 'Comida', created_at: now, updated_at: now });
});
it('validates money and adjustment motives in the repository', async () => {
  const repo = new LocalMovementRepository();
  await expect(repo.save({ ...base, amount: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow();
  await expect(repo.save({ ...base, is_adjustment: true, distribution_category_id: undefined, description: ' ' })).rejects.toThrow();
  expect(await db.movements.count()).toBe(0);
});
it('blocks ownership changes, invalid relationships and direct edits/deletes of linked movements', async () => {
  const repo = new LocalMovementRepository(); const saved = await repo.save(base);
  await expect(repo.save({ ...saved, user_id: 'B' })).rejects.toThrow(/otra cuenta/);
  await expect(repo.save({ ...base, expense_subcategory_id: 'foreign' })).rejects.toThrow();
  await db.movements.put({ ...saved, is_linked: true });
  await expect(repo.save(saved)).rejects.toThrow(/origen/); await expect(repo.delete(saved.id, 'A')).rejects.toThrow(/origen/);
});
it('requires an owned source for income and prevents deleting associated sources', async () => {
  const income = new LocalIncomeSourceRepository(); const source = await income.save({ id: '', user_id: 'A', name: 'Sueldo', amount: 10000 });
  const repo = new LocalMovementRepository();
  await expect(repo.save({ ...base, type: 'INCOME', distribution_category_id: undefined, expense_category_id: undefined })).rejects.toThrow(/fuente/);
  await repo.save({ ...base, type: 'INCOME', distribution_category_id: undefined, expense_category_id: undefined, income_source_id: source.id });
  await expect(income.delete(source.id)).rejects.toThrow(/asociados/);
});

// --- spec 011: payment accounts and transfers ---
import { LocalPaymentAccountRepository } from './LocalPaymentAccountRepository';
const noCategories = { distribution_category_id: undefined, expense_category_id: undefined };
async function twoAccounts(user = 'A') {
  const accounts = new LocalPaymentAccountRepository();
  const from = await accounts.save({ id: '', user_id: user, name: 'Origen', kind: 'debit', opening_balance: 0 });
  const to = await accounts.save({ id: '', user_id: user, name: 'Destino', kind: 'savings', opening_balance: 0 });
  return { accounts, from, to };
}
it('saves an expense tied to an owned account', async () => {
  const { from } = await twoAccounts();
  const saved = await new LocalMovementRepository().save({ ...base, account_id: from.id });
  expect(saved.account_id).toBe(from.id);
});
it('rejects accounts that belong to another user or were deleted', async () => {
  const repo = new LocalMovementRepository();
  const foreign = await twoAccounts('B');
  await expect(repo.save({ ...base, account_id: foreign.from.id })).rejects.toThrow(/cuenta/i);
  await expect(repo.save({ ...base, account_id: 'missing' })).rejects.toThrow(/cuenta/i);
  const own = await twoAccounts('A');
  await own.accounts.delete(own.from.id);
  await expect(repo.save({ ...base, account_id: own.from.id })).rejects.toThrow(/cuenta/i);
});
it('saves a transfer between two owned accounts without categories', async () => {
  const { from, to } = await twoAccounts();
  const saved = await new LocalMovementRepository().save({ ...base, ...noCategories, type: 'TRANSFER', account_id: from.id, to_account_id: to.id });
  expect(saved).toMatchObject({ type: 'TRANSFER', account_id: from.id, to_account_id: to.id, amount: 100 });
});
it('rejects malformed transfers (same account, missing side, categories, foreign destination, zero amount)', async () => {
  const repo = new LocalMovementRepository();
  const { from, to } = await twoAccounts();
  const foreign = await twoAccounts('B');
  const t = { ...base, ...noCategories, type: 'TRANSFER' as const, account_id: from.id, to_account_id: to.id };
  await expect(repo.save({ ...t, to_account_id: from.id })).rejects.toThrow(/distintas/i);
  await expect(repo.save({ ...t, to_account_id: undefined })).rejects.toThrow(/destino/i);
  await expect(repo.save({ ...t, account_id: undefined })).rejects.toThrow(/origen/i);
  await expect(repo.save({ ...t, distribution_category_id: 'bucket', expense_category_id: 'category' })).rejects.toThrow(/transferencia/i);
  await expect(repo.save({ ...t, to_account_id: foreign.to.id })).rejects.toThrow(/cuenta/i);
  await expect(repo.save({ ...t, amount: 0 })).rejects.toThrow();
  await expect(repo.save({ ...t, is_adjustment: true, description: 'x' })).rejects.toThrow();
  await expect(repo.save({ ...t, is_recurring: true })).rejects.toThrow(/transferencia/i);
  expect(await db.movements.count()).toBe(0);
});
it('rejects a destination account on a non-transfer movement', async () => {
  const { from, to } = await twoAccounts();
  await expect(new LocalMovementRepository().save({ ...base, account_id: from.id, to_account_id: to.id })).rejects.toThrow(/destino/i);
});
