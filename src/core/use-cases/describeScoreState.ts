export type ScoreState = 'excelente' | 'en_ritmo' | 'atencion';

export const SCORE_STATE_LABEL: Record<ScoreState, string> = {
  excelente: 'Excelente',
  en_ritmo: 'En ritmo',
  atencion: 'Atención',
};

/**
 * Neutral label DERIVED from a real percentage (daily score or weekly performance):
 * >= 80 "excelente", >= 50 "en_ritmo", below 50 "atencion". `null` when there is no data
 * (nothing scheduled), never a label made up for an empty day.
 */
export function describeScoreState(pct: number | null): ScoreState | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  if (pct >= 80) return 'excelente';
  if (pct >= 50) return 'en_ritmo';
  return 'atencion';
}
