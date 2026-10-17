import type { FocusItem } from './buildFocusToday';

export interface DailyScore {
  done: number;
  scheduled: number;
  /** Integer 0-100; `null` when nothing is scheduled (no data - never shown as 0% or 100%). */
  pct: number | null;
  hasData: boolean;
}

/** "Rendimiento conductual" of a day: share of today's habits and tasks that are done. */
export function calculateDailyScore(items: Pick<FocusItem, 'done'>[]): DailyScore {
  const scheduled = items.length;
  const done = items.filter(item => item.done).length;
  if (scheduled === 0) return { done: 0, scheduled: 0, pct: null, hasData: false };
  return { done, scheduled, pct: Math.round((done * 100) / scheduled), hasData: true };
}
