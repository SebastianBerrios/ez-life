import { DomainError } from '../domain/errors/DomainError';

export function validateDeletion(
  count: number,
  message = 'Cannot delete entity with existing movements. Please reassign them first.'
): void {
  if (count > 0) {
    throw new DomainError(message);
  }
}
