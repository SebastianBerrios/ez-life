import Dexie, { type Table } from 'dexie';
import type {
  Profile,
  IncomeSource,
  DistributionCategory,
  ExpenseCategory,
  ExpenseSubcategory,
  SavingsGoal,
  Movement,
  Notification,
  Debt,
  SharedSpace,
  Membership,
  SharedInvite,
  SharedMovement,
  Habit,
  HabitCompletion,
  Goal,
  Task,
  InstallmentLoan,
  InstallmentPayment,
} from '../../core/domain/models/types';

export interface SyncQueueItem {
  id: string;
  table_name: string;
  data: Record<string, unknown>;
  created_at: Date;
}

// Tables whose writes get mirrored into `sync_queue` by the creating/updating
// hooks below. A plain `db.<table>.put(...)` call only opens an implicit
// IndexedDB transaction scoped to `<table>` — without the dbcore middleware
// registered in `setupSyncQueueTransactionScope()`, the hook's
// `trans.table('sync_queue').put(...)` silently targets a store outside that
// transaction's scope and the write is dropped with no error (confirmed
// against real IndexedDB, not just fake-indexeddb).
const SYNCED_TABLES = [
  'profiles', 'income_sources', 'distribution_categories',
  'expense_categories', 'expense_subcategories', 'savings_goals', 'movements',
  'notifications', 'debts', 'habits', 'habit_completions', 'goals', 'tasks',
  'installment_loans', 'installment_payments'
] as const;

export class EzLifeDB extends Dexie {
  profiles!: Table<Profile, string>;
  income_sources!: Table<IncomeSource, string>;
  distribution_categories!: Table<DistributionCategory, string>;
  expense_categories!: Table<ExpenseCategory, string>;
  expense_subcategories!: Table<ExpenseSubcategory, string>;
  savings_goals!: Table<SavingsGoal, string>;
  movements!: Table<Movement, string>;
  notifications!: Table<Notification, string>;
  debts!: Table<Debt, string>;
  shared_spaces!: Table<SharedSpace, string>;
  memberships!: Table<Membership, string>;
  shared_invites!: Table<SharedInvite, string>;
  shared_movements!: Table<SharedMovement, string>;
  habits!: Table<Habit, string>;
  habit_completions!: Table<HabitCompletion, string>;
  goals!: Table<Goal, string>;
  tasks!: Table<Task, string>;
  installment_loans!: Table<InstallmentLoan, string>;
  installment_payments!: Table<InstallmentPayment, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor() {
    super('ezlife-db');
    this.version(4).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    this.version(5).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      notifications: 'id, user_id, created_at',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    this.version(6).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      notifications: 'id, user_id, created_at',
      debts: 'id, user_id, due_date',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    // shared_spaces/memberships/shared_invites/shared_movements are
    // deliberately NOT in the hook-driven tablesToSync below: writes to
    // those go through server-side RPCs only (contracts/rpc-functions.md) —
    // there is no direct-insert RLS policy for them to push against.
    // They're still pulled down by CustomSyncLayer so other members'
    // changes arrive locally.
    this.version(7).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      notifications: 'id, user_id, created_at',
      debts: 'id, user_id, due_date',
      shared_spaces: 'id, status',
      memberships: 'id, shared_space_id, user_id',
      shared_invites: 'id, shared_space_id, code',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    this.version(8).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      notifications: 'id, user_id, created_at',
      debts: 'id, user_id, due_date',
      shared_spaces: 'id, status',
      memberships: 'id, shared_space_id, user_id',
      shared_invites: 'id, shared_space_id, code',
      shared_movements: 'id, shared_space_id, date',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    this.version(9).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      notifications: 'id, user_id, created_at',
      debts: 'id, user_id, due_date',
      shared_spaces: 'id, status',
      memberships: 'id, shared_space_id, user_id',
      shared_invites: 'id, shared_space_id, code',
      shared_movements: 'id, shared_space_id, date',
      habits: 'id, user_id',
      habit_completions: 'id, habit_id, date',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    this.version(10).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      notifications: 'id, user_id, created_at',
      debts: 'id, user_id, due_date',
      shared_spaces: 'id, status',
      memberships: 'id, shared_space_id, user_id',
      shared_invites: 'id, shared_space_id, code',
      shared_movements: 'id, shared_space_id, date',
      habits: 'id, user_id',
      habit_completions: 'id, habit_id, date',
      goals: 'id, user_id, status',
      tasks: 'id, user_id, status, due_date',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    this.version(11).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id, distribution_category_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      notifications: 'id, user_id, created_at',
      debts: 'id, user_id, due_date',
      shared_spaces: 'id, status',
      memberships: 'id, shared_space_id, user_id',
      shared_invites: 'id, shared_space_id, code',
      shared_movements: 'id, shared_space_id, date',
      habits: 'id, user_id',
      habit_completions: 'id, habit_id, date',
      goals: 'id, user_id, status',
      tasks: 'id, user_id, status, due_date',
      installment_loans: 'id, user_id, status',
      installment_payments: 'id, installment_loan_id, date',
      sync_queue: 'id, created_at'
    }).upgrade(() => {
      // Automatic upgrade handled by Dexie
    });

    this.setupSyncQueueTransactionScope();
    this.setupHooks();
  }

  // Ensures `sync_queue` is always included in the scope of any read-write
  // transaction that touches a synced table, so the creating/updating hooks
  // below can reliably write into it via `trans.table('sync_queue')` — see
  // the comment on `SYNCED_TABLES` for why this is otherwise silently broken.
  private setupSyncQueueTransactionScope() {
    this.use({
      stack: 'dbcore',
      name: 'sync-queue-scope',
      create: (down) => ({
        ...down,
        transaction: (stores, mode, options) => {
          const needsQueue = mode === 'readwrite' &&
            !stores.includes('sync_queue') &&
            stores.some(store => (SYNCED_TABLES as readonly string[]).includes(store));
          return down.transaction(needsQueue ? [...stores, 'sync_queue'] : stores, mode, options);
        }
      })
    });
  }

  private setupHooks() {
    SYNCED_TABLES.forEach(tableName => {
      const table = this.table(tableName);

      table.hook('creating', (primKey, obj, trans) => {
        const id = crypto.randomUUID(); // uuidv4 is fine for queue id
        trans.table('sync_queue').put({
          id,
          table_name: tableName,
          data: obj,
          created_at: new Date()
        });
      });

      table.hook('updating', (mods, primKey, obj, trans) => {
        const id = crypto.randomUUID();
        trans.table('sync_queue').put({
          id,
          table_name: tableName,
          data: { ...obj, ...mods },
          created_at: new Date()
        });
      });
    });
  }
}

export const db = new EzLifeDB();
