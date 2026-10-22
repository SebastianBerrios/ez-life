import { describe, it, expect } from 'vitest';
import { sortByCreation } from './sortByCreation';

const row = (id: string, created_at: Date | string | number) => ({ id, created_at });

describe('sortByCreation', () => {
  it('orders oldest first so new rows land at the end', () => {
    const result = sortByCreation([row('c', new Date(3000)), row('a', new Date(1000)), row('b', new Date(2000))]);
    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties by id so the order is stable', () => {
    const same = new Date(1000);
    expect(sortByCreation([row('b', same), row('c', same), row('a', same)]).map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(sortByCreation([row('c', same), row('a', same), row('b', same)]).map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('accepts Date, ISO string and numeric timestamps (rows coming from sync)', () => {
    const result = sortByCreation([
      row('iso', '2026-10-22T10:00:00.000Z'),
      row('num', Date.UTC(2026, 9, 22, 9)),
      row('date', new Date(Date.UTC(2026, 9, 22, 11))),
    ]);
    expect(result.map(r => r.id)).toEqual(['num', 'iso', 'date']);
  });

  it('does not mutate its input', () => {
    const input = [row('b', new Date(2000)), row('a', new Date(1000))];
    const snapshot = [...input];
    const result = sortByCreation(input);
    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
  });

  it('handles empty and single element lists', () => {
    expect(sortByCreation([])).toEqual([]);
    expect(sortByCreation([row('a', new Date(1))]).map(r => r.id)).toEqual(['a']);
  });

  it('keeps extra fields of each row', () => {
    const result = sortByCreation([{ id: 'a', created_at: new Date(1), name: 'Comida' }]);
    expect(result[0].name).toBe('Comida');
  });
});
