import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomSyncLayer } from './CustomSyncLayer';
import { db } from '../db/db';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), user: 'A' as string | null }));
vi.mock('../supabase/client', () => ({ getSupabaseBrowserClient: () => ({
  from: mocks.from, rpc: mocks.rpc,
  auth: { getSession: async () => ({ data: { session: mocks.user ? { user: { id: mocks.user } } : null } }) },
}) }));
const now = new Date('2026-10-08T14:00:00Z');
const row = (id: string, user = 'A') => ({ id, user_id: user, amount: 100, type: 'EXPENSE' as const,
  date: now, is_recurring: false, created_at: now, updated_at: now });
let remote: Record<string, Record<string, unknown>[]>;
let errors: Set<string>;
beforeEach(async () => {
  await db.delete(); await db.open(); localStorage.clear(); vi.clearAllMocks(); mocks.user = 'A';
  remote = {}; errors = new Set(); mocks.rpc.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    let after = '';
    const query = {
      select: () => query, order: () => query, limit: () => query,
      gt: (_key: string, id: string) => { after = id; return query; },
      then: (resolve: (value: unknown) => void) => resolve({
        data: (remote[table] ?? []).filter(r => String(r.id) > after).slice(0, 500),
        error: errors.has(table) ? { message: 'failed' } : null,
      }),
    };
    return query;
  });
});
describe('CustomSyncLayer', () => {
  it('syncs progress preferences and receipts only for the active owner', async () => {
    await db.profiles.put({ id: 'A', gamification_enabled: false, created_at: now, updated_at: now });
    await db.achievement_receipts.put({ id: 'receipt-A', user_id: 'A', achievement_id: 'tasks', celebration_handled: true, created_at: now, updated_at: now });
    await db.achievement_receipts.put({ id: 'receipt-B', user_id: 'B', achievement_id: 'tasks', celebration_handled: true, created_at: now, updated_at: now });
    await new CustomSyncLayer().sync();
    expect(mocks.rpc).toHaveBeenCalledWith('sync_record', expect.objectContaining({ table_name: 'profiles', payload: expect.objectContaining({ gamification_enabled: false }) }));
    expect(mocks.rpc).toHaveBeenCalledWith('sync_record', expect.objectContaining({ table_name: 'achievement_receipts', payload: expect.objectContaining({ id: 'receipt-A', celebration_handled: true }) }));
    expect(mocks.rpc.mock.calls.some(call => call[1].payload.id === 'receipt-B')).toBe(false);
    remote.achievement_receipts = [{ id: 'pulled', user_id: 'A', achievement_id: 'goal', celebration_handled: true, created_at: now.toISOString(), updated_at: now.toISOString() }];
    await new CustomSyncLayer().sync();
    expect((await db.achievement_receipts.get('pulled'))?.created_at).toBeInstanceOf(Date);
  });
  it('isolates A → B → A queues and leaves unknown provenance pending', async () => {
    await db.movements.put(row('a')); await db.movements.put(row('b', 'B'));
    await db.sync_queue.put({ id: 'unknown', table_name: 'movements', data: { id: 'orphan' }, created_at: now });
    const layer = new CustomSyncLayer(); await layer.sync();
    expect(mocks.rpc.mock.calls.map(c => c[1].payload.id)).toEqual(['a']);
    expect((await db.movements.get('b'))?.user_id).toBe('B');
    mocks.user = 'B'; await layer.sync();
    expect(mocks.rpc.mock.calls.map(c => c[1].payload.id)).toEqual(['a', 'b']);
    mocks.user = 'A'; await layer.sync(); expect(await db.sync_queue.count()).toBe(1);
  });
  it('reads >1000 rows with old timestamps, normalizes dates and never requeues pull', async () => {
    remote.movements = Array.from({ length: 1201 }, (_, i) => ({ ...row(String(i).padStart(4, '0')),
      date: '2020-01-01T12:00:00Z', updated_at: now.toISOString(), created_at: now.toISOString(), deleted_at: null }));
    localStorage.setItem('last_sync', '2099-01-01T00:00:00Z'); await new CustomSyncLayer().sync();
    expect(await db.movements.count()).toBe(1201);
    expect((await db.movements.get('0000'))?.date).toBeInstanceOf(Date);
    expect(await db.sync_queue.count()).toBe(0); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('preserves local tombstones despite a newer live remote row', async () => {
    await db.movements.put({ ...row('a'), deleted_at: now });
    remote.movements = [{ ...row('a'), amount: 999, updated_at: new Date(now.getTime() + 1000) }];
    await new CustomSyncLayer().sync(); expect((await db.movements.get('a'))?.amount).toBe(100);
    expect((await db.movements.get('a'))?.deleted_at).toEqual(now);
  });
  it('applies an older remote tombstone without requeuing it', async () => {
    await db.movements.put(row('a')); await db.sync_queue.clear();
    remote.movements = [{ ...row('a'), updated_at: new Date(0), deleted_at: new Date(0) }];
    await new CustomSyncLayer().sync(); expect((await db.movements.get('a'))?.deleted_at).toEqual(new Date(0));
    expect(await db.sync_queue.count()).toBe(0);
  });
  it('retains a write made while the previous version is sent', async () => {
    await db.movements.put(row('a'));
    mocks.rpc.mockImplementationOnce(async () => { await db.movements.put({ ...row('a'), amount: 200 }); return { error: null }; });
    await new CustomSyncLayer().sync(); const queue = await db.sync_queue.toArray();
    expect(queue).toHaveLength(1); expect(queue[0].data.amount).toBe(200);
  });
  it('retries failed pulls without advancing a cursor or sending incomplete state', async () => {
    await db.movements.put(row('a')); errors.add('income_sources');
    await new CustomSyncLayer().sync(); expect(await db.sync_queue.count()).toBe(1);
    errors.clear(); await new CustomSyncLayer().sync(); expect(await db.sync_queue.count()).toBe(0);
    expect(localStorage.getItem('last_sync')).toBeNull();
  });
  it('keeps failed pushes and sends null for cleared fields', async () => {
    await db.movements.put({ ...row('a'), description: undefined }); mocks.rpc.mockResolvedValue({ error: { message: 'offline' } });
    await new CustomSyncLayer().sync();
    expect(mocks.rpc).toHaveBeenCalledWith('sync_record', expect.objectContaining({ payload: expect.objectContaining({ description: null }) }));
    expect(await db.sync_queue.count()).toBe(1);
  });
  it('stops if the account changes during a response', async () => {
    mocks.from.mockImplementationOnce(() => {
      const query = { select: () => query, order: () => query, limit: () => query,
        then: (resolve: (v: unknown) => void) => { mocks.user = 'B'; resolve({ data: [{ id: 'A', updated_at: now }], error: null }); } };
      return query;
    });
    await new CustomSyncLayer().sync(); expect(await db.profiles.count()).toBe(0);
  });
  it('shares the in-flight promise between concurrent callers', async () => {
    const layer = new CustomSyncLayer(); const first = layer.sync(); expect(layer.sync()).toBe(first); await first;
  });
  it('does not sync without a session', async () => {
    mocks.user = null; await new CustomSyncLayer().sync(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('pushes payment accounts and account-linked movements, pulling accounts before movements (spec 011)', async () => {
    await db.payment_accounts.put({ id: 'acc-1', user_id: 'A', name: 'Efectivo', kind: 'cash', opening_balance: 0, created_at: now, updated_at: now });
    await db.movements.put({ ...row('m1'), account_id: 'acc-1' });
    const pulled: string[] = [];
    const base = mocks.from.getMockImplementation()!;
    mocks.from.mockImplementation((table: string) => { pulled.push(table); return base(table); });
    await new CustomSyncLayer().sync();
    expect(pulled.indexOf('payment_accounts')).toBeGreaterThanOrEqual(0);
    expect(pulled.indexOf('payment_accounts')).toBeLessThan(pulled.indexOf('movement_recurrences'));
    expect(pulled.indexOf('payment_accounts')).toBeLessThan(pulled.indexOf('movements'));
    const pushed = mocks.rpc.mock.calls.map(c => c[1] as { table_name: string; payload: Record<string, unknown> });
    expect(pushed.find(p => p.table_name === 'payment_accounts')?.payload).toMatchObject({ id: 'acc-1', kind: 'cash', opening_balance: 0 });
    expect(pushed.find(p => p.table_name === 'movements')?.payload).toMatchObject({ id: 'm1', account_id: 'acc-1' });
    expect(pushed.findIndex(p => p.table_name === 'payment_accounts')).toBeLessThan(pushed.findIndex(p => p.table_name === 'movements'));
  });
  it('pulls remote payment accounts into the local table', async () => {
    remote.payment_accounts = [{ id: 'acc-9', user_id: 'A', name: 'BCP', kind: 'debit', opening_balance: 1500, archived: null, created_at: now.toISOString(), updated_at: now.toISOString(), deleted_at: null }];
    await new CustomSyncLayer().sync();
    expect(await db.payment_accounts.get('acc-9')).toMatchObject({ name: 'BCP', opening_balance: 1500, created_at: expect.any(Date) });
    expect(await db.sync_queue.count()).toBe(0);
  });
  it('sends a task due date as its local calendar key, with priority and tag', async () => {
    await db.tasks.put({ id: 't1', user_id: 'A', title: 'Entrega', due_date: new Date(2026, 9, 16, 19, 0), status: 'pending', priority: 'high', tag: 'Maestría', created_at: now, updated_at: now });
    await new CustomSyncLayer().sync();
    const call = mocks.rpc.mock.calls.map(c => c[1]).find(c => c.table_name === 'tasks');
    expect(call.payload).toMatchObject({ due_date: '2026-10-16', priority: 'high', tag: 'Maestría' });
  });
});
