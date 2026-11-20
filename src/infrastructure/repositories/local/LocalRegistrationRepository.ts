import { db } from '../../db/db';
import type { IRegistrationRepository, RegistrationRepositoryInputs } from '../../../core/domain/repositories/IRepositories';
import type { ReminderSkip, UUID } from '../../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../../core/use-cases/calculateMonthlyCycle';
import { parseItemKey } from '../../../core/use-cases/registrationItemKey';
import { stableId } from '../../../core/use-cases/stableId';

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Single read point for "Por registrar" and its `register_due` notifications
 * (spec 013 R7/R8/R9), plus idempotent per-month skip persistence.
 */
export class LocalRegistrationRepository implements IRegistrationRepository {
  async getInputs(userId: UUID, today: Date): Promise<RegistrationRepositoryInputs> {
    const [start, end] = calculateMonthlyCycle(today);
    const monthKey = toYearMonth(today);

    const [rules, incomeSources, loans, accounts, monthMovements, skips] = await Promise.all([
      db.movement_recurrences.where('user_id').equals(userId).filter(r => !r.deleted_at).toArray(),
      db.income_sources.where('user_id').equals(userId).filter(s => !s.deleted_at).toArray(),
      db.installment_loans.where('user_id').equals(userId).filter(l => !l.deleted_at).toArray(),
      db.payment_accounts.where('user_id').equals(userId).filter(a => !a.deleted_at).toArray(),
      db.movements.where('user_id').equals(userId).and(m => !m.deleted_at && m.date >= start && m.date <= end).toArray(),
      db.reminder_skips.where('user_id').equals(userId).and(s => !s.deleted_at && s.month === monthKey).toArray(),
    ]);

    const loanIdByPaymentId: Record<string, string> = {};
    if (loans.length > 0) {
      const paymentLists = await Promise.all(
        loans.map(loan => db.installment_payments.where('installment_loan_id').equals(loan.id).filter(p => !p.deleted_at).toArray()),
      );
      for (const payments of paymentLists) {
        for (const payment of payments) {
          loanIdByPaymentId[payment.id] = payment.installment_loan_id;
        }
      }
    }

    return {
      rules,
      incomeSources,
      loans,
      loanIdByPaymentId,
      accounts,
      monthMovements,
      skips,
    };
  }

  async skip(userId: UUID, itemKey: string): Promise<ReminderSkip> {
    const { month } = parseItemKey(itemKey);
    const id = stableId(`skip:${userId}:${itemKey}`);
    const now = new Date();
    const existing = await db.reminder_skips.get(id);
    const row: ReminderSkip = {
      id,
      user_id: userId,
      item_key: itemKey,
      month,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      deleted_at: undefined,
    };
    await db.reminder_skips.put(row);
    return row;
  }

  async unskip(userId: UUID, itemKey: string): Promise<void> {
    parseItemKey(itemKey);
    const id = stableId(`skip:${userId}:${itemKey}`);
    const existing = await db.reminder_skips.get(id);
    if (!existing || existing.deleted_at) return;
    const now = new Date();
    await db.reminder_skips.put({
      ...existing,
      deleted_at: now,
      updated_at: now,
    });
  }
}
