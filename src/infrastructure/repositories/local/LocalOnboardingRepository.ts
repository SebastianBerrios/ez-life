import { db } from '../../db/db';
import type { ChecklistKey, Debt, InstallmentLoan, PaymentAccount, Profile } from '../../../core/domain/models/types';
import { stableId } from '../../../core/use-cases/stableId';
import { validateMovementAmount } from '../../../core/use-cases/validateMovementAmount';
import { validateNewCreditCard, validatePaymentAccount } from '../../../core/use-cases/validatePaymentAccount';
import { buildDefaultCashAccount, defaultCashAccountId } from '../../../core/use-cases/defaultPaymentAccount';
import { resolveOnboardingProgress, type OnboardingStep } from '../../../core/use-cases/resolveOnboardingProgress';
import { parseDayOfMonth } from '../../../core/use-cases/parseDayOfMonth';
import { validateOnboardingCard, type OnboardingCardDraft } from '../../../core/use-cases/validateOnboardingCard';
import { validateOnboardingLoan, type OnboardingLoanDraft } from '../../../core/use-cases/validateOnboardingLoan';
import { DomainError } from '../../../core/domain/errors/DomainError';
import { LocalProfileRepository } from './LocalProfileRepository';

export interface OnboardingBankDraft {
  id: string;
  name: string;
  kind: 'debit' | 'savings';
  balance: number; // integer cents >= 0
}

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function localDayDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function nextStepValue(existing: Profile | undefined, targetStep: OnboardingStep): OnboardingStep {
  const current = resolveOnboardingProgress(existing).step;
  return (current > targetStep ? current : targetStep) as OnboardingStep;
}

function addNotApplicable(existing: ChecklistKey[] | undefined, key: ChecklistKey): ChecklistKey[] {
  const current = existing ?? [];
  return current.includes(key) ? current : [...current, key];
}

function removeNotApplicable(existing: ChecklistKey[] | undefined, key: ChecklistKey): ChecklistKey[] | undefined {
  if (!existing || !existing.includes(key)) return existing;
  return existing.filter(item => item !== key);
}

export class LocalOnboardingRepository {
  async progress(userId: string): Promise<OnboardingStep> {
    const profile = await db.profiles.get(userId);
    if (profile?.onboarding_step !== undefined) {
      return resolveOnboardingProgress(profile).step;
    }
    // One-time migration of older, explicitly owned data. Nothing is renamed,
    // merged, reattributed or populated with historical financial movements.
    const sources = await db.income_sources.where('user_id').equals(userId).filter(row => !row.deleted_at).count();
    const buckets = await db.distribution_categories.where('user_id').equals(userId).filter(row => !row.deleted_at).toArray();
    const categories = await db.expense_categories.where('user_id').equals(userId).filter(row => !row.deleted_at).toArray();
    let legacyStep: 0 | 1 | 2 | 3 = sources ? 1 : 0;
    if (legacyStep === 1 && buckets.reduce((total, row) => total + row.percentage, 0) === 100 && buckets.filter(row => row.is_savings).length === 1) {
      legacyStep = 2;
      const complete = await Promise.all(categories.map(row => db.expense_subcategories.where('category_id').equals(row.id).filter(sub => !sub.deleted_at).count()));
      if (categories.length > 0 && complete.every(count => count > 0)) legacyStep = 3;
    }
    const resolved = resolveOnboardingProgress({ onboarding_step: legacyStep });
    await new LocalProfileRepository().save({ id: userId, onboarding_step: resolved.step, onboarding_version: 2 });
    return resolved.step;
  }

  /**
   * Legacy step 1 helper retained for backward compatibility with existing tests.
   * New onboarding UI uses `saveIncome` (step 1) + `saveAccounts` (step 2).
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

  /**
   * Step 1 (v2): monthly income, optional pay_day (1–31), and whether the user
   * already received this month's salary (`received_month`). Sets `balance_since`
   * on the profile atomically in the same transaction (R4, T036).
   */
  async saveIncome(
    userId: string,
    input: { income: number; payDay?: number; receivedThisMonth: boolean; now?: Date },
  ): Promise<void> {
    const { income, payDay, receivedThisMonth } = input;
    validateMovementAmount(income);
    if (payDay !== undefined) {
      parseDayOfMonth(String(payDay));
    }

    await db.transaction('rw', [db.profiles, db.income_sources, db.sync_queue], async () => {
      const now = input.now ?? new Date();
      const month = toYearMonth(now);
      const profile = await db.profiles.get(userId);
      const id = profile?.onboarding_income_source_id ?? stableId(`initial-income:${userId}`);
      const existing = await db.income_sources.get(id);
      if (existing && existing.user_id !== userId) {
        throw new DomainError('La fuente pertenece a otra cuenta.');
      }

      await db.income_sources.put({
        id,
        user_id: userId,
        name: existing?.name ?? 'Sueldo Base',
        amount: income,
        pay_day: payDay,
        received_month: receivedThisMonth ? month : undefined,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });

      await new LocalProfileRepository().save({
        id: userId,
        onboarding_step: nextStepValue(profile, 1),
        onboarding_version: 2,
        onboarding_income_source_id: id,
        balance_since: profile?.balance_since ?? month,
      });
    });
  }

  /**
   * Step 2 (v2): always ensures the "Efectivo" account (never overwriting an
   * existing one), creates client-keyed bank accounts (debit/savings) with
   * `opening_date = today` (R2), and optionally declares `'accounts'` as
   * "no aplica" ("Solo uso efectivo") in the same atomic transaction (T037).
   */
  async saveAccounts(
    userId: string,
    input: {
      cash: number;
      banks: OnboardingBankDraft[];
      declareNoBanks?: boolean;
      now?: Date;
    },
  ): Promise<void> {
    const { cash, banks, declareNoBanks } = input;
    if (!Number.isSafeInteger(cash) || cash < 0) {
      throw new DomainError('El saldo no puede ser negativo.');
    }
    if (declareNoBanks && banks.length > 0) {
      throw new DomainError('No puedes marcar solo efectivo si agregaste cuentas de banco.');
    }
    for (const bank of banks) {
      if (!bank.name || !bank.name.trim()) {
        throw new DomainError('El nombre de la cuenta es obligatorio.');
      }
      if (bank.kind !== 'debit' && bank.kind !== 'savings') {
        throw new DomainError('El tipo de cuenta no es válido.');
      }
      if (!Number.isSafeInteger(bank.balance) || bank.balance < 0) {
        throw new DomainError('El saldo no puede ser negativo.');
      }
    }

    await db.transaction('rw', [db.profiles, db.payment_accounts, db.sync_queue], async () => {
      const now = input.now ?? new Date();
      const openingDate = localDayDate(now);
      const profile = await db.profiles.get(userId);

      // Always ensure "Efectivo" exists without touching an already existing one.
      const cashId = defaultCashAccountId(userId);
      if (!await db.payment_accounts.get(cashId)) {
        const cashAccount: PaymentAccount = {
          ...buildDefaultCashAccount(userId, now, cash),
          opening_date: openingDate,
        };
        validatePaymentAccount(cashAccount);
        await db.payment_accounts.put(cashAccount);
      }

      for (const bank of banks) {
        const existing = await db.payment_accounts.get(bank.id);
        if (existing) {
          if (existing.user_id !== userId) {
            throw new DomainError('La cuenta pertenece a otro usuario.');
          }
          continue; // Idempotent retry by stable draft id
        }
        const account: PaymentAccount = {
          id: bank.id,
          user_id: userId,
          name: bank.name.trim(),
          kind: bank.kind,
          opening_balance: bank.balance,
          opening_date: openingDate,
          created_at: now,
          updated_at: now,
        };
        validatePaymentAccount(account);
        await db.payment_accounts.put(account);
      }

      const nextNotApplicable = declareNoBanks
        ? addNotApplicable(profile?.checklist_not_applicable, 'accounts')
        : banks.length > 0
          ? removeNotApplicable(profile?.checklist_not_applicable, 'accounts')
          : profile?.checklist_not_applicable;

      await new LocalProfileRepository().save({
        id: userId,
        onboarding_step: nextStepValue(profile, 2),
        onboarding_version: 2,
        ...(nextNotApplicable !== undefined ? { checklist_not_applicable: nextNotApplicable } : {}),
      });
    });
  }

  /**
   * Step 3 (v2): validates and creates credit cards with mandatory credit_limit,
   * `opening_balance = -consumedCents` and `opening_date = today` (T038).
   */
  async saveCards(userId: string, cards: OnboardingCardDraft[], nowInput?: Date): Promise<void> {
    for (const card of cards) {
      validateOnboardingCard(card);
    }

    await db.transaction('rw', [db.profiles, db.payment_accounts, db.sync_queue], async () => {
      const now = nowInput ?? new Date();
      const openingDate = localDayDate(now);
      const profile = await db.profiles.get(userId);

      for (const card of cards) {
        const existing = await db.payment_accounts.get(card.id);
        if (existing) {
          if (existing.user_id !== userId) {
            throw new DomainError('La cuenta pertenece a otro usuario.');
          }
          continue; // Idempotent retry by stable draft id
        }
        const account: PaymentAccount = {
          id: card.id,
          user_id: userId,
          name: card.name.trim(),
          kind: 'credit',
          opening_balance: -card.consumedCents,
          credit_limit: card.creditLimitCents,
          closing_day: card.closingDay,
          payment_day: card.paymentDay,
          opening_date: openingDate,
          created_at: now,
          updated_at: now,
        };
        validateNewCreditCard(account);
        await db.payment_accounts.put(account);
      }

      const nextNotApplicable = cards.length > 0
        ? removeNotApplicable(profile?.checklist_not_applicable, 'cards')
        : profile?.checklist_not_applicable;

      await new LocalProfileRepository().save({
        id: userId,
        onboarding_step: nextStepValue(profile, 3),
        onboarding_version: 2,
        ...(nextNotApplicable !== undefined ? { checklist_not_applicable: nextNotApplicable } : {}),
      });
    });
  }

  /**
   * Step 4 (v2): creates installment loans (with `alreadyPaid` reducing
   * remaining installments, no payments/movements created) and informal debts
   * (`direction: 'borrowed'`, no movements — Principio X) atomically (T039).
   */
  async saveLoans(userId: string, loans: OnboardingLoanDraft[], nowInput?: Date): Promise<void> {
    for (const loan of loans) {
      validateOnboardingLoan(loan);
    }

    await db.transaction('rw', [db.profiles, db.installment_loans, db.debts, db.sync_queue], async () => {
      const now = nowInput ?? new Date();
      const profile = await db.profiles.get(userId);

      for (const draft of loans) {
        if (draft.hasInstallments) {
          const existing = await db.installment_loans.get(draft.id);
          if (existing) {
            if (existing.user_id !== userId) throw new DomainError('El préstamo pertenece a otra cuenta.');
            continue;
          }
          const remaining = draft.installmentCount - draft.alreadyPaid;
          const row: InstallmentLoan = {
            id: draft.id,
            user_id: userId,
            lender_name: draft.lenderName.trim(),
            amount: draft.amountCents,
            installment_count: draft.installmentCount,
            remaining_installments: remaining,
            installment_amount: draft.installmentAmountCents,
            payment_day: draft.paymentDay,
            status: remaining === 0 ? 'settled' : 'active',
            created_at: now,
            updated_at: now,
          };
          await db.installment_loans.put(row);
        } else {
          const existing = await db.debts.get(draft.id);
          if (existing) {
            if (existing.user_id !== userId) throw new DomainError('La deuda pertenece a otra cuenta.');
            continue;
          }
          const debt: Debt = {
            id: draft.id,
            user_id: userId,
            counterparty_name: draft.lenderName.trim(),
            direction: 'borrowed',
            origin: 'manual',
            amount: draft.pendingAmountCents,
            settled_amount: 0,
            created_at: now,
            updated_at: now,
          };
          await db.debts.put(debt);
        }
      }

      const nextNotApplicable = loans.length > 0
        ? removeNotApplicable(profile?.checklist_not_applicable, 'loans')
        : profile?.checklist_not_applicable;

      await new LocalProfileRepository().save({
        id: userId,
        onboarding_step: nextStepValue(profile, 4),
        onboarding_version: 2,
        ...(nextNotApplicable !== undefined ? { checklist_not_applicable: nextNotApplicable } : {}),
      });
    });
  }

  /** Steps 3 and 4 "Omitir por ahora": advances without data or not-applicable flag. */
  async skipStep(userId: string, step: 3 | 4): Promise<void> {
    await db.transaction('rw', [db.profiles, db.sync_queue], async () => {
      const profile = await db.profiles.get(userId);
      await new LocalProfileRepository().save({
        id: userId,
        onboarding_step: nextStepValue(profile, step),
        onboarding_version: 2,
      });
    });
  }

  /** Steps 3 and 4 "No tengo tarjetas/préstamos": marks key not-applicable and advances. */
  async declareNotApplicable(userId: string, key: 'cards' | 'loans'): Promise<void> {
    const step: 3 | 4 = key === 'cards' ? 3 : 4;
    await db.transaction('rw', [db.profiles, db.sync_queue], async () => {
      const profile = await db.profiles.get(userId);
      const list = addNotApplicable(profile?.checklist_not_applicable, key);
      await new LocalProfileRepository().save({
        id: userId,
        onboarding_step: nextStepValue(profile, step),
        onboarding_version: 2,
        checklist_not_applicable: list,
      });
    });
  }

  async completeStep(userId: string, step: 2 | 3 | 4 | 5 | 6): Promise<void> {
    await db.transaction('rw', [db.profiles, db.sync_queue], async () => {
      const profile = await db.profiles.get(userId);
      await new LocalProfileRepository().save({
        id: userId,
        onboarding_step: nextStepValue(profile, step),
        onboarding_version: 2,
      });
    });
  }
}
