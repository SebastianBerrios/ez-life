import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';

describe('Local Database (Dexie.js)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('should initialize successfully with all required tables', () => {
    expect(db.profiles).toBeDefined();
    expect(db.income_sources).toBeDefined();
    expect(db.distribution_categories).toBeDefined();
    expect(db.expense_categories).toBeDefined();
    expect(db.expense_subcategories).toBeDefined();
    expect(db.savings_goals).toBeDefined();
    expect(db.movements).toBeDefined();
    expect(db.sync_queue).toBeDefined();
  });
});
