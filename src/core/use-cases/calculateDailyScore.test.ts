import { describe, expect, it } from 'vitest';
import { calculateDailyScore } from './calculateDailyScore';

describe('calculateDailyScore', () => {
  it('has no data when nothing is scheduled', () => {
    expect(calculateDailyScore([])).toEqual({ done: 0, scheduled: 0, pct: null, hasData: false });
  });
  it('computes done / scheduled as an integer percent', () => {
    expect(calculateDailyScore([{ done: true }, { done: true }, { done: true }, { done: false }])).toEqual({ done: 3, scheduled: 4, pct: 75, hasData: true });
    expect(calculateDailyScore([{ done: true }, { done: false }, { done: false }])).toMatchObject({ pct: 33 });
    expect(calculateDailyScore([{ done: true }, { done: true }, { done: false }])).toMatchObject({ pct: 67 });
  });
  it('is 0 when scheduled but none done, and 100 when all done', () => {
    expect(calculateDailyScore([{ done: false }])).toMatchObject({ pct: 0, hasData: true });
    expect(calculateDailyScore([{ done: true }])).toMatchObject({ pct: 100 });
  });
});
