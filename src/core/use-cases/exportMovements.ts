import { Movement } from '../domain/models/types';

const CSV_COLUMN_SEPARATOR = ';';
const CSV_HEADERS = ['Fecha', 'Tipo', 'Monto', 'Descripcion'];
const PDF_HEADERS = ['Fecha', 'Tipo', 'Monto', 'Descripción'];

/**
 * Human-readable label for a movement type, in Spanish (UI copy convention).
 */
export function movementTypeLabel(type: Movement['type']): string {
  return type === 'INCOME' ? 'Ingreso' : 'Egreso';
}

/**
 * Fixed `DD/MM/YYYY` date format — deliberately not `toLocaleDateString()`,
 * which depends on the browser/OS locale and is non-deterministic across
 * devices. RF-17 requires the Latin-American format regardless of locale.
 */
export function formatDateLatam(date: Date | string): string {
  const parsed = date instanceof Date ? date : new Date(date);
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Amount in integer cents formatted as `S/ 1500,50` — comma decimal
 * separator per RF-17, used identically in both CSV and PDF exports.
 */
export function formatAmountLatam(amountInCents: number): string {
  return `S/ ${(amountInCents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Escapes a single field for a `;`-separated CSV per RFC 4180, adapted to
 * `;` as the column separator: a field containing the separator, a double
 * quote, or a line break gets wrapped in double quotes, with internal double
 * quotes doubled.
 */
export function escapeCsvField(field: string): string {
  if (/[;"\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(CSV_COLUMN_SEPARATOR);
}

/**
 * Builds the full CSV content (headers + rows) for a movements export.
 * Always includes the header row, even for an empty movement list.
 */
export function buildMovementsCsv(movements: Movement[]): string {
  const rows = movements.map((m) =>
    toCsvRow([
      formatDateLatam(m.date),
      movementTypeLabel(m.type),
      formatAmountLatam(m.amount),
      m.description ?? '',
    ])
  );

  return [toCsvRow(CSV_HEADERS), ...rows].join('\n');
}

/**
 * Builds the header row + body rows ready to hand to `jspdf-autotable`.
 */
export function buildMovementsPdfTable(movements: Movement[]): {
  head: string[][];
  body: string[][];
} {
  const body = movements.map((m) => [
    formatDateLatam(m.date),
    movementTypeLabel(m.type),
    formatAmountLatam(m.amount),
    m.description || '-',
  ]);

  return { head: [PDF_HEADERS], body };
}
