import { DomainError } from '../domain/errors/DomainError';
import type { DistributionCategory, MovementType } from '../domain/models/types';

/** More expense categories than this render inside a scroll area instead of growing the form. */
export const MAX_INLINE_CATEGORIES = 8;

export function isLongCategoryList(count: number): boolean {
  return count > MAX_INLINE_CATEGORIES;
}

/** "Necesidades Básicas (50%)" — the bucket line shown under each expense category card. */
export function bucketLabel(bucket: Pick<DistributionCategory, 'name' | 'percentage'> | undefined): string {
  if (!bucket) return 'Sin distribución';
  return `${bucket.name} (${bucket.percentage}%)`;
}

export interface SharedToggleInput {
  /** The form is editing an existing movement. */
  editing: boolean;
  type: MovementType;
  isAdjustment: boolean;
  /** Number of shared spaces the user still belongs to. */
  activeSpaces: number;
}

/**
 * "¿Afecta al Espacio Compartido?" is only offered when creating a personal expense (never an
 * adjustment) and the user belongs to at least one shared space.
 */
export function canShareExpense({ editing, type, isAdjustment, activeSpaces }: SharedToggleInput): boolean {
  return !editing && type === 'EXPENSE' && !isAdjustment && activeSpaces >= 1;
}

export interface MovementSelectionInput {
  type: MovementType;
  isAdjustment: boolean;
  expenseCategoryId?: string;
  incomeSourceId?: string;
}

/**
 * The repository rejects a movement without these links; checking before the write lets the form
 * explain what is missing next to the field instead of failing at save time.
 */
export function validateMovementSelection(input: MovementSelectionInput): void {
  if (input.isAdjustment) return;
  if (input.type === 'EXPENSE' && !input.expenseCategoryId) {
    throw new DomainError('Seleccioná una categoría de gasto.');
  }
  if (input.type === 'INCOME' && !input.incomeSourceId) {
    throw new DomainError('Seleccioná una fuente de ingreso.');
  }
}
