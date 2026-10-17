import { describe, it, expect } from 'vitest';
import { bucketLabel, canShareExpense, isLongCategoryList, validateMovementSelection } from './quickRecordRules';
import { DomainError } from '../domain/errors/DomainError';

describe('canShareExpense', () => {
  const base = { editing: false, type: 'EXPENSE' as const, isAdjustment: false, activeSpaces: 1 };
  it('is offered for a new expense when the user has a shared space', () => {
    expect(canShareExpense(base)).toBe(true);
    expect(canShareExpense({ ...base, activeSpaces: 3 })).toBe(true);
  });
  it('is hidden without spaces, for income/transfer, for adjustments and when editing', () => {
    expect(canShareExpense({ ...base, activeSpaces: 0 })).toBe(false);
    expect(canShareExpense({ ...base, type: 'INCOME' })).toBe(false);
    expect(canShareExpense({ ...base, type: 'TRANSFER' })).toBe(false);
    expect(canShareExpense({ ...base, isAdjustment: true })).toBe(false);
    expect(canShareExpense({ ...base, editing: true })).toBe(false);
  });
});

describe('bucketLabel', () => {
  it('shows the bucket name with its percentage', () => {
    expect(bucketLabel({ name: 'Necesidades Básicas', percentage: 50 })).toBe('Necesidades Básicas (50%)');
  });
  it('has a fallback when the bucket is unknown', () => {
    expect(bucketLabel(undefined)).toBe('Sin distribución');
  });
});

describe('isLongCategoryList', () => {
  it('switches to a scroll area above 8 categories', () => {
    expect(isLongCategoryList(8)).toBe(false);
    expect(isLongCategoryList(9)).toBe(true);
  });
});

describe('validateMovementSelection', () => {
  it('requires a category for an expense', () => {
    expect(() => validateMovementSelection({ type: 'EXPENSE', isAdjustment: false })).toThrow(DomainError);
    expect(() => validateMovementSelection({ type: 'EXPENSE', isAdjustment: false, expenseCategoryId: 'c' })).not.toThrow();
  });
  it('requires an income source for an income', () => {
    expect(() => validateMovementSelection({ type: 'INCOME', isAdjustment: false })).toThrow('fuente de ingreso');
    expect(() => validateMovementSelection({ type: 'INCOME', isAdjustment: false, incomeSourceId: 's' })).not.toThrow();
  });
  it('asks for nothing on an adjustment', () => {
    expect(() => validateMovementSelection({ type: 'EXPENSE', isAdjustment: true })).not.toThrow();
    expect(() => validateMovementSelection({ type: 'INCOME', isAdjustment: true })).not.toThrow();
  });
});
