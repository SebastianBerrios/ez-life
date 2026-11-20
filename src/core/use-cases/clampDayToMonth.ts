/**
 * Clamps a day of month (1..31) into the valid day range of the given
 * `year` and 0-based `monthIndex` (0 = January .. 11 = December).
 */
export function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  if (day < 1) return 1;
  return day > lastDay ? lastDay : day;
}
