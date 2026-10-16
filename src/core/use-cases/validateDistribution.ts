import { DistributionCategory } from '../domain/models/types';
import { DomainError } from '../domain/errors/DomainError';
export function validateDistribution(rows: Pick<DistributionCategory, 'id' | 'name' | 'percentage' | 'is_savings'>[]): void {
  if (!rows.length || new Set(rows.map(row => row.id)).size !== rows.length) throw new DomainError('La distribución requiere categorías únicas.');
  if (rows.some(row => !row.name.trim() || !Number.isInteger(row.percentage) || row.percentage < 1 || row.percentage > 100)) throw new DomainError('Completá los nombres y porcentajes enteros entre 1 y 100.');
  if (rows.reduce((sum, row) => sum + row.percentage, 0) !== 100) throw new DomainError('La distribución debe sumar exactamente 100%.');
  if (rows.filter(row => row.is_savings).length !== 1) throw new DomainError('Debe existir exactamente una categoría de ahorro.');
}
