import { DomainError } from '../domain/errors/DomainError';

export function validateDeletion(movementsCount: number): void {
  if (movementsCount > 0) {
    throw new DomainError('Cannot delete entity with existing movements. Please reassign them first.');
  }
}
