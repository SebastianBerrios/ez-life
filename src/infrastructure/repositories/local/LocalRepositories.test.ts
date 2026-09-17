import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalProfileRepository } from './LocalProfileRepository';
import { LocalIncomeSourceRepository } from './LocalIncomeSourceRepository';
import { LocalCategoryRepository } from './LocalCategoryRepository';
import { uuidv7 } from 'uuidv7';
import type { IncomeSource } from '../../../core/domain/models/types';

describe('Local Repositories', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  describe('LocalProfileRepository', () => {
    it('should save and get a profile, updating timestamps', async () => {
      const repo = new LocalProfileRepository();
      const id = uuidv7();
      
      const saved = await repo.save({ id });
      expect(saved.id).toBe(id);
      expect(saved.created_at).toBeInstanceOf(Date);
      expect(saved.updated_at).toBeInstanceOf(Date);
      
      // Update
      const updated = await repo.save({ id });
      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(saved.updated_at.getTime());
      
      const fetched = await repo.get(id);
      expect(fetched?.id).toBe(id);
    });
  });

  describe('LocalIncomeSourceRepository', () => {
    it('should create with auto UUID, list non-deleted, and soft delete', async () => {
      const repo = new LocalIncomeSourceRepository();
      const userId = uuidv7();
      
      const source1 = await repo.save({ id: '', user_id: userId, name: 'Salary', amount: 500000 } as Omit<IncomeSource, 'created_at' | 'updated_at'>);
      const source2 = await repo.save({ id: '', user_id: userId, name: 'Freelance', amount: 100000 } as Omit<IncomeSource, 'created_at' | 'updated_at'>);
      
      expect(source1.id).toBeDefined();
      expect(source1.created_at).toBeDefined();
      
      let all = await repo.getAll(userId);
      expect(all).toHaveLength(2);
      
      // Soft delete
      await repo.delete(source1.id);
      all = await repo.getAll(userId);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(source2.id);
      
      // Verify DB actually kept it with deleted_at
      const raw = await db.income_sources.get(source1.id);
      expect(raw?.deleted_at).toBeInstanceOf(Date);
    });
  });

  describe('LocalCategoryRepository', () => {
    it('persists distribution_category_id on expense categories and counts them per bucket', async () => {
      const catRepo = new LocalCategoryRepository();
      const userId = uuidv7();

      const bucket = await catRepo.saveDistributionCategory({
        id: uuidv7(), user_id: userId, name: 'Necesidades', percentage: 50, is_default: true, is_savings: false,
      });

      expect(await catRepo.countExpenseCategoriesByDistribution(bucket.id)).toBe(0);

      const category = await catRepo.saveExpenseCategory({
        id: uuidv7(), user_id: userId, distribution_category_id: bucket.id, name: 'Alimentación',
      });

      expect(category.distribution_category_id).toBe(bucket.id);
      expect(await catRepo.countExpenseCategoriesByDistribution(bucket.id)).toBe(1);

      await catRepo.deleteExpenseCategory(category.id);
      expect(await catRepo.countExpenseCategoriesByDistribution(bucket.id)).toBe(0);
    });
  });
});
