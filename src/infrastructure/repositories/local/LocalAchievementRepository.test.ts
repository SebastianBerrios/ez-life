import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { LocalAchievementRepository } from './LocalAchievementRepository';
import { parseCalendarDate } from '../../../core/use-cases/calendar';
import { stableId } from '../../../core/use-cases/stableId';

const repo = new LocalAchievementRepository();
const now = parseCalendarDate('2026-10-09');
const base = { created_at: now, updated_at: now };
beforeEach(async () => { await db.delete(); await db.open(); await db.profiles.put({ ...base, id: 'u' }); });
async function seed(count: number, userId = 'u') {
  await db.tasks.bulkPut(Array.from({ length: count }, (_, i) => ({ ...base, updated_at: new Date(), id: `${userId}-${i}`, user_id: userId, title: 'Tarea', status: 'done' as const, due_date: now })));
}
describe('achievement persistence', () => {
  it('silently recognizes history arriving in a first pull after initialization', async () => {
    await repo.reconcile('u');
    await seed(10);
    await db.tasks.toCollection().modify({ updated_at: new Date(2020, 0, 1) });
    expect(await repo.reconcile('u')).toEqual([]);
    expect(await db.notifications.count()).toBe(0);
  });
  it('initializes historical achievements silently and isolates accounts', async () => {
    await seed(10); await seed(10, 'other');
    expect(await repo.reconcile('u')).toEqual([]);
    expect(await db.achievement_receipts.count()).toBe(6);
    expect(await db.notifications.count()).toBe(0);
    expect((await repo.snapshot('other')).receipts).toEqual([]);
  });
  it('deduplicates concurrent evaluations and preserves handling after correction and recovery', async () => {
    await repo.reconcile('u'); await seed(10);
    const results = await Promise.all([repo.reconcile('u'), repo.reconcile('u')]);
    expect(results.flat()).toEqual(['tasks']);
    expect(await db.notifications.count()).toBe(1);
    await db.tasks.delete('u-0'); await repo.reconcile('u'); await seed(10);
    expect(await repo.reconcile('u')).toEqual([]);
    expect(await db.notifications.count()).toBe(1);
    expect((await db.sync_queue.toArray()).some(row => row.table_name === 'achievement_receipts')).toBe(true);
  });
  it('consumes suppressed celebrations and handles remote receipts without requeueing', async () => {
    await repo.reconcile('u'); await db.profiles.update('u', { gamification_enabled: false }); await seed(10);
    expect(await repo.reconcile('u')).toEqual([]);
    await db.profiles.update('u', { gamification_enabled: true });
    expect(await repo.reconcile('u')).toEqual([]);
    const id = stableId('achievement:u:tasks');
    await db.sync_queue.clear();
    await db.applyRemoteRecords('achievement_receipts', [{ ...base, updated_at: new Date(now.getTime() + 100000), id, user_id: 'u', achievement_id: 'tasks', celebration_handled: false }]);
    expect((await db.achievement_receipts.get(id))?.celebration_handled).toBe(true);
    expect(await db.sync_queue.count()).toBe(0);
  });
  it('respects the existing in-app notification preference', async () => {
    await repo.reconcile('u');
    await db.profiles.update('u', { inapp_enabled: false });
    await seed(10);
    expect(await repo.reconcile('u')).toEqual([]);
    expect(await db.notifications.count()).toBe(0);
    await db.profiles.update('u', { inapp_enabled: true });
    expect(await repo.reconcile('u')).toEqual([]);
  });
});
