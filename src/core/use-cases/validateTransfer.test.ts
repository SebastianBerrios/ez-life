import { describe, it, expect } from 'vitest';
import { validateTransfer } from './validateTransfer';

const transfer = { type: 'TRANSFER' as const, account_id: 'a', to_account_id: 'b', is_recurring: false };

describe('validateTransfer', () => {
  it('accepts a clean transfer between two different accounts', () => {
    expect(() => validateTransfer(transfer)).not.toThrow();
  });

  it('requires both accounts and rejects the same account twice', () => {
    expect(() => validateTransfer({ ...transfer, account_id: undefined })).toThrow(/origen/i);
    expect(() => validateTransfer({ ...transfer, to_account_id: undefined })).toThrow(/destino/i);
    expect(() => validateTransfer({ ...transfer, to_account_id: 'a' })).toThrow(/distintas/i);
  });

  it.each([
    ['distribution_category_id'], ['expense_category_id'], ['expense_subcategory_id'],
    ['income_source_id'], ['savings_goal_id'],
  ])('forbids %s on a transfer', (field) => {
    expect(() => validateTransfer({ ...transfer, [field]: 'x' })).toThrow(/transferencia/i);
  });

  it('forbids adjustments and recurrence on a transfer', () => {
    expect(() => validateTransfer({ ...transfer, is_adjustment: true })).toThrow(/transferencia/i);
    expect(() => validateTransfer({ ...transfer, is_recurring: true })).toThrow(/transferencia/i);
  });

  it('forbids a destination account on non-transfer movements', () => {
    expect(() => validateTransfer({ type: 'EXPENSE', account_id: 'a', to_account_id: 'b', is_recurring: false })).toThrow(/destino/i);
    expect(() => validateTransfer({ type: 'INCOME', account_id: 'a', is_recurring: false })).not.toThrow();
  });
});
