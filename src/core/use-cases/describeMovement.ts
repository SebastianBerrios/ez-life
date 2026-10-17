import type { Movement } from '../domain/models/types';
import { formatMoney } from './formatMoney';
import { movementTypeLabel } from './exportMovements';

export const NO_CATEGORY_LABEL = 'Sin categoría';
export const NO_DESCRIPTION_LABEL = 'Sin descripción';
export const TRANSFER_LABEL = 'Transferencia';

/** id -> label tables used to turn a Movement into display text (all optional: missing ids degrade gracefully). */
export interface MovementLookups {
  categoryName: Record<string, string>;
  subcategoryName: Record<string, string>;
  incomeSourceName: Record<string, string>;
  bucket: Record<string, { name: string; percentage: number }>;
  accountName: Record<string, string>;
}

export const EMPTY_LOOKUPS: MovementLookups = {
  categoryName: {}, subcategoryName: {}, incomeSourceName: {}, bucket: {}, accountName: {},
};

export type MovementKind = 'income' | 'expense' | 'transfer';

export interface MovementDescription {
  kind: MovementKind;
  /** Main line: description, else the category/source, else a neutral label. */
  title: string;
  /** True when `title` is the user's own description. */
  hasDescription: boolean;
  /** Expense: category name or "Sin categoría". Income: source name or null. Transfer: null. */
  category: string | null;
  subcategory: string | null;
  /** "50% Necesidad" built from the real distribution category; expenses only. */
  bucketLabel: string | null;
  /** Payment account name; for a transfer, the origin account. */
  accountName: string | null;
  /** Transfer destination account name. */
  toAccountName: string | null;
  shared: boolean;
  adjustment: boolean;
  editable: boolean;
}

/** Linked / shared / installment movements are managed from their origin, never edited or deleted here. */
export function isMovementEditable(movement: Movement): boolean {
  return !movement.is_linked && !movement.shared_movement_id && !movement.installment_payment_id;
}

export function isSharedMovement(movement: Movement): boolean {
  return Boolean(movement.shared_movement_id || movement.is_linked);
}

/** Category (expense) or income-source id a movement is filed under; undefined for transfers/adjustments without one. */
export function movementCategoryId(movement: Movement): string | undefined {
  if (movement.type === 'TRANSFER') return undefined;
  return movement.type === 'EXPENSE' ? movement.expense_category_id : movement.income_source_id;
}

export function describeMovement(movement: Movement, lookups: MovementLookups = EMPTY_LOOKUPS): MovementDescription {
  const kind: MovementKind = movement.type === 'TRANSFER' ? 'transfer' : movement.type === 'INCOME' ? 'income' : 'expense';
  const description = movement.description?.trim() ?? '';

  let category: string | null = null;
  if (kind === 'expense') {
    category = (movement.expense_category_id && lookups.categoryName[movement.expense_category_id]) || NO_CATEGORY_LABEL;
  } else if (kind === 'income') {
    category = (movement.income_source_id && lookups.incomeSourceName[movement.income_source_id]) || null;
  }
  const subcategory = kind === 'expense' && movement.expense_subcategory_id
    ? lookups.subcategoryName[movement.expense_subcategory_id] ?? null
    : null;

  const bucket = kind === 'expense' && movement.distribution_category_id ? lookups.bucket[movement.distribution_category_id] : undefined;

  const fallbackTitle = kind === 'transfer' ? TRANSFER_LABEL : category ?? NO_DESCRIPTION_LABEL;
  return {
    kind,
    title: description || fallbackTitle,
    hasDescription: description !== '',
    category,
    subcategory,
    bucketLabel: bucket ? `${bucket.percentage}% ${bucket.name}` : null,
    accountName: movement.account_id ? lookups.accountName[movement.account_id] ?? null : null,
    toAccountName: kind === 'transfer' && movement.to_account_id ? lookups.accountName[movement.to_account_id] ?? null : null,
    shared: isSharedMovement(movement),
    adjustment: Boolean(movement.is_adjustment),
    editable: isMovementEditable(movement),
  };
}

/** Texts the search box looks into: description, category, subcategory, accounts, bucket, type and amount. */
export function movementSearchHaystacks(movement: Movement, lookups: MovementLookups = EMPTY_LOOKUPS): string[] {
  const d = describeMovement(movement, lookups);
  return [
    movement.description,
    d.title,
    d.category,
    d.subcategory,
    d.bucketLabel,
    d.accountName,
    d.toAccountName,
    movementTypeLabel(movement.type),
    d.adjustment ? 'Ajuste' : null,
    d.shared ? 'Compartido' : null,
    formatMoney(movement.amount),
    formatMoney(movement.amount, { symbol: false }),
    // Also without the thousands separator, so "3000.00" finds "3,000.00".
    formatMoney(movement.amount, { symbol: false }).replace(/,/g, ''),
  ].filter((text): text is string => Boolean(text));
}
