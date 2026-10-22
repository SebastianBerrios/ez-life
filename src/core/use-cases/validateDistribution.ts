import { DistributionCategory } from '../domain/models/types';
import { DomainError } from '../domain/errors/DomainError';

/** Whole percentage in range: 1..100, except the savings category, which may be 0. */
export function isValidDistributionPercentage(row: Pick<DistributionCategory, 'percentage' | 'is_savings'>): boolean {
  return Number.isInteger(row.percentage) && row.percentage >= (row.is_savings ? 0 : 1) && row.percentage <= 100;
}

export function validateDistribution(rows: Pick<DistributionCategory, 'id' | 'name' | 'percentage' | 'is_savings'>[]): void {
  if (!rows.length || new Set(rows.map(row => row.id)).size !== rows.length) throw new DomainError('La distribución requiere categorías únicas.');
  if (rows.some(row => !row.name.trim() || !isValidDistributionPercentage(row))) throw new DomainError('Completa los nombres y porcentajes enteros (de 1 a 100; el ahorro puede ser 0).');
  if (rows.reduce((sum, row) => sum + row.percentage, 0) !== 100) throw new DomainError('La distribución debe sumar exactamente 100%.');
  if (rows.filter(row => row.is_savings).length !== 1) throw new DomainError('Debe existir exactamente una categoría de ahorro.');
}
