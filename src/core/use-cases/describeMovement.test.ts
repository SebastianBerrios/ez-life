import { describe, expect, it } from 'vitest';
import type { Movement } from '../domain/models/types';
import {
  describeMovement, isMovementEditable, isSharedMovement, movementCategoryId, movementSearchHaystacks,
  type MovementLookups,
} from './describeMovement';

const base: Movement = {
  id: 'm1', user_id: 'u', type: 'EXPENSE', amount: 1250, date: new Date(2026, 9, 16, 14, 30),
  is_recurring: false, created_at: new Date(), updated_at: new Date(),
};

const lookups: MovementLookups = {
  categoryName: { c1: 'Alimentación' },
  subcategoryName: { s1: 'Restaurantes' },
  incomeSourceName: { i1: 'Sueldo' },
  bucket: { b1: { name: 'Necesidades', percentage: 50 } },
  accountName: { a1: 'BCP Débito', a2: 'Efectivo' },
};

describe('describeMovement', () => {
  it('resolves an expense with category, subcategory, bucket and account', () => {
    const d = describeMovement({
      ...base, description: ' Almuerzo ', expense_category_id: 'c1', expense_subcategory_id: 's1',
      distribution_category_id: 'b1', account_id: 'a1',
    }, lookups);
    expect(d).toMatchObject({
      kind: 'expense', title: 'Almuerzo', hasDescription: true, category: 'Alimentación', subcategory: 'Restaurantes',
      bucketLabel: '50% Necesidades', accountName: 'BCP Débito', toAccountName: null, shared: false, adjustment: false, editable: true,
    });
  });

  it('falls back to the category as title and "Sin categoría" when nothing resolves', () => {
    expect(describeMovement({ ...base, expense_category_id: 'c1' }, lookups).title).toBe('Alimentación');
    const bare = describeMovement(base, lookups);
    expect(bare.category).toBe('Sin categoría');
    expect(bare.title).toBe('Sin categoría');
    expect(bare.hasDescription).toBe(false);
    expect(bare.bucketLabel).toBeNull();
  });

  it('uses the income source as category and never a bucket', () => {
    const d = describeMovement({ ...base, type: 'INCOME', income_source_id: 'i1', distribution_category_id: 'b1' }, lookups);
    expect(d).toMatchObject({ kind: 'income', title: 'Sueldo', category: 'Sueldo', bucketLabel: null });
    expect(describeMovement({ ...base, type: 'INCOME' }, lookups).title).toBe('Sin descripción');
  });

  it('describes a transfer with origin and destination and no category', () => {
    const d = describeMovement({ ...base, type: 'TRANSFER', account_id: 'a1', to_account_id: 'a2' }, lookups);
    expect(d).toMatchObject({ kind: 'transfer', title: 'Transferencia', category: null, accountName: 'BCP Débito', toAccountName: 'Efectivo', bucketLabel: null });
  });

  it('flags adjustments and shared/linked/installment movements as managed elsewhere', () => {
    expect(describeMovement({ ...base, is_adjustment: true }).adjustment).toBe(true);
    for (const patch of [{ is_linked: true }, { shared_movement_id: 's' }, { installment_payment_id: 'p' }]) {
      expect(isMovementEditable({ ...base, ...patch })).toBe(false);
    }
    expect(isSharedMovement({ ...base, is_linked: true })).toBe(true);
    expect(isSharedMovement({ ...base, shared_movement_id: 'x' })).toBe(true);
    expect(isSharedMovement({ ...base, installment_payment_id: 'p' })).toBe(false);
  });
});

describe('movementCategoryId', () => {
  it('returns the expense category, the income source, or nothing for transfers', () => {
    expect(movementCategoryId({ ...base, expense_category_id: 'c1' })).toBe('c1');
    expect(movementCategoryId({ ...base, type: 'INCOME', income_source_id: 'i1', expense_category_id: 'c1' })).toBe('i1');
    expect(movementCategoryId({ ...base, type: 'TRANSFER', expense_category_id: 'c1' })).toBeUndefined();
  });
});

describe('movementSearchHaystacks', () => {
  it('covers description, category, account, bucket and the amount in both forms', () => {
    const texts = movementSearchHaystacks({
      ...base, description: 'Almuerzo', expense_category_id: 'c1', distribution_category_id: 'b1', account_id: 'a1',
    }, lookups);
    expect(texts).toEqual(expect.arrayContaining(['Almuerzo', 'Alimentación', 'BCP Débito', '50% Necesidades', 'S/ 12.50', '12.50', 'Egreso']));
  });
});
