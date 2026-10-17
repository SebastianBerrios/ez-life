import { useCallback, useMemo, useRef } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { useLocalQuery } from './useLocalQuery';
import type {
  Debt, DistributionCategory, ExpenseCategory, ExpenseSubcategory, Habit, HabitCompletion, InstallmentLoan,
  Movement, PaymentAccount, SavingsGoal, Task,
} from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { calculateCategoryBreakdown } from '../../core/use-cases/calculateCategoryBreakdown';
import { calculateBudgets } from '../../core/use-cases/calculateBudgets';
import { compareMonthlyPeriods, type PeriodComparison } from '../../core/use-cases/compareMonthlyPeriods';
import { budgetStatusFor, type BudgetStatus } from '../../core/use-cases/budgetStatus';
import { calculateAvailableCapital } from '../../core/use-cases/calculateAvailableCapital';
import { calculateSavingsRate } from '../../core/use-cases/calculateSavingsRate';
import { buildFocusToday, type FocusItem } from '../../core/use-cases/buildFocusToday';
import { calculateDailyScore, type DailyScore } from '../../core/use-cases/calculateDailyScore';
import { pickPrimarySavingsGoal, type PrimarySavingsGoal } from '../../core/use-cases/pickPrimarySavingsGoal';
import { buildCycleSparkline, type CycleSparkline } from '../../core/use-cases/buildCycleSparkline';
import { selectRecentMovements, type RecentMovement } from '../../core/use-cases/selectRecentMovements';
import { nextInstallment, type NextInstallment } from '../../core/use-cases/nextInstallment';
import { calculateSharedBalance } from '../../core/use-cases/calculateSharedBalance';
import { calculateUserSharedNet } from '../../core/use-cases/calculateUserSharedNet';

export const RECENT_MOVEMENTS_COUNT = 5;

const WATCHED_TABLES = [
  'movements', 'income_sources', 'distribution_categories', 'expense_categories', 'expense_subcategories', 'debts',
  'payment_accounts', 'installment_loans', 'savings_goals', 'habits', 'habit_completions', 'tasks',
  'shared_spaces', 'memberships', 'shared_movements',
];

export interface BudgetRow {
  id: string;
  name: string;
  percentage: number;
  /** Cents. */
  budget: number;
  spent: number;
  /** spent / budget as a percentage; may exceed 100. 0 when the budget is 0. */
  progress: number;
  status: BudgetStatus;
  /** Comma-joined names of the expense categories inside the bucket (real data, may be empty). */
  categoryNames: string;
}

export interface SharedSpaceSummary {
  id: string;
  name: string;
  /** Positive: others owe the user; negative: the user owes. */
  netCents: number;
}

export interface DashboardView {
  today: Date;
  cycle: { income: number; expense: number; balance: number };
  comparison: PeriodComparison;
  capitalCents: number;
  sparkline: CycleSparkline;
  savingsRate: number | null;
  budget: { rows: BudgetRow[]; expectedIncome: number; totalBudget: number; totalSpent: number; hasBuckets: boolean };
  focus: FocusItem[];
  score: DailyScore;
  nextPending: FocusItem | undefined;
  primaryGoal: PrimarySavingsGoal | null;
  activeDebts: Debt[];
  activeLoans: { loan: InstallmentLoan; next: NextInstallment }[];
  sharedSpaces: SharedSpaceSummary[];
  recent: RecentMovement[];
  /** Lookup tables for the recent-transactions table. */
  categoryName: Record<string, string>;
  bucketName: Record<string, string>;
  accountName: Record<string, string>;
}

export interface DashboardData {
  loading: boolean;
  view: DashboardView;
  /** Records today's completion of a habit (same repository call as the Hábitos list). */
  completeHabit: (habitId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
}

interface RawData {
  movements: Movement[];
  previousMovements: Movement[];
  allMovements: Movement[];
  accounts: PaymentAccount[];
  distCategories: DistributionCategory[];
  expenseCategories: ExpenseCategory[];
  expenseSubcategories: ExpenseSubcategory[];
  debts: Debt[];
  loans: InstallmentLoan[];
  savingsGoals: SavingsGoal[];
  habits: Habit[];
  completionsByHabit: Record<string, HabitCompletion[]>;
  tasks: Task[];
  expectedIncome: number;
  sharedSpaces: SharedSpaceSummary[];
  loadedAt: Date;
}

const EMPTY: RawData = {
  movements: [], previousMovements: [], allMovements: [], accounts: [], distCategories: [], expenseCategories: [],
  expenseSubcategories: [], debts: [], loans: [], savingsGoals: [], habits: [], completionsByHabit: {}, tasks: [],
  expectedIncome: 0, sharedSpaces: [], loadedAt: new Date(),
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
  const moveRepo = new LocalMovementRepository();
  const catRepo = new LocalCategoryRepository();
  const habitRepo = new LocalHabitRepository();
  const [start, end] = calculateMonthlyCycle(refDate);
  const [prevStart, prevEnd] = calculateMonthlyCycle(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1));

  const [movements, previousMovements, allMovements, accounts, distCategories, expenseCategories, debts, sources,
    loans, savingsGoals, habits, tasks, sharedSpaces] = await Promise.all([
    safe(() => moveRepo.getAllByCycle(userId, start, end), [] as Movement[]),
    safe(() => moveRepo.getAllByCycle(userId, prevStart, prevEnd), [] as Movement[]),
    safe(() => moveRepo.getAll(userId), [] as Movement[]),
    safe(() => new LocalPaymentAccountRepository().getAll(userId), [] as PaymentAccount[]),
    safe(() => catRepo.getDistributionCategories(userId), [] as DistributionCategory[]),
    safe(() => catRepo.getExpenseCategories(userId), [] as ExpenseCategory[]),
    safe(() => new LocalDebtRepository().getAll(userId), [] as Debt[]),
    safe(() => new LocalIncomeSourceRepository().getAll(userId), []),
    safe(() => new LocalInstallmentLoanRepository().getAll(userId), [] as InstallmentLoan[]),
    safe(() => new LocalSavingsGoalRepository().getAll(userId), [] as SavingsGoal[]),
    safe(() => habitRepo.getAll(userId), [] as Habit[]),
    safe(() => new LocalTaskRepository().getAllIncludingDone(userId), [] as Task[]),
    safe(async () => {
      const spaces = await new LocalSharedSpaceRepository().getAllForUser(userId);
      return Promise.all(spaces.map(async (space): Promise<SharedSpaceSummary> => {
        const shared = await new LocalSharedMovementRepository().getAllForSpace(space.id);
        return { id: space.id, name: space.name, netCents: calculateUserSharedNet(calculateSharedBalance(shared), userId) };
      }));
    }, [] as SharedSpaceSummary[]),
  ]);

  const [subcategories, completions] = await Promise.all([
    safe(async () => (await Promise.all(expenseCategories.map(cat => catRepo.getSubcategories(cat.id)))).flat(), [] as ExpenseSubcategory[]),
    safe(async () => Promise.all(habits.map(async habit => [habit.id, await habitRepo.getCompletions(habit.id)] as const)), [] as (readonly [string, HabitCompletion[]])[]),
  ]);

  return {
    movements, previousMovements, allMovements, accounts, distCategories, expenseCategories,
    expenseSubcategories: subcategories,
    debts, loans, savingsGoals, habits, tasks, sharedSpaces,
    completionsByHabit: Object.fromEntries(completions),
    expectedIncome: sources.reduce((total, source) => total + source.amount, 0),
    loadedAt: new Date(),
  };
}

function buildView(raw: RawData, refDate: Date): DashboardView {
  const today = raw.loadedAt;
  const comparison = compareMonthlyPeriods(raw.movements, raw.previousMovements);
  const breakdown = calculateCategoryBreakdown(raw.movements, raw.distCategories, raw.expenseCategories, raw.expenseSubcategories);
  const budgets = calculateBudgets(raw.expectedIncome, raw.distCategories);

  // Buckets read in 50/30/20 order (largest share first), not in storage order.
  const orderedBudgets = [...budgets].sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
  const rows: BudgetRow[] = orderedBudgets.map(cat => {
    const bucket = breakdown.find(b => b.id === cat.id);
    const spent = bucket?.spent ?? 0;
    const progress = cat.budget > 0 ? (spent / cat.budget) * 100 : 0;
    return {
      id: cat.id,
      name: cat.name,
      percentage: cat.percentage,
      budget: cat.budget,
      spent,
      progress,
      status: budgetStatusFor(progress),
      categoryNames: (bucket?.categories ?? []).map(c => c.name).join(', '),
    };
  });

  const focus = buildFocusToday(raw.habits, raw.completionsByHabit, raw.tasks, today);
  const [cycleStart, cycleEnd] = calculateMonthlyCycle(refDate);
  const sparklineEnd = cycleEnd.getTime() > today.getTime() ? today : cycleEnd;

  const mapById = <T extends { id: string; name: string }>(items: T[]) => Object.fromEntries(items.map(item => [item.id, item.name]));

  return {
    today,
    cycle: comparison.current,
    comparison,
    capitalCents: calculateAvailableCapital(raw.accounts, raw.allMovements),
    sparkline: buildCycleSparkline(raw.movements, cycleStart, sparklineEnd),
    savingsRate: calculateSavingsRate(comparison.current.income, comparison.current.expense),
    budget: {
      rows,
      expectedIncome: raw.expectedIncome,
      totalBudget: rows.reduce((sum, row) => sum + row.budget, 0),
      totalSpent: rows.reduce((sum, row) => sum + row.spent, 0),
      hasBuckets: raw.distCategories.length > 0,
    },
    focus,
    score: calculateDailyScore(focus),
    nextPending: focus.find(item => !item.done),
    primaryGoal: pickPrimarySavingsGoal(raw.savingsGoals, raw.allMovements, today),
    activeDebts: raw.debts.filter(debt => !debt.deleted_at && debt.settled_amount < debt.amount),
    activeLoans: raw.loans.flatMap(loan => {
      const next = nextInstallment(loan);
      return next ? [{ loan, next }] : [];
    }),
    sharedSpaces: raw.sharedSpaces,
    recent: selectRecentMovements(raw.allMovements, RECENT_MOVEMENTS_COUNT),
    categoryName: mapById(raw.expenseCategories),
    bucketName: mapById(raw.distCategories),
    accountName: mapById(raw.accounts),
  };
}

/**
 * Everything the Inicio screen needs for `(userId, refDate)`, read from the local (Dexie) repositories
 * so it works offline. Refreshes when a sync cycle ends and when any watched table changes locally.
 * Reloads after the first one are silent (no skeleton flash). The screen only renders `view`.
 */
export function useDashboardData(userId: string, refDateProp?: Date): DashboardData {
  const year = (refDateProp ?? new Date()).getFullYear();
  const month = (refDateProp ?? new Date()).getMonth();
  const refDate = useMemo(() => new Date(year, month, 1), [year, month]);

  const inFlight = useRef(new Set<string>());

  const load = useCallback(() => loadRaw(userId, refDate), [userId, refDate]);
  const { data: raw, loading, reload } = useLocalQuery({ load, initial: EMPTY, tables: WATCHED_TABLES });

  const view = useMemo(() => buildView(raw, refDate), [raw, refDate]);

  const runOnce = useCallback(async (key: string, action: () => Promise<unknown>) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    try {
      await action();
      await reload();
    } catch (error) {
      console.error(error);
    } finally {
      inFlight.current.delete(key);
    }
  }, [reload]);

  const completeHabit = useCallback(
    (habitId: string) => runOnce(`habit:${habitId}`, () => new LocalHabitRepository().recordCompletion(habitId, new Date(), false)),
    [runOnce],
  );
  const completeTask = useCallback(
    (taskId: string) => runOnce(`task:${taskId}`, () => new LocalTaskRepository().markDone(taskId)),
    [runOnce],
  );

  return { loading, view, completeHabit, completeTask };
}
