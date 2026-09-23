import { DomainError } from '../domain/errors/DomainError';

export interface BalanceAdjustmentInput {
  is_adjustment?: boolean;
  description?: string;
  distribution_category_id?: string;
  expense_category_id?: string;
  expense_subcategory_id?: string;
}

/**
 * Validates the business rules for a manual balance adjustment
 * (data-model.md, spec 006-ajuste-de-balance-mensual):
 * - a non-empty `description` is mandatory when `is_adjustment` is true (FR-002).
 * - an adjustment never carries a distribution/expense category (FR-004) —
 *   this guarantees it stays excluded from the 50/30/20 breakdown
 *   (research.md §1) without touching that calculation.
 * A movement with `is_adjustment` false/undefined is left untouched.
 */
export function validateBalanceAdjustment(input: BalanceAdjustmentInput): void {
  if (!input.is_adjustment) return;

  if (!input.description || input.description.trim().length === 0) {
    throw new DomainError('Un ajuste de balance requiere un motivo.');
  }

  if (input.distribution_category_id || input.expense_category_id || input.expense_subcategory_id) {
    throw new DomainError('Un ajuste de balance no puede tener categoría asignada.');
  }
}
