import { describe, it, expect } from 'vitest';
import {
  buildMovementsCsv,
  movementTypeLabel,
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
    date: new Date(2026, 0, 5, 14, 30), // Jan 5, 2026 14:30 (local time, month is 0-indexed)
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
    expect(buildMovementsCsv([])).toBe('Fecha;Hora;Tipo;Cuenta;Categoria;Monto;Descripcion');
  });

  it('builds a row with comma decimal amount and DD/MM/YYYY date', () => {
    const csv = buildMovementsCsv([makeMovement()]);
    const [, row] = csv.split('\n');
    expect(row).toBe('05/01/2026;14:30;Egreso;;;S/ 1500,50;Cena familiar');
  });

  it('escapes a description containing the CSV column separator', () => {
    const csv = buildMovementsCsv([makeMovement({ description: 'Café; medialunas' })]);
    const [, row] = csv.split('\n');
    expect(row).toBe('05/01/2026;14:30;Egreso;;;S/ 1500,50;"Café; medialunas"');
  });

  it('escapes a description containing double quotes', () => {
    const csv = buildMovementsCsv([makeMovement({ description: 'Compra "urgente"' })]);
    const [, row] = csv.split('\n');
    expect(row).toBe('05/01/2026;14:30;Egreso;;;S/ 1500,50;"Compra ""urgente"""');
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
    expect(table.head).toEqual([['Fecha', 'Hora', 'Tipo', 'Cuenta', 'Categoría', 'Monto', 'Descripción']]);
    expect(table.body).toEqual([['05/01/2026', '14:30', 'Egreso', '-', '-', 'S/ 1500,50', 'Cena familiar']]);
  });

  it('falls back to a dash for a movement without a description', () => {
    const table = buildMovementsPdfTable([makeMovement({ description: undefined })]);
    expect(table.body[0][6]).toBe('-');
  });

  it('returns an empty body for an empty movement list', () => {
    const table = buildMovementsPdfTable([]);
    expect(table.body).toEqual([]);
  });
});

describe('movementTypeLabel', () => {
  it('labels every movement type in Spanish', () => {
    expect(movementTypeLabel('INCOME')).toBe('Ingreso');
    expect(movementTypeLabel('EXPENSE')).toBe('Egreso');
    expect(movementTypeLabel('TRANSFER')).toBe('Transferencia');
  });
});

describe('export with account and category names', () => {
  const lookups = {
    accountNames: { cash: 'Efectivo', bank: 'BCP' },
    categoryNames: { food: 'Alimentación', salary: 'Sueldo' },
  };

  it('writes the time as local HH:mm with zero padding', () => {
    const csv = buildMovementsCsv([makeMovement({ date: new Date(2026, 0, 5, 7, 5) })]);
    expect(csv.split('\n')[1].split(';')[1]).toBe('07:05');
  });

  it('resolves the account and category names for expenses and income', () => {
    const csv = buildMovementsCsv([
      makeMovement({ account_id: 'cash', expense_category_id: 'food' }),
      makeMovement({ type: 'INCOME', account_id: 'bank', income_source_id: 'salary' }),
    ], lookups);
    const [, expense, income] = csv.split('\n');
    expect(expense).toBe('05/01/2026;14:30;Egreso;Efectivo;Alimentación;S/ 1500,50;Cena familiar');
    expect(income).toBe('05/01/2026;14:30;Ingreso;BCP;Sueldo;S/ 1500,50;Cena familiar');
  });

  it('shows a transfer as "Origen -> Destino" with no category', () => {
    const csv = buildMovementsCsv([makeMovement({ type: 'TRANSFER', account_id: 'cash', to_account_id: 'bank' })], lookups);
    expect(csv.split('\n')[1]).toBe('05/01/2026;14:30;Transferencia;Efectivo -> BCP;;S/ 1500,50;Cena familiar');
  });

  it('escapes account names that contain the separator and falls back to empty for unknown ids', () => {
    const csv = buildMovementsCsv([
      makeMovement({ account_id: 'odd' }),
      makeMovement({ account_id: 'ghost' }),
    ], { accountNames: { odd: 'Caja; chica' } });
    const [, odd, ghost] = csv.split('\n');
    expect(odd).toContain(';"Caja; chica";');
    expect(ghost).toBe('05/01/2026;14:30;Egreso;;;S/ 1500,50;Cena familiar');
  });

  it('passes the same columns to the PDF table', () => {
    const table = buildMovementsPdfTable([makeMovement({ account_id: 'cash', expense_category_id: 'food' })], lookups);
    expect(table.body[0]).toEqual(['05/01/2026', '14:30', 'Egreso', 'Efectivo', 'Alimentación', 'S/ 1500,50', 'Cena familiar']);
  });
});
