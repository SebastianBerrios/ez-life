import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { LocalSyncStatusRepository } from '../../infrastructure/repositories/local/LocalSyncStatusRepository';
import type {
  Debt, DistributionCategory, ExpenseCategory, ExpenseSubcategory, IncomeSource, InstallmentLoan, Movement, PaymentAccount,
} from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { compareMonthlyPeriods } from '../../core/use-cases/compareMonthlyPeriods';
import { calculateAvailableCapital } from '../../core/use-cases/calculateAvailableCapital';
import { buildFinancesKpis, type FinancesKpis } from '../../core/use-cases/buildFinancesKpis';
import { buildRuleView, type RuleView } from '../../core/use-cases/buildRuleView';
import type { MovementLookups } from '../../core/use-cases/describeMovement';
import { useLocalQuery } from './useLocalQuery';

const WATCHED_TABLES = [
  'movements', 'income_sources', 'distribution_categories', 'expense_categories', 'expense_subcategories',
  'payment_accounts', 'debts', 'installment_loans', 'sync_queue',
];

export interface FinancesView {
  /** Moment of the last load: "Hoy" / "Ayer" labels are relative to it. */
  today: Date;
  /** Movements of the selected month (all types, newest first is up to the list). */
  movements: Movement[];
  lookups: MovementLookups;
  /** Movement ids with a change not yet pushed to the server. */
  pendingMovementIds: ReadonlySet<string>;
  kpis: FinancesKpis;
  rule: RuleView;
  activeDebtCount: number;
  activeLoanCount: number;
}

export interface FinancesData {
  loading: boolean;
  view: FinancesView;
  /** Silent reload (used after edits/deletes whose repositories do not emit a local-change event in tests). */
  reload: () => Promise<void>;
}

interface RawData {
  movements: Movement[];
  allMovements: Movement[];
  accounts: PaymentAccount[];
  distCategories: DistributionCategory[];
  expenseCategories: ExpenseCategory[];
  expenseSubcategories: ExpenseSubcategory[];
  incomeSources: IncomeSource[];
  debts: Debt[];
  loans: InstallmentLoan[];
  pending: Set<string>;
  loadedAt: Date;
}

const EMPTY: RawData = {
  movements: [], allMovements: [], accounts: [], distCategories: [], expenseCategories: [], expenseSubcategories: [],
  incomeSources: [], debts: [], loans: [], pending: new Set(), loadedAt: new Date(),
};

/** One failing source must not blank the whole screen: log it and fall back to an empty value. */
async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

async function loadRaw(userId: string, refDate: Date): Promise<RawData> {
  const catRepo = new LocalCategoryRepository();
  const [start, end] = calculateMonthlyCycle(refDate);

  const [movements, allMovements, accounts, distCategories, expenseCategories, incomeSources, debts, loans, pending] = await Promise.all([
    safe(() => new LocalMovementRepository().getAllByCycle(userId, start, end), [] as Movement[]),
    safe(() => new LocalMovementRepository().getAll(userId), [] as Movement[]),
    safe(() => new LocalPaymentAccountRepository().getAll(userId), [] as PaymentAccount[]),
    safe(() => catRepo.getDistributionCategories(userId), [] as DistributionCategory[]),
    safe(() => catRepo.getExpenseCategories(userId), [] as ExpenseCategory[]),
    safe(() => new LocalIncomeSourceRepository().getAll(userId), [] as IncomeSource[]),
    safe(() => new LocalDebtRepository().getAll(userId), [] as Debt[]),
    safe(() => new LocalInstallmentLoanRepository().getAll(userId), [] as InstallmentLoan[]),
    safe(() => new LocalSyncStatusRepository().getPendingRecordIds('movements'), new Set<string>()),
  ]);
  const expenseSubcategories = await safe(
    async () => (await Promise.all(expenseCategories.map(cat => catRepo.getSubcategories(cat.id)))).flat(),
    [] as ExpenseSubcategory[],
  );
  return {
    movements, allMovements, accounts, distCategories, expenseCategories, expenseSubcategories, incomeSources,
    debts, loans, pending, loadedAt: new Date(),
  };
}

const byId = <T extends { id: string; name: string }>(items: T[]) => Object.fromEntries(items.map(item => [item.id, item.name]));

function buildView(raw: RawData): FinancesView {
  const expectedIncome = raw.incomeSources.reduce((total, source) => total + source.amount, 0);
  const rule = buildRuleView(raw.movements, raw.distCategories, raw.expenseCategories, raw.expenseSubcategories, expectedIncome);
  const { income, expense } = compareMonthlyPeriods(raw.movements, []).current;
  const activeAccounts = raw.accounts.filter(account => !account.archived);

  return {
    today: raw.loadedAt,
    movements: raw.movements,
    lookups: {
      categoryName: byId(raw.expenseCategories),
      subcategoryName: byId(raw.expenseSubcategories),
      incomeSourceName: byId(raw.incomeSources),
      bucket: Object.fromEntries(raw.distCategories.map(b => [b.id, { name: b.name, percentage: b.percentage }])),
      accountName: byId(raw.accounts),
    },
    pendingMovementIds: raw.pending,
    kpis: buildFinancesKpis({
      income,
      expense,
      budgetBase: rule.totalBudget,
      distributionCategories: raw.distCategories,
      capital: calculateAvailableCapital(raw.accounts, raw.allMovements),
      accountCount: activeAccounts.length,
    }),
    rule,
    activeDebtCount: raw.debts.filter(debt => !debt.deleted_at && debt.settled_amount < debt.amount).length,
    activeLoanCount: raw.loans.filter(loan => !loan.deleted_at && loan.status === 'active').length,
  };
}

/**
 * Everything the Finanzas screen needs for `(userId, month)`: the month's movements, lookups,
 * KPIs, the 50/30/20 execution and loan counts, read from the local (Dexie) repositories so it works
 * offline. Shares its refresh lifecycle with Inicio (`useLocalQuery`); `refreshKey` forces a reload
 * (the app shell bumps it after saving a movement). Components only render `view`.
 */
export function useFinancesData(userId: string, refDateProp?: Date, refreshKey = 0): FinancesData {
  const year = (refDateProp ?? new Date()).getFullYear();
  const month = (refDateProp ?? new Date()).getMonth();

  const load = useCallback(() => loadRaw(userId, new Date(year, month, 1)), [userId, year, month]);
  const { data: raw, loading, reload } = useLocalQuery({ load, initial: EMPTY, tables: WATCHED_TABLES });

  // A bumped `refreshKey` reloads silently (no skeleton); the first value is already covered by the mount load.
  const seenKey = useRef(refreshKey);
  useEffect(() => {
    if (seenKey.current === refreshKey) return;
    seenKey.current = refreshKey;
    void reload();
  }, [refreshKey, reload]);

  const view = useMemo(() => buildView(raw), [raw]);
  return { loading, view, reload };
}
