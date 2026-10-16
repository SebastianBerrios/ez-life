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
