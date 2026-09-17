import { describe, it, expect } from 'vitest';
import { validateDeletion } from './validateDeletion';
import { DomainError } from '../domain/errors/DomainError';

describe('validateDeletion', () => {
  it('should throw a DomainError if count is greater than 0', () => {
    expect(() => validateDeletion(1)).toThrowError(DomainError);
    expect(() => validateDeletion(10)).toThrowError('Cannot delete entity with existing movements');
  });

  it('should not throw if count is 0', () => {
    expect(() => validateDeletion(0)).not.toThrow();
  });

  it('should use a custom message when provided', () => {
    expect(() => validateDeletion(1, 'Custom message')).toThrowError('Custom message');
  });
});
