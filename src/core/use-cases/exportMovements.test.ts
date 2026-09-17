import { describe, it, expect } from 'vitest';
import {
  buildMovementsCsv,
  buildMovementsPdfTable,
  escapeCsvField,
  formatAmountLatam,
  formatDateLatam,
} from './exportMovements';
import { Movement } from '../domain/models/types';

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'mov-1',
    user_id: 'user-1',
    type: 'EXPENSE',
    amount: 150050, // S/ 1.500,50
    date: new Date(2026, 0, 5), // Jan 5, 2026 (local time, month is 0-indexed)
    description: 'Cena familiar',
    is_recurring: false,
    created_at: new Date(2026, 0, 5),
    updated_at: new Date(2026, 0, 5),
    ...overrides,
  };
}

describe('escapeCsvField', () => {
  it('wraps and doubles quotes for a field containing the column separator', () => {
    expect(escapeCsvField('Café; medialunas')).toBe('"Café; medialunas"');
  });

  it('doubles internal double quotes and wraps the field', () => {
    expect(escapeCsvField('Compra "urgente"')).toBe('"Compra ""urgente"""');
  });

  it('leaves a plain field untouched', () => {
    expect(escapeCsvField('Cena familiar')).toBe('Cena familiar');
  });
});

describe('formatAmountLatam', () => {
  it('formats integer cents with a comma decimal separator and currency prefix', () => {
    expect(formatAmountLatam(150050)).toBe('S/ 1500,50');
  });

  it('formats zero cents', () => {
    expect(formatAmountLatam(0)).toBe('S/ 0,00');
  });
});

describe('formatDateLatam', () => {
  it('formats a Date as fixed DD/MM/YYYY regardless of locale', () => {
    expect(formatDateLatam(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('accepts a date string', () => {
    expect(formatDateLatam('2026-03-21T00:00:00')).toBe('21/03/2026');
  });
});

describe('buildMovementsCsv', () => {
  it('includes the header row even for an empty movement list', () => {
    expect(buildMovementsCsv([])).toBe('Fecha;Tipo;Monto;Descripcion');
  });

  it('builds a row with comma decimal amount and DD/MM/YYYY date', () => {
    const csv = buildMovementsCsv([makeMovement()]);
    const [, row] = csv.split('\n');
    expect(row).toBe('05/01/2026;Egreso;S/ 1500,50;Cena familiar');
  });

  it('escapes a description containing the CSV column separator', () => {
    const csv = buildMovementsCsv([makeMovement({ description: 'Café; medialunas' })]);
    const [, row] = csv.split('\n');
    expect(row).toBe('05/01/2026;Egreso;S/ 1500,50;"Café; medialunas"');
  });

  it('escapes a description containing double quotes', () => {
    const csv = buildMovementsCsv([makeMovement({ description: 'Compra "urgente"' })]);
    const [, row] = csv.split('\n');
    expect(row).toBe('05/01/2026;Egreso;S/ 1500,50;"Compra ""urgente"""');
  });

  it('renders income movements with the Spanish label', () => {
    const csv = buildMovementsCsv([makeMovement({ type: 'INCOME' })]);
    const [, row] = csv.split('\n');
    expect(row).toContain('Ingreso');
  });
});

describe('buildMovementsPdfTable', () => {
  it('returns headers and formatted rows with comma decimal and fixed date', () => {
    const table = buildMovementsPdfTable([makeMovement()]);
    expect(table.head).toEqual([['Fecha', 'Tipo', 'Monto', 'Descripción']]);
    expect(table.body).toEqual([['05/01/2026', 'Egreso', 'S/ 1500,50', 'Cena familiar']]);
  });

  it('falls back to a dash for a movement without a description', () => {
    const table = buildMovementsPdfTable([makeMovement({ description: undefined })]);
    expect(table.body[0][3]).toBe('-');
  });

  it('returns an empty body for an empty movement list', () => {
    const table = buildMovementsPdfTable([]);
    expect(table.body).toEqual([]);
  });
});
