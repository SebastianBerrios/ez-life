import { DomainError } from '../domain/errors/DomainError';
import type { MovementType } from '../domain/models/types';

export interface TransferInput {
  type: MovementType;
  account_id?: string;
  to_account_id?: string;
  distribution_category_id?: string;
  expense_category_id?: string;
  expense_subcategory_id?: string;
  income_source_id?: string;
  savings_goal_id?: string;
  is_adjustment?: boolean;
  is_recurring: boolean;
}

/**
 * Shape rules for payment-account links (spec 011). Ownership of the referenced
 * accounts is checked by the repository, which can see the database.
 * - TRANSFER needs an origin and a different destination, and never carries
 *   category / income source / savings goal / adjustment / recurrence.
 * - Any other type must not carry a destination account.
 */
export function validateTransfer(input: TransferInput): void {
  if (input.type !== 'TRANSFER') {
    if (input.to_account_id) throw new DomainError('Solo una transferencia puede tener cuenta destino.');
    return;
  }
  if (!input.account_id) throw new DomainError('Selecciona la cuenta de origen.');
  if (!input.to_account_id) throw new DomainError('Selecciona la cuenta de destino.');
  if (input.account_id === input.to_account_id) throw new DomainError('Las cuentas de origen y destino deben ser distintas.');
  if (
    input.distribution_category_id || input.expense_category_id || input.expense_subcategory_id ||
    input.income_source_id || input.savings_goal_id || input.is_adjustment || input.is_recurring
  ) {
    throw new DomainError('Una transferencia no admite categoría, fuente de ingreso, meta de ahorro, ajuste ni recurrencia.');
  }
}
