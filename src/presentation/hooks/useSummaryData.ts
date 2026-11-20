import { useCallback, useMemo } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalRegistrationRepository } from '../../infrastructure/repositories/local/LocalRegistrationRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { useLocalQuery } from './useLocalQuery';
import type {
  CardDebtSummary,
  Debt,
  DistributionCategory,
  MonthBalance,
  Movement,
  PaymentAccount,
  PendingRegistration,
  Profile,
  SavingsGoal,
  SetupChecklist,
} from '../../core/domain/models/types';
import type { RegistrationRepositoryInputs } from '../../core/domain/repositories/IRepositories';
import { calculateMonthBalance } from '../../core/use-cases/calculateMonthBalance';
import { calculateAccountBalances } from '../../core/use-cases/calculateAccountBalances';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { selectCardOwed } from '../../core/use-cases/selectCardOwed';
import { buildPendingRegistrations } from '../../core/use-cases/buildPendingRegistrations';
import { buildRegistrationPrefill, type RegistrationPrefill } from '../../core/use-cases/buildRegistrationPrefill';
import { buildCompactRule, type CompactRule } from '../../core/use-cases/buildCompactRule';
import { buildSetupChecklist } from '../../core/use-cases/buildSetupChecklist';
import { nextInstallment, type NextInstallment } from '../../core/use-cases/nextInstallment';
import { pickPrimarySavingsGoal, type PrimarySavingsGoal } from '../../core/use-cases/pickPrimarySavingsGoal';

const WATCHED_TABLES = [
  'movements',
  'payment_accounts',
  'distribution_categories',
  'profiles',
  'reminder_skips',
  'installment_payments',
  'installment_loans',
  'movement_recurrences',
  'income_sources',
  'savings_goals',
  'debts',
];

const EMPTY_REG_INPUTS: RegistrationRepositoryInputs = {
  rules: [],
  incomeSources: [],
  loans: [],
  loanIdByPaymentId: {},
  accounts: [],
  monthMovements: [],
  skips: [],
};

interface RawSummaryData {
  allMovements: Movement[];
  accounts: PaymentAccount[];
  distCategories: DistributionCategory[];
  savingsGoals: SavingsGoal[];
  debts: Debt[];
  profile: Profile | undefined;
  regInputs: RegistrationRepositoryInputs;
  loadedAt: Date;
}

const EMPTY: RawSummaryData = {
  allMovements: [],
  accounts: [],
  distCategories: [],
  savingsGoals: [],
  debts: [],
  profile: undefined,
  regInputs: EMPTY_REG_INPUTS,
  loadedAt: new Date(),
};

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

async function loadRaw(userId: string): Promise<RawSummaryData> {
  const now = new Date();
  const [allMovements, accounts, distCategories, savingsGoals, debts, profile, regInputs] = await Promise.all([
    safe(() => new LocalMovementRepository().getAll(userId), [] as Movement[]),
    safe(() => new LocalPaymentAccountRepository().getAll(userId), [] as PaymentAccount[]),
    safe(() => new LocalCategoryRepository().getDistributionCategories(userId), [] as DistributionCategory[]),
    safe(() => new LocalSavingsGoalRepository().getAll(userId), [] as SavingsGoal[]),
    safe(() => new LocalDebtRepository().getAll(userId), [] as Debt[]),
    safe(() => new LocalProfileRepository().get(userId), undefined as Profile | undefined),
    safe(() => new LocalRegistrationRepository().getInputs(userId, now), EMPTY_REG_INPUTS),
  ]);

  return {
    allMovements,
    accounts,
    distCategories,
    savingsGoals,
    debts,
    profile,
    regInputs,
    loadedAt: now,
  };
}

export interface SummaryAccountItem {
  id: string;
  name: string;
  kind: 'debit' | 'cash' | 'savings';
  balanceCents: number;
}

export interface SummaryLoanItem {
  id: string;
  name: string;
  remainingBalanceCents: number;
  nextInstallment: NextInstallment;
  paymentDay?: number;
}

export interface SummaryInformalDebtItem {
  id: string;
  name: string;
  remainingBalanceCents: number;
}

export interface SummaryDebts {
  cards: CardDebtSummary[];
  loans: SummaryLoanItem[];
  informalDebts: SummaryInformalDebtItem[];
}

export interface SummaryView {
  today: Date;
  isCurrentMonth: boolean;
  balance: MonthBalance;
  cards: CardDebtSummary[];
  pending: PendingRegistration[];
  accounts: SummaryAccountItem[];
  debts: SummaryDebts;
  rule: CompactRule;
  primaryGoal: PrimarySavingsGoal | null;
  checklist: SetupChecklist;
  progress: { visible: boolean };
}

export interface SummaryData {
  loading: boolean;
  view: SummaryView;
  register: (item: PendingRegistration) => RegistrationPrefill;
  skip: (item: PendingRegistration) => Promise<void>;
  dismissChecklist: () => Promise<void>;
}

/**
 * Offline-first data hook for the minimalist Summary screen (spec 013).
 * Composes pure use-cases over local Dexie repositories and reacts to local
 * writes and sync completions.
 */
export function useSummaryData(userId: string, refDateProp?: Date): SummaryData {
  const year = (refDateProp ?? new Date()).getFullYear();
  const month = (refDateProp ?? new Date()).getMonth();
  const refDate = useMemo(() => new Date(year, month, 1), [year, month]);

  const load = useCallback(() => loadRaw(userId), [userId]);
  const { data: raw, loading, reload } = useLocalQuery({ load, initial: EMPTY, tables: WATCHED_TABLES });

  const view = useMemo<SummaryView>(() => {
    const balance = calculateMonthBalance({
      month: refDate,
      accounts: raw.accounts,
      movements: raw.allMovements,
      distributionCategories: raw.distCategories,
      balanceSince: raw.profile?.balance_since,
    });

    const isCurrentMonth =
      refDate.getFullYear() === raw.loadedAt.getFullYear() &&
      refDate.getMonth() === raw.loadedAt.getMonth();

    const pending = isCurrentMonth
      ? buildPendingRegistrations({
          today: raw.loadedAt,
          rules: raw.regInputs.rules,
          incomeSources: raw.regInputs.incomeSources,
          loans: raw.regInputs.loans,
          loanIdByPaymentId: raw.regInputs.loanIdByPaymentId,
          accounts: raw.accounts,
          cardOwed: selectCardOwed(balance),
          monthMovements: raw.regInputs.monthMovements,
          skips: raw.regInputs.skips,
        })
      : [];

    const accountBalances = calculateAccountBalances(raw.accounts, raw.allMovements);
    const accounts: SummaryAccountItem[] = raw.accounts
      .filter((a): a is PaymentAccount & { kind: 'debit' | 'cash' | 'savings' } =>
        !a.deleted_at && !a.archived && a.kind !== 'credit',
      )
      .map(a => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        balanceCents: accountBalances[a.id] ?? 0,
      }));

    const loans: SummaryLoanItem[] = [];
    for (const loan of raw.regInputs.loans) {
      const next = nextInstallment(loan);
      if (!next) continue;
      loans.push({
        id: loan.id,
        name: loan.lender_name,
        remainingBalanceCents: loan.remaining_installments * loan.installment_amount,
        nextInstallment: next,
        paymentDay: loan.payment_day,
      });
    }

    const informalDebts: SummaryInformalDebtItem[] = raw.debts
      .filter(d => !d.deleted_at && d.direction === 'borrowed' && d.amount - d.settled_amount > 0)
      .map(d => ({
        id: d.id,
        name: d.counterparty_name,
        remainingBalanceCents: d.amount - d.settled_amount,
      }));

    const [cycleStart, cycleEnd] = calculateMonthlyCycle(refDate);
    const cycleMovements = raw.allMovements.filter(
      m => !m.deleted_at && m.date >= cycleStart && m.date <= cycleEnd,
    );
    const expectedIncome = raw.regInputs.incomeSources.reduce((sum, src) => sum + src.amount, 0);
    const rule = buildCompactRule(cycleMovements, raw.distCategories, expectedIncome, balance.savingsNet);

    const primaryGoal = pickPrimarySavingsGoal(raw.savingsGoals, raw.allMovements, raw.loadedAt);
    const checklist = buildSetupChecklist({
      incomeSources: raw.regInputs.incomeSources,
      accounts: raw.accounts,
      loans: raw.regInputs.loans,
      debts: raw.debts,
      profile: raw.profile,
    });

    return {
      today: raw.loadedAt,
      isCurrentMonth,
      balance,
      cards: balance.cards,
      pending,
      accounts,
      debts: {
        cards: balance.cards,
        loans,
        informalDebts,
      },
      rule,
      primaryGoal,
      checklist,
      progress: {
        visible: Boolean(raw.profile) && raw.profile?.gamification_enabled !== false,
      },
    };
  }, [raw, refDate]);

  const register = useCallback(
    (item: PendingRegistration): RegistrationPrefill =>
      buildRegistrationPrefill(item, {
        userId,
        accounts: raw.accounts,
        rules: raw.regInputs.rules,
      }),
    [userId, raw.accounts, raw.regInputs.rules],
  );

  const skip = useCallback(
    async (item: PendingRegistration): Promise<void> => {
      await new LocalRegistrationRepository().skip(userId, item.key);
      await reload();
    },
    [userId, reload],
  );

  const dismissChecklist = useCallback(async (): Promise<void> => {
    await new LocalProfileRepository().save({ id: userId, checklist_dismissed: true });
    await reload();
  }, [userId, reload]);

  return { loading, view, register, skip, dismissChecklist };
}
