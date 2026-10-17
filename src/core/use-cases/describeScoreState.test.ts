import { describe, expect, it } from 'vitest';
import { describeScoreState } from './describeScoreState';

describe('describeScoreState', () => {
  it('uses the documented thresholds (>= 80, >= 50, below)', () => {
    expect(describeScoreState(100)).toBe('excelente');
    expect(describeScoreState(80)).toBe('excelente');
    expect(describeScoreState(79)).toBe('en_ritmo');
    expect(describeScoreState(50)).toBe('en_ritmo');
    expect(describeScoreState(49)).toBe('atencion');
    expect(describeScoreState(0)).toBe('atencion');
  });
  it('is null when there is no data', () => {
    expect(describeScoreState(null)).toBeNull();
    expect(describeScoreState(Number.NaN)).toBeNull();
  });
});
