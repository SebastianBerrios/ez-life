import { describe, it, expect } from 'vitest';
import { validateBalanceAdjustment } from './validateBalanceAdjustment';
import { DomainError } from '../domain/errors/DomainError';

describe('validateBalanceAdjustment', () => {
  it('does not throw when is_adjustment is false, regardless of other fields', () => {
    expect(() =>
      validateBalanceAdjustment({ is_adjustment: false, distribution_category_id: 'cat-1' })
    ).not.toThrow();
  });

  it('does not throw when is_adjustment is undefined', () => {
    expect(() => validateBalanceAdjustment({})).not.toThrow();
  });

  it('throws a DomainError when is_adjustment is true and description is missing', () => {
    expect(() => validateBalanceAdjustment({ is_adjustment: true })).toThrowError(DomainError);
  });

  it('throws a DomainError when is_adjustment is true and description is blank', () => {
    expect(() =>
      validateBalanceAdjustment({ is_adjustment: true, description: '   ' })
    ).toThrowError(DomainError);
  });

  it('throws a DomainError when is_adjustment is true and carries a distribution_category_id', () => {
    expect(() =>
      validateBalanceAdjustment({
        is_adjustment: true,
        description: 'Ajuste',
        distribution_category_id: 'cat-1',
      })
    ).toThrowError(DomainError);
  });

  it('throws a DomainError when is_adjustment is true and carries an expense_category_id', () => {
    expect(() =>
      validateBalanceAdjustment({
        is_adjustment: true,
        description: 'Ajuste',
        expense_category_id: 'ec-1',
      })
    ).toThrowError(DomainError);
  });

  it('throws a DomainError when is_adjustment is true and carries an expense_subcategory_id', () => {
    expect(() =>
      validateBalanceAdjustment({
        is_adjustment: true,
        description: 'Ajuste',
        expense_subcategory_id: 'sub-1',
      })
    ).toThrowError(DomainError);
  });

  it('does not throw when is_adjustment is true with a description and no category fields', () => {
    expect(() =>
      validateBalanceAdjustment({ is_adjustment: true, description: 'Bono inesperado' })
    ).not.toThrow();
  });
});
