import { describe, expect, it } from 'vitest';
import { buildCycleSparkline } from './buildCycleSparkline';
import type { Movement } from '../domain/models/types';

const created = new Date(2026, 9, 1);
const move = (type: Movement['type'], amount: number, date: Date, o: Partial<Movement> = {}): Movement => ({
  id: `m-${Math.random()}`, user_id: 'u', type, amount, date, is_recurring: false, created_at: created, updated_at: created, ...o,
});

describe('buildCycleSparkline', () => {
  const start = new Date(2026, 9, 1);
  const end = new Date(2026, 9, 5, 23, 59);

  it('accumulates the net per day and carries it across days without movements', () => {
    const { points, daysWithData } = buildCycleSparkline([
      move('INCOME', 10000, new Date(2026, 9, 1, 9)),
      move('EXPENSE', 2500, new Date(2026, 9, 3, 21, 30)),
      move('EXPENSE', 500, new Date(2026, 9, 3, 8)),
    ], start, end);
    expect(points.map(p => p.value)).toEqual([10000, 10000, 7000, 7000, 7000]);
    expect(daysWithData).toBe(2);
  });

  it('excludes transfers and deleted rows', () => {
    const { points, daysWithData } = buildCycleSparkline([
      move('TRANSFER', 9999, new Date(2026, 9, 2), { account_id: 'a', to_account_id: 'b' }),
      move('INCOME', 100, new Date(2026, 9, 2), { deleted_at: created }),
    ], start, end);
    expect(points.every(p => p.value === 0)).toBe(true);
    expect(daysWithData).toBe(0);
  });

  it('uses the local calendar day (a late-evening movement stays on its own day)', () => {
    const { points } = buildCycleSparkline([move('INCOME', 100, new Date(2026, 9, 2, 23, 30))], start, end);
    expect(points.map(p => p.value)).toEqual([0, 100, 100, 100, 100]);
  });
});
