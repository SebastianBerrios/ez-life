import { describe, expect, it } from 'vitest';
import type { Movement } from '../domain/models/types';
import type { MovementLookups } from './describeMovement';
import {
  ALL_CATEGORIES, categoryOptions, countByFilter, DEFAULT_SELECTION, isSelectionActive, matchesFilter, selectMovements,
} from './filterMovements';

function movement(patch: Partial<Movement> & { id: string }): Movement {
  return {
    user_id: 'u', type: 'EXPENSE', amount: 1000, date: new Date(2026, 9, 10, 12), is_recurring: false,
    created_at: new Date(), updated_at: new Date(), ...patch,
  };
}

const lookups: MovementLookups = {
  categoryName: { c1: 'Alimentación', c2: 'Transporte' },
  subcategoryName: {},
  incomeSourceName: { i1: 'Sueldo' },
  bucket: { b1: { name: 'Necesidades', percentage: 50 } },
  accountName: { a1: 'BCP Débito', a2: 'Efectivo' },
};

const movements = [
  movement({ id: 'e1', description: 'Almuerzo', expense_category_id: 'c1', distribution_category_id: 'b1', account_id: 'a1', amount: 1250, date: new Date(2026, 9, 12, 14, 15) }),
  movement({ id: 'e2', description: 'Taxi', expense_category_id: 'c2', account_id: 'a2', amount: 800, date: new Date(2026, 9, 14, 8, 0), is_linked: true, shared_movement_id: 'sm' }),
  movement({ id: 'i1', type: 'INCOME', income_source_id: 'i1', amount: 300000, date: new Date(2026, 9, 1, 9, 0) }),
  movement({ id: 't1', type: 'TRANSFER', account_id: 'a1', to_account_id: 'a2', amount: 5000, date: new Date(2026, 9, 5, 10, 0) }),
];

describe('countByFilter / matchesFilter', () => {
  it('counts each tab; a shared expense counts in Gastos and Compartido', () => {
    expect(countByFilter(movements)).toEqual({ all: 4, expense: 2, income: 1, transfer: 1, shared: 1 });
    expect(matchesFilter(movements[1], 'expense')).toBe(true);
    expect(matchesFilter(movements[1], 'shared')).toBe(true);
    expect(matchesFilter(movements[0], 'shared')).toBe(false);
  });
  it('counts an empty month as zeros', () => {
    expect(countByFilter([])).toEqual({ all: 0, expense: 0, income: 0, transfer: 0, shared: 0 });
  });
});

describe('selectMovements', () => {
  it('sorts newest first by default and oldest first when asked', () => {
    expect(selectMovements(movements, lookups, DEFAULT_SELECTION).map(m => m.id)).toEqual(['e2', 'e1', 't1', 'i1']);
    expect(selectMovements(movements, lookups, { ...DEFAULT_SELECTION, sort: 'asc' }).map(m => m.id)).toEqual(['i1', 't1', 'e1', 'e2']);
  });
  it('breaks date ties by id', () => {
    const same = new Date(2026, 9, 3, 9, 0);
    const tied = [movement({ id: 'b', date: same }), movement({ id: 'a', date: same })];
    expect(selectMovements(tied, lookups, DEFAULT_SELECTION).map(m => m.id)).toEqual(['b', 'a']);
    expect(selectMovements(tied, lookups, { ...DEFAULT_SELECTION, sort: 'asc' }).map(m => m.id)).toEqual(['a', 'b']);
  });
  it('filters by tab', () => {
    expect(selectMovements(movements, lookups, { ...DEFAULT_SELECTION, filter: 'transfer' }).map(m => m.id)).toEqual(['t1']);
    expect(selectMovements(movements, lookups, { ...DEFAULT_SELECTION, filter: 'income' }).map(m => m.id)).toEqual(['i1']);
    expect(selectMovements(movements, lookups, { ...DEFAULT_SELECTION, filter: 'shared' }).map(m => m.id)).toEqual(['e2']);
  });
  it('filters by category or income source and hides transfers when one is chosen', () => {
    expect(selectMovements(movements, lookups, { ...DEFAULT_SELECTION, categoryId: 'c1' }).map(m => m.id)).toEqual(['e1']);
    expect(selectMovements(movements, lookups, { ...DEFAULT_SELECTION, categoryId: 'i1' }).map(m => m.id)).toEqual(['i1']);
  });
  it('searches description, category, account, bucket and amount ignoring accents/case', () => {
    const find = (query: string) => selectMovements(movements, lookups, { ...DEFAULT_SELECTION, query }).map(m => m.id);
    expect(find('ALMUERZO')).toEqual(['e1']);
    expect(find('alimentacion')).toEqual(['e1']);
    expect(find('debito')).toEqual(['e1', 't1']);
    expect(find('50% necesidades')).toEqual(['e1']);
    expect(find('8.00')).toEqual(['e2']);
    expect(find('3000.00')).toEqual(['i1']);
    expect(find('nada que ver')).toEqual([]);
  });
  it('combines the tab, category and search constraints and skips deleted rows', () => {
    const withDeleted = [...movements, movement({ id: 'x', description: 'Almuerzo', deleted_at: new Date() })];
    expect(selectMovements(withDeleted, lookups, { filter: 'expense', query: 'almuerzo', categoryId: 'c1', sort: 'desc' }).map(m => m.id)).toEqual(['e1']);
    expect(selectMovements(withDeleted, lookups, { filter: 'income', query: 'almuerzo', categoryId: ALL_CATEGORIES, sort: 'desc' })).toEqual([]);
  });
  it('does not mutate its input', () => {
    const copy = [...movements];
    selectMovements(movements, lookups, DEFAULT_SELECTION);
    expect(movements).toEqual(copy);
  });
});

describe('categoryOptions / isSelectionActive', () => {
  it('lists the categories and sources in use, sorted by name, without duplicates or transfers', () => {
    const more = [...movements, movement({ id: 'e3', expense_category_id: 'c1' })];
    expect(categoryOptions(more, lookups)).toEqual([
      { id: 'c1', name: 'Alimentación' }, { id: 'i1', name: 'Sueldo' }, { id: 'c2', name: 'Transporte' },
    ]);
  });
  it('reports whether any filter narrows the list', () => {
    expect(isSelectionActive(DEFAULT_SELECTION)).toBe(false);
    expect(isSelectionActive({ ...DEFAULT_SELECTION, sort: 'asc' })).toBe(false);
    expect(isSelectionActive({ ...DEFAULT_SELECTION, query: ' x ' })).toBe(true);
    expect(isSelectionActive({ ...DEFAULT_SELECTION, filter: 'income' })).toBe(true);
    expect(isSelectionActive({ ...DEFAULT_SELECTION, categoryId: 'c1' })).toBe(true);
    expect(isSelectionActive({ ...DEFAULT_SELECTION, query: '   ' })).toBe(false);
  });
});
