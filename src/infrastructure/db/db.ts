import Dexie, { type Table } from 'dexie';

export class EzLifeDB extends Dexie {
  profiles!: Table<any, string>;
  income_sources!: Table<any, string>;
  distribution_categories!: Table<any, string>;
  expense_categories!: Table<any, string>;
  expense_subcategories!: Table<any, string>;
  savings_goals!: Table<any, string>;
  movements!: Table<any, string>;
  sync_queue!: Table<any, string>;

  constructor() {
    super('ezlife-db');
    this.version(3).stores({
      profiles: 'id',
      income_sources: 'id, user_id',
      distribution_categories: 'id, user_id',
      expense_categories: 'id, user_id',
      expense_subcategories: 'id, category_id',
      savings_goals: 'id, user_id',
      movements: 'id, user_id, date',
      sync_queue: 'id, created_at'
    }).upgrade(trans => {
      // Automatic upgrade handled by Dexie
    });

    this.setupHooks();
  }

  private setupHooks() {
    const tablesToSync = [
      'profiles', 'income_sources', 'distribution_categories',
      'expense_categories', 'expense_subcategories', 'savings_goals', 'movements'
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
