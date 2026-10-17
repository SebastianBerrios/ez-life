import { useCallback, useMemo } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import type {
  DistributionCategory, ExpenseCategory, ExpenseSubcategory, Goal, Habit, IncomeSource, Movement, PaymentAccount, SavingsGoal, Task,
} from '../../core/domain/models/types';
import { buildPaletteIndex, type PaletteEntry } from '../../core/use-cases/buildPaletteIndex';
import type { MovementLookups } from '../../core/use-cases/describeMovement';
import { useLocalQuery } from './useLocalQuery';

const WATCHED_TABLES = [
  'movements', 'tasks', 'habits', 'goals', 'savings_goals', 'payment_accounts',
  'expense_categories', 'expense_subcategories', 'income_sources', 'distribution_categories',
];

interface Raw {
  movements: Movement[];
  accounts: PaymentAccount[];
  buckets: DistributionCategory[];
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  incomeSources: IncomeSource[];
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  savingsGoals: SavingsGoal[];
  loadedAt: Date;
}

const EMPTY: Raw = {
  movements: [], accounts: [], buckets: [], categories: [], subcategories: [], incomeSources: [],
  tasks: [], habits: [], goals: [], savingsGoals: [], loadedAt: new Date(),
};

/** One failing source must not blank the palette: log it and fall back to an empty value. */
async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

async function loadRaw(userId: string): Promise<Raw> {
  const categoryRepo = new LocalCategoryRepository();
  const [movements, accounts, buckets, categories, incomeSources, tasks, habits, goals, savingsGoals] = await Promise.all([
    safe(() => new LocalMovementRepository().getAll(userId), [] as Movement[]),
    safe(() => new LocalPaymentAccountRepository().getAll(userId), [] as PaymentAccount[]),
    safe(() => categoryRepo.getDistributionCategories(userId), [] as DistributionCategory[]),
    safe(() => categoryRepo.getExpenseCategories(userId), [] as ExpenseCategory[]),
    safe(() => new LocalIncomeSourceRepository().getAll(userId), [] as IncomeSource[]),
    safe(() => new LocalTaskRepository().getAllIncludingDone(userId), [] as Task[]),
    safe(() => new LocalHabitRepository().getAll(userId), [] as Habit[]),
    safe(() => new LocalGoalRepository().getAll(userId), [] as Goal[]),
    safe(() => new LocalSavingsGoalRepository().getAll(userId), [] as SavingsGoal[]),
  ]);
  const subcategories = await safe(
    async () => (await Promise.all(categories.map(category => categoryRepo.getSubcategories(category.id)))).flat(),
    [] as ExpenseSubcategory[],
  );
  return { movements, accounts, buckets, categories, subcategories, incomeSources, tasks, habits, goals, savingsGoals, loadedAt: new Date() };
}

const byId = <T extends { id: string; name: string }>(items: T[]) => Object.fromEntries(items.map(item => [item.id, item.name]));

export interface PaletteData {
  loading: boolean;
  index: PaletteEntry[];
}

/**
 * Everything the ⌘K palette searches, read from the local (Dexie) repositories so it works offline.
 * Mount it only while the palette is open: it loads on mount and refreshes silently on local changes
 * and after each sync, so the list never goes stale while open.
 */
export function usePaletteData(userId: string, gamificationVisible: boolean): PaletteData {
  const load = useCallback(() => loadRaw(userId), [userId]);
  const { data: raw, loading } = useLocalQuery({ load, initial: EMPTY, tables: WATCHED_TABLES });

  const index = useMemo(() => {
    const lookups: MovementLookups = {
      categoryName: byId(raw.categories),
      subcategoryName: byId(raw.subcategories),
      incomeSourceName: byId(raw.incomeSources),
      bucket: Object.fromEntries(raw.buckets.map(bucket => [bucket.id, { name: bucket.name, percentage: bucket.percentage }])),
      accountName: byId(raw.accounts),
    };
    return buildPaletteIndex({
      movements: raw.movements, lookups, tasks: raw.tasks, habits: raw.habits, goals: raw.goals,
      savingsGoals: raw.savingsGoals, accounts: raw.accounts, today: raw.loadedAt, gamificationVisible,
    });
  }, [raw, gamificationVisible]);

  return { loading, index };
}
