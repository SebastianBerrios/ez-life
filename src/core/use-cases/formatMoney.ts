export interface FormatMoneyOptions {
  /** Prefix the amount with the currency symbol. Defaults to true. */
  symbol?: boolean;
  /**
   * `auto` prints "-" only for negatives, `always` also prints "+" for positives
   * (zero is never signed), `never` prints the absolute value.
   */
  sign?: 'auto' | 'always' | 'never';
}

export interface MoneyParts {
  negative: boolean;
  symbol: string;
  integer: string;
  decimals: string;
}

const CURRENCY_SYMBOL = 'S/';

/**
 * Pure and deterministic on purpose (no `Intl`): ICU data and NBSP variance
 * between Node, jsdom and browsers would make output differ per environment.
 * Money is always integer cents (PEN only); non-integers are rounded half away from zero.
 */
function toRoundedCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.sign(cents) * Math.round(Math.abs(cents));
}

export function formatMoneyParts(cents: number): MoneyParts {
  const rounded = toRoundedCents(cents);
  const abs = Math.abs(rounded);
  const integer = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = (abs % 100).toString().padStart(2, '0');
  return { negative: rounded < 0, symbol: CURRENCY_SYMBOL, integer, decimals };
}

export function formatMoney(cents: number, opts: FormatMoneyOptions = {}): string {
  const { symbol = true, sign = 'auto' } = opts;
  const parts = formatMoneyParts(cents);
  const isZero = parts.integer === '0' && parts.decimals === '00';

  let prefix = '';
  if (sign !== 'never' && !isZero) {
    if (parts.negative) prefix = '-';
    else if (sign === 'always') prefix = '+';
  }

  const amount = `${parts.integer}.${parts.decimals}`;
  return `${prefix}${symbol ? `${parts.symbol} ` : ''}${amount}`;
}
