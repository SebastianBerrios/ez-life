import { describe, expect, it } from 'vitest';
import { selectRecentMovements } from './selectRecentMovements';
import type { Movement } from '../domain/models/types';

const created = new Date(2026, 9, 1);
const move = (id: string, date: Date, o: Partial<Movement> = {}): Movement => ({
  id, user_id: 'u', type: 'EXPENSE', amount: 100, date, is_recurring: false, created_at: created, updated_at: created, ...o,
});

describe('selectRecentMovements', () => {
  it('returns the latest n by date descending without mutating the input', () => {
    const input = [move('a', new Date(2026, 9, 1)), move('b', new Date(2026, 9, 3)), move('c', new Date(2026, 9, 2))];
    expect(selectRecentMovements(input, 2).map(m => m.id)).toEqual(['b', 'c']);
    expect(input.map(m => m.id)).toEqual(['a', 'b', 'c']);
  });
  it('skips deleted rows and flags transfers', () => {
    const result = selectRecentMovements([
      move('t', new Date(2026, 9, 5), { type: 'TRANSFER', account_id: 'x', to_account_id: 'y' }),
      move('d', new Date(2026, 9, 6), { deleted_at: created }),
      move('e', new Date(2026, 9, 4)),
    ], 5);
    expect(result.map(m => [m.id, m.isTransfer])).toEqual([['t', true], ['e', false]]);
  });
  it('breaks date ties by creation time and handles n <= 0', () => {
    const day = new Date(2026, 9, 4, 10);
    const result = selectRecentMovements([move('old', day), move('new', day, { created_at: new Date(2026, 9, 2) })], 5);
    expect(result.map(m => m.id)).toEqual(['new', 'old']);
    expect(selectRecentMovements([move('a', day)], 0)).toEqual([]);
  });
});
