import { describe, it, expect } from 'vitest';
import { calculateMonthlyCycle } from './calculateMonthlyCycle';

describe('calculateMonthlyCycle', () => {
  it('should return 1st to last day of the current month', () => {
    const current = new Date(2023, 4, 15); // May 15, 2023
    const [start, end] = calculateMonthlyCycle(current);
    
    expect(start.toISOString()).toBe(new Date(2023, 4, 1, 0, 0, 0, 0).toISOString());
    expect(end.toISOString()).toBe(new Date(2023, 4, 31, 23, 59, 59, 999).toISOString());
  });

  it('should handle leap years for February', () => {
    const current = new Date(2024, 1, 15); // Feb 15, 2024
    const [start, end] = calculateMonthlyCycle(current);
    
    expect(start.toISOString()).toBe(new Date(2024, 1, 1, 0, 0, 0, 0).toISOString());
    expect(end.toISOString()).toBe(new Date(2024, 1, 29, 23, 59, 59, 999).toISOString());
  });
});
