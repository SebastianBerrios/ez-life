import { describe, it, expect, beforeEach } from 'vitest';
import { uuidv7 } from 'uuidv7';
import { db } from '../../db/db';
import { LocalPaymentAccountRepository } from './LocalPaymentAccountRepository';
import { LocalOnboardingRepository } from './LocalOnboardingRepository';
import { defaultCashAccountId } from '../../../core/use-cases/defaultPaymentAccount';

const newAccount = (userId: string, name = 'Visa') => ({
  id: '', user_id: userId, name, kind: 'debit' as const, opening_balance: 5000,
});

describe('LocalPaymentAccountRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('saves an account, edits it in place and queues it for sync', async () => {
    const repo = new LocalPaymentAccountRepository();
    const userId = uuidv7();
    const created = await repo.save(newAccount(userId));
    const edited = await repo.save({ ...created, name: 'BCP' });

    expect(edited.id).toBe(created.id);
    expect(edited.created_at).toEqual(created.created_at);
    expect(await repo.getAll(userId)).toHaveLength(1);
    const queued = await db.sync_queue.filter(item => item.table_name === 'payment_accounts').toArray();
    expect(queued.length).toBeGreaterThanOrEqual(1);
    expect(queued.some(item => item.data.id === created.id)).toBe(true);
  });

  it('isolates accounts per user and hides deleted ones', async () => {
    const repo = new LocalPaymentAccountRepository();
    const a = await repo.save(newAccount('A', 'Cuenta A'));
    await repo.save(newAccount('B', 'Cuenta B'));

    expect((await repo.getAll('A')).map(x => x.name)).toEqual(['Cuenta A']);
    await repo.delete(a.id);
    expect(await repo.getAll('A')).toEqual([]);
    expect(await repo.getAll('B')).toHaveLength(1);
  });

  it('rejects invalid accounts and ownership changes', async () => {
    const repo = new LocalPaymentAccountRepository();
    await expect(repo.save({ ...newAccount('A'), name: ' ' })).rejects.toThrow(/nombre/i);
    const saved = await repo.save(newAccount('A'));
    await expect(repo.save({ ...saved, user_id: 'B' })).rejects.toThrow(/otro usuario/);
  });

  it('archives instead of deleting, keeping the row visible with archived=true', async () => {
    const repo = new LocalPaymentAccountRepository();
    const saved = await repo.save(newAccount('A'));
    await repo.archive(saved.id);
    const [row] = await repo.getAll('A');
    expect(row.archived).toBe(true);
    expect(row.deleted_at).toBeUndefined();
  });

  it('blocks deleting an account referenced by movements (origin or destination) and counts them', async () => {
    const repo = new LocalPaymentAccountRepository();
    const from = await repo.save(newAccount('A', 'Origen'));
    const to = await repo.save(newAccount('A', 'Destino'));
    const free = await repo.save(newAccount('A', 'Libre'));
    const now = new Date();
    await db.movements.put({ id: 'm1', user_id: 'A', type: 'TRANSFER', amount: 100, date: now, is_recurring: false, account_id: from.id, to_account_id: to.id, created_at: now, updated_at: now });
    await db.movements.put({ id: 'm2', user_id: 'A', type: 'INCOME', amount: 100, date: now, is_recurring: false, account_id: from.id, deleted_at: now, created_at: now, updated_at: now });

    expect(await repo.countMovements(from.id)).toBe(1); // deleted movements do not count
    expect(await repo.countMovements(to.id)).toBe(1);
    await expect(repo.delete(from.id)).rejects.toThrow(/movimientos/i);
    await expect(repo.delete(to.id)).rejects.toThrow(/archívala/i);
    await repo.delete(free.id);
    expect((await repo.getAll('A')).map(x => x.id).sort()).toEqual([from.id, to.id].sort());
  });

  describe('ensureDefault', () => {
    it('creates the "Efectivo" cash account once, with the stable id', async () => {
      const repo = new LocalPaymentAccountRepository();
      await repo.ensureDefault('A');
      await repo.ensureDefault('A');
      const accounts = await repo.getAll('A');
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({ id: defaultCashAccountId('A'), name: 'Efectivo', kind: 'cash', opening_balance: 0 });
    });

    it('does not recreate it when the user archived or deleted it', async () => {
      const repo = new LocalPaymentAccountRepository();
      await repo.ensureDefault('A');
      await repo.archive(defaultCashAccountId('A'));
      await repo.ensureDefault('A');
      expect(await db.payment_accounts.count()).toBe(1);
      await repo.delete(defaultCashAccountId('A'));
      await repo.ensureDefault('A');
      expect(await db.payment_accounts.count()).toBe(1);
      expect(await repo.getAll('A')).toEqual([]);
    });

    it('is a no-op after the onboarding already created the account with a current balance', async () => {
      await new LocalOnboardingRepository().saveStartingPoint('A', { income: 300000, openingBalance: 80000 });
      const repo = new LocalPaymentAccountRepository();
      await repo.ensureDefault('A');
      const accounts = await repo.getAll('A');
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({ id: defaultCashAccountId('A'), opening_balance: 80000 });
    });

    it('keeps users independent', async () => {
      const repo = new LocalPaymentAccountRepository();
      await repo.ensureDefault('A');
      await repo.ensureDefault('B');
      expect(await repo.getAll('A')).toHaveLength(1);
      expect(await repo.getAll('B')).toHaveLength(1);
    });
  });
});
