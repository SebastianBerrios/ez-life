import { db } from '../../db/db';
import { IPaymentAccountRepository } from '../../../core/domain/repositories/IRepositories';
import { PaymentAccount, UUID } from '../../../core/domain/models/types';
import { DomainError } from '../../../core/domain/errors/DomainError';
import { validatePaymentAccount } from '../../../core/use-cases/validatePaymentAccount';
import { buildDefaultCashAccount, defaultCashAccountId } from '../../../core/use-cases/defaultPaymentAccount';
import { uuidv7 } from 'uuidv7';

export class LocalPaymentAccountRepository implements IPaymentAccountRepository {
  async getAll(userId: UUID): Promise<PaymentAccount[]> {
    const rows = await db.payment_accounts.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
    return rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.getTime() - b.created_at.getTime());
  }

  async save(data: Omit<PaymentAccount, 'created_at' | 'updated_at'>): Promise<PaymentAccount> {
    validatePaymentAccount(data);
    return db.transaction('rw', [db.payment_accounts, db.sync_queue], async () => {
      const now = new Date();
      const id = data.id || uuidv7();
      const existing = await db.payment_accounts.get(id);
      if (existing && existing.user_id !== data.user_id) throw new DomainError('La cuenta pertenece a otro usuario.');
      if (existing?.deleted_at) throw new DomainError('La cuenta fue eliminada.');
      const account: PaymentAccount = existing
        ? { ...existing, ...data, id, name: data.name.trim(), updated_at: now }
        : { ...data, id, name: data.name.trim(), created_at: now, updated_at: now };
      await db.payment_accounts.put(account);
      return account;
    });
  }

  async archive(id: UUID): Promise<void> {
    const existing = await db.payment_accounts.get(id);
    if (!existing || existing.deleted_at || existing.archived) return;
    await db.payment_accounts.put({ ...existing, archived: true, updated_at: new Date() });
  }

  async delete(id: UUID): Promise<void> {
    return db.transaction('rw', [db.payment_accounts, db.movements, db.movement_recurrences, db.sync_queue], async () => {
      const existing = await db.payment_accounts.get(id);
      if (!existing || existing.deleted_at) return;
      const used = await this.countMovements(id)
        + await db.movement_recurrences.filter(r => !r.deleted_at && r.active && (r.account_id === id || r.to_account_id === id)).count();
      if (used > 0) throw new DomainError('La cuenta tiene movimientos asociados: archivala en lugar de eliminarla.');
      const now = new Date();
      await db.payment_accounts.put({ ...existing, deleted_at: now, updated_at: now });
    });
  }

  async countMovements(accountId: UUID): Promise<number> {
    return await db.movements.filter(m => !m.deleted_at && (m.account_id === accountId || m.to_account_id === accountId)).count();
  }

  async ensureDefault(userId: UUID): Promise<void> {
    if (!userId) return;
    await db.transaction('rw', [db.payment_accounts, db.sync_queue], async () => {
      // Any existing row (even archived or soft-deleted) means the user already
      // owned the default account: never resurrect what they chose to remove.
      if (await db.payment_accounts.get(defaultCashAccountId(userId))) return;
      await db.payment_accounts.put(buildDefaultCashAccount(userId, new Date()));
    });
  }
}
