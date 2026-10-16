import { beforeEach, it, expect, vi } from 'vitest';
import { db } from '../../db/db';
import { LocalOnboardingRepository } from './LocalOnboardingRepository';
import { LocalProfileRepository } from './LocalProfileRepository';
beforeEach(async () => { await db.delete(); await db.open(); vi.restoreAllMocks(); });
it('atomically persists completed income step and retries without duplicate sources', async () => {
  const repo = new LocalOnboardingRepository(); await repo.saveIncome('A', 10000); await repo.saveIncome('A', 10000);
  expect(await db.income_sources.count()).toBe(1); expect(await repo.progress('A')).toBe(1);
  expect((await db.profiles.get('A'))?.onboarding_income_source_id).toBe((await db.income_sources.toArray())[0].id);
});
it('rolls back initial income if persisting the step fails', async () => {
  vi.spyOn(LocalProfileRepository.prototype, 'save').mockRejectedValue(new Error('failed'));
  await expect(new LocalOnboardingRepository().saveIncome('A', 10000)).rejects.toThrow();
  expect(await db.income_sources.count()).toBe(0); expect(await db.sync_queue.count()).toBe(0);
});
it('does not infer completed distribution when an explicit income-only step was saved', async () => {
  await new LocalOnboardingRepository().saveIncome('A', 10000);
  await db.distribution_categories.put({ id: 'bucket', user_id: 'A', name: 'Ahorro', percentage: 100, is_default: true, is_savings: true, created_at: new Date(), updated_at: new Date() });
  expect(await new LocalOnboardingRepository().progress('A')).toBe(1);
});
