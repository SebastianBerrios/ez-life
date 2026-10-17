import { parseMoney } from './parseMoney';

/** Integer cents -> "123.45" (no grouping separators, always two decimals). Never uses floats. */
export function centsToAmountInput(cents: number): string {
  const safe = Number.isSafeInteger(cents) && cents > 0 ? cents : 0;
  const whole = Math.floor(safe / 100);
  const fraction = safe % 100;
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}

function toCents(raw: string): number | null {
  let value = raw.trim();
  if (value === '') return null;
  if (value.endsWith('.')) value = value.slice(0, -1);
  if (value.startsWith('.')) value = `0${value}`;
  try {
    return parseMoney(value);
  } catch {
    return null;
  }
}

/** Normalizes a typed amount ("1,500", "7.5") to "1500.00"; null when empty or not a valid amount. */
export function normalizeAmountInput(value: string): string | null {
  const cents = toCents(value);
  return cents === null ? null : centsToAmountInput(cents);
}

/**
 * Quick-amount chips (+S/ 10, +S/ 20, ...): adds `deltaCents` to the amount currently typed.
 * Works on integer cents only; an empty or invalid current value counts as 0, the result never
 * goes below 0, and if the sum would not be a safe integer the current amount is kept.
 */
export function addQuickAmount(current: string, deltaCents: number): string {
  const base = toCents(current) ?? 0;
  const sum = base + deltaCents;
  if (!Number.isSafeInteger(sum)) return centsToAmountInput(base);
  return centsToAmountInput(Math.max(0, sum));
}
