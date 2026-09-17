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
} from '../../core/domain/models/types';

interface SyncQueueItem {
  id: string;
  table_name: string;
  data: Record<string, unknown>;
  created_at: Date;
}

export class EzLifeDB extends Dexie {
  profiles!: Table<Profile, string>;
  income_sources!: Table<IncomeSource, string>;
  distribution_categories!: Table<DistributionCategory, string>;
  expense_categories!: Table<ExpenseCategory, string>;
  expense_subcategories!: Table<ExpenseSubcategory, string>;
  savings_goals!: Table<SavingsGoal, string>;
  movements!: Table<Movement, string>;
  notifications!: Table<Notification, string>;
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

    this.setupHooks();
  }

  private setupHooks() {
    const tablesToSync = [
      'profiles', 'income_sources', 'distribution_categories',
      'expense_categories', 'expense_subcategories', 'savings_goals', 'movements',
      'notifications'
    ];

    tablesToSync.forEach(tableName => {
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
