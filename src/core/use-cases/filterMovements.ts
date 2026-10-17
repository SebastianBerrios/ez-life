import type { Movement } from '../domain/models/types';
import { describeMovement, isSharedMovement, movementCategoryId, movementSearchHaystacks, type MovementLookups } from './describeMovement';
import { matchesQuery } from './searchText';

export type MovementFilter = 'all' | 'expense' | 'income' | 'transfer' | 'shared';
export type MovementSort = 'desc' | 'asc';
export const ALL_CATEGORIES = 'all';

export function matchesFilter(movement: Movement, filter: MovementFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case 'expense': return movement.type === 'EXPENSE';
    case 'income': return movement.type === 'INCOME';
    case 'transfer': return movement.type === 'TRANSFER';
    case 'shared': return isSharedMovement(movement);
  }
}

/** Count per filter tab ("Todos (n)", "Gastos (n)"...). A shared expense counts in both Gastos and Compartido. */
export function countByFilter(movements: readonly Movement[]): Record<MovementFilter, number> {
  const counts: Record<MovementFilter, number> = { all: 0, expense: 0, income: 0, transfer: 0, shared: 0 };
  for (const movement of movements) {
    for (const filter of Object.keys(counts) as MovementFilter[]) {
      if (matchesFilter(movement, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

export interface CategoryOption { id: string; name: string }

/** Categories and income sources actually used by `movements`, sorted by name (feeds the category filter). */
export function categoryOptions(movements: readonly Movement[], lookups: MovementLookups): CategoryOption[] {
  const seen = new Map<string, string>();
  for (const movement of movements) {
    const id = movementCategoryId(movement);
    if (!id || seen.has(id)) continue;
    const name = describeMovement(movement, lookups).category;
    if (name) seen.set(id, name);
  }
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export interface MovementSelection {
  filter: MovementFilter;
  query: string;
  /** `ALL_CATEGORIES` or an expense-category / income-source id. */
  categoryId: string;
  sort: MovementSort;
}

export const DEFAULT_SELECTION: MovementSelection = { filter: 'all', query: '', categoryId: ALL_CATEGORIES, sort: 'desc' };

export function isSelectionActive(selection: MovementSelection): boolean {
  return selection.filter !== 'all' || selection.query.trim() !== '' || selection.categoryId !== ALL_CATEGORIES;
}

/** Applies tab filter, category filter, text search and date sort (ties broken by id so the order is stable). */
export function selectMovements(movements: readonly Movement[], lookups: MovementLookups, selection: MovementSelection): Movement[] {
  const direction = selection.sort === 'asc' ? 1 : -1;
  return movements
    .filter(m => !m.deleted_at)
    .filter(m => matchesFilter(m, selection.filter))
    .filter(m => selection.categoryId === ALL_CATEGORIES || movementCategoryId(m) === selection.categoryId)
    .filter(m => matchesQuery(selection.query, movementSearchHaystacks(m, lookups)))
    .sort((a, b) => direction * (a.date.getTime() - b.date.getTime()) || direction * a.id.localeCompare(b.id));
}
