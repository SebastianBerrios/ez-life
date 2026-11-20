import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalProfileRepository } from './LocalProfileRepository';
import { LocalIncomeSourceRepository } from './LocalIncomeSourceRepository';
import { LocalCategoryRepository } from './LocalCategoryRepository';
import { LocalDebtRepository } from './LocalDebtRepository';
import { LocalNotificationRepository } from './LocalNotificationRepository';
import { uuidv7 } from 'uuidv7';
import type { IncomeSource, Debt } from '../../../core/domain/models/types';

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

    it('ensureBalanceSince never creates a stub profile, sets balance_since once and is idempotent', async () => {
      const repo = new LocalProfileRepository();
      const missingId = uuidv7();
      const now = new Date(2026, 10, 15);

      // No local profile -> does nothing and does not enqueue sync
      expect(await repo.ensureBalanceSince(missingId, now)).toBeUndefined();
      expect(await db.profiles.get(missingId)).toBeUndefined();
      expect(await db.sync_queue.count()).toBe(0);

      // Existing profile without balance_since -> sets it once
      const id = uuidv7();
      await repo.save({ id, onboarding_step: 3 });
      await db.sync_queue.clear();

      const updated = await repo.ensureBalanceSince(id, now);
      expect(updated?.balance_since).toBe('2026-11');
      expect(await db.sync_queue.count()).toBe(1);

      // Second call -> no-op, does not change balance_since or enqueue another push
      const second = await repo.ensureBalanceSince(id, new Date(2027, 0, 5));
      expect(second?.balance_since).toBe('2026-11');
      expect(await db.sync_queue.count()).toBe(1);
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

    it('persists pay_day and received_month and rejects invalid pay_day', async () => {
      const repo = new LocalIncomeSourceRepository();
      const userId = uuidv7();

      const saved = await repo.save({
        id: '',
        user_id: userId,
        name: 'Sueldo Base',
        amount: 300000,
        pay_day: 28,
        received_month: '2026-11',
      });
      expect(saved.pay_day).toBe(28);
      expect(saved.received_month).toBe('2026-11');

      await expect(repo.save({
        id: '',
        user_id: userId,
        name: 'Sueldo',
        amount: 300000,
        pay_day: 32,
      })).rejects.toThrow('Ingresa un día entre 1 y 31.');

      await expect(repo.save({
        id: '',
        user_id: userId,
        name: 'Sueldo',
        amount: 300000,
        pay_day: 0,
      })).rejects.toThrow('Ingresa un día entre 1 y 31.');
    });
  });

  describe('LocalNotificationRepository', () => {
    it('saves and lists register_due notifications alongside existing notification types', async () => {
      const repo = new LocalNotificationRepository();
      const userId = uuidv7();

      const saved = await repo.save({
        id: '',
        user_id: userId,
        type: 'register_due',
        title: 'Toca registrar: Gimnasio',
        body: 'Gimnasio · S/ 80 · día 5',
        related_id: 'recurrence:r1:2026-11',
        cycle_key: '2026-11',
      });
      expect(saved.type).toBe('register_due');

      const all = await repo.getAllByUser(userId);
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        type: 'register_due',
        related_id: 'recurrence:r1:2026-11',
        cycle_key: '2026-11',
      });
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
      }, ['General']);

      expect(category.distribution_category_id).toBe(bucket.id);
      expect(await catRepo.countExpenseCategoriesByDistribution(bucket.id)).toBe(1);

      await catRepo.deleteExpenseCategory(category.id);
      expect(await catRepo.countExpenseCategoriesByDistribution(bucket.id)).toBe(0);
    });
  });

  describe('LocalDebtRepository', () => {
    it('creates a debt in either direction with an auto UUID', async () => {
      const repo = new LocalDebtRepository();
      const userId = uuidv7();

      const lent = await repo.save({
        id: '', user_id: userId, counterparty_name: 'Juan', direction: 'lent', origin: 'manual',
        amount: 10000, settled_amount: 0,
      } as Omit<Debt, 'created_at' | 'updated_at'>);

      expect(lent.id).toBeDefined();
      expect(lent.direction).toBe('lent');

      const all = await repo.getAll(userId);
      expect(all).toHaveLength(1);
    });

    it('accumulates partial settlements and never exceeds the debt amount (FR-003, FR-004)', async () => {
      const repo = new LocalDebtRepository();
      const userId = uuidv7();

      const debt = await repo.save({
        id: '', user_id: userId, counterparty_name: 'Ana', direction: 'borrowed', origin: 'manual',
        amount: 10000, settled_amount: 0,
      } as Omit<Debt, 'created_at' | 'updated_at'>);

      const afterFirst = await repo.recordSettlement(debt.id, 4000);
      expect(afterFirst.settled_amount).toBe(4000);

      const afterSecond = await repo.recordSettlement(debt.id, 6000);
      expect(afterSecond.settled_amount).toBe(10000);

      await expect(repo.recordSettlement(debt.id, 1)).rejects.toThrow();
    });

    it('soft deletes a debt', async () => {
      const repo = new LocalDebtRepository();
      const userId = uuidv7();

      const debt = await repo.save({
        id: '', user_id: userId, counterparty_name: 'Luis', direction: 'lent', origin: 'manual',
        amount: 5000, settled_amount: 0,
      } as Omit<Debt, 'created_at' | 'updated_at'>);

      await repo.delete(debt.id);

      expect(await repo.getAll(userId)).toHaveLength(0);
      expect(await repo.getById(debt.id)).toBeUndefined();
    });
  });
});
