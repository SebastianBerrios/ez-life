import { describe, it, expect } from 'vitest';
import { validateMovementAmount } from './validateMovementAmount';
import { DomainError } from '../domain/errors/DomainError';

describe('validateMovementAmount', () => {
  it('does not throw for a valid positive integer amount', () => {
    expect(() => validateMovementAmount(1500)).not.toThrow();
  });

  it('throws a DomainError for zero', () => {
    expect(() => validateMovementAmount(0)).toThrowError(DomainError);
  });

  it('throws a DomainError for negative amounts', () => {
    expect(() => validateMovementAmount(-100)).toThrowError(DomainError);
  });

  it('throws a DomainError for NaN', () => {
    expect(() => validateMovementAmount(NaN)).toThrowError(DomainError);
  });

  it('throws a DomainError for a non-integer amount', () => {
    expect(() => validateMovementAmount(150.5)).toThrowError(DomainError);
  });
});
