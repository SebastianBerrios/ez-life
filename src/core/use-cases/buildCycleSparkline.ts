import type { Movement } from '../domain/models/types';
import { calendarKey } from './calendar';

export interface SparklinePoint {
  date: Date;
  /** Cumulative net (income - expense) in cents from the cycle start up to the end of that day. */
  value: number;
}

export interface CycleSparkline {
  points: SparklinePoint[];
  /** Days that had at least one income/expense movement; a line needs >= 2 to mean anything. */
  daysWithData: number;
}

/**
 * Running net per calendar day between `cycleStart` and `cycleEnd` (both inclusive, local days).
 * TRANSFERs and soft-deleted rows are excluded; balance adjustments count (same as the cycle balance).
 * Pass `min(cycleEnd, today)` to avoid a flat tail over future days.
 */
export function buildCycleSparkline(movements: Movement[], cycleStart: Date, cycleEnd: Date): CycleSparkline {
  const netByDay = new Map<string, number>();
  for (const m of movements) {
    if (m.deleted_at || m.type === 'TRANSFER') continue;
    const key = calendarKey(m.date);
    netByDay.set(key, (netByDay.get(key) ?? 0) + (m.type === 'INCOME' ? m.amount : -m.amount));
  }

  const points: SparklinePoint[] = [];
  let running = 0;
  let daysWithData = 0;
  const first = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate());
  const lastKey = calendarKey(cycleEnd);
  for (
    let cursor = first;
    calendarKey(cursor) <= lastKey;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  ) {
    const net = netByDay.get(calendarKey(cursor));
    if (net !== undefined) {
      running += net;
      daysWithData += 1;
    }
    points.push({ date: cursor, value: running });
  }
  return { points, daysWithData };
}
