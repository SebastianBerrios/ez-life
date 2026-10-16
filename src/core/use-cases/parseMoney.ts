import { DomainError } from '../domain/errors/DomainError';
export function parseMoney(value: string): number {
  let decimal = value.trim();
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(decimal)) decimal = decimal.replace(/,/g, '');
  else decimal = decimal.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) throw new DomainError('Ingresá un monto con hasta dos decimales.');
  const [whole, fraction = ''] = decimal.split('.');
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new DomainError('El monto es demasiado grande.');
  return Number(cents);
}
