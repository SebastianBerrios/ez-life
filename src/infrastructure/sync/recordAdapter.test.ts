import { it, expect } from 'vitest';
import { fromRemoteRecord, toRemoteRecord } from './recordAdapter';
import { calendarKey } from '../../core/use-cases/calendar';
it('preserves calendar dates from SQL date columns in the local timezone', () => {
  const row = fromRemoteRecord({ id: 'a', updated_at: '2026-10-08T01:00:00Z', due_date: '2026-10-08', deleted_at: null });
  expect(calendarKey(row.due_date as Date)).toBe('2026-10-08');
  expect(toRemoteRecord(row, 'tasks').due_date).toBe('2026-10-08');
  expect(row.deleted_at).toBeUndefined();
  expect(() => fromRemoteRecord({ id: 'a', updated_at: 'invalid' })).toThrow();
});
it('round-trips opening_date between Date and ISO string, and maps undefined to null', () => {
  const iso = '2026-11-10T12:00:00.000Z';
  const row = fromRemoteRecord({ id: 'acc-1', updated_at: iso, opening_date: iso });
  expect(row.opening_date).toBeInstanceOf(Date);
  expect((row.opening_date as Date).toISOString()).toBe(iso);
  expect(toRemoteRecord(row, 'payment_accounts').opening_date).toBe(iso);
  expect(toRemoteRecord({ id: 'acc-2', updated_at: new Date(iso), opening_date: undefined }, 'payment_accounts').opening_date).toBeNull();
});
