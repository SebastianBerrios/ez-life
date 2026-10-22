import { db } from '../../db/db';
import { stableId } from '../../../core/use-cases/stableId';
import { validateMovementAmount } from '../../../core/use-cases/validateMovementAmount';
import { validatePaymentAccount } from '../../../core/use-cases/validatePaymentAccount';
import { buildDefaultCashAccount, defaultCashAccountId } from '../../../core/use-cases/defaultPaymentAccount';
import { DomainError } from '../../../core/domain/errors/DomainError';
import { LocalProfileRepository } from './LocalProfileRepository';
export class LocalOnboardingRepository {
  async progress(userId: string): Promise<0 | 1 | 2 | 3> {
    const profile = await db.profiles.get(userId);
    if (profile?.onboarding_step !== undefined) return profile.onboarding_step;
    // One-time migration of older, explicitly owned data. Nothing is renamed,
    // merged, reattributed or populated with historical financial movements.
    const sources = await db.income_sources.where('user_id').equals(userId).filter(row => !row.deleted_at).count();
    const buckets = await db.distribution_categories.where('user_id').equals(userId).filter(row => !row.deleted_at).toArray();
    const categories = await db.expense_categories.where('user_id').equals(userId).filter(row => !row.deleted_at).toArray();
    let step: 0 | 1 | 2 | 3 = sources ? 1 : 0;
    if (step === 1 && buckets.reduce((total, row) => total + row.percentage, 0) === 100 && buckets.filter(row => row.is_savings).length === 1) {
      step = 2;
      const complete = await Promise.all(categories.map(row => db.expense_subcategories.where('category_id').equals(row.id).filter(sub => !sub.deleted_at).count()));
      if (categories.length > 0 && complete.every(count => count > 0)) step = 3;
    }
    await new LocalProfileRepository().save({ id: userId, onboarding_step: step });
    return step;
  }
  /**
   * Step 1: monthly income plus the money the user holds today. The current balance becomes the opening
   * balance of the default "Efectivo" account, created here so it is atomic with the income. An existing
   * account (even archived or deleted) is never touched: the balance is only set on first creation.
   */
  async saveStartingPoint(userId: string, input: { income: number; openingBalance: number }): Promise<void> {
    const { income, openingBalance } = input;
    validateMovementAmount(income);
    if (openingBalance < 0 || !Number.isSafeInteger(openingBalance)) throw new DomainError('El saldo actual debe ser un monto en céntimos mayor o igual a 0.');
    await db.transaction('rw', [db.profiles, db.income_sources, db.payment_accounts, db.sync_queue], async () => {
      const profile = await db.profiles.get(userId);
      const id = profile?.onboarding_income_source_id ?? stableId(`initial-income:${userId}`);
      const existing = await db.income_sources.get(id);
      if (existing && existing.user_id !== userId) throw new DomainError('La fuente pertenece a otra cuenta.');
      const now = new Date();
      await db.income_sources.put({ id, user_id: userId, name: 'Sueldo Base', amount: income, created_at: existing?.created_at ?? now, updated_at: now });
      if (!await db.payment_accounts.get(defaultCashAccountId(userId))) {
        const account = buildDefaultCashAccount(userId, now, openingBalance);
        validatePaymentAccount(account);
        await db.payment_accounts.put(account);
      }
      await new LocalProfileRepository().save({ id: userId, onboarding_step: 1, onboarding_income_source_id: id });
    });
  }
  async completeStep(userId: string, step: 2 | 3): Promise<void> {
    await new LocalProfileRepository().save({ id: userId, onboarding_step: step });
  }
}
