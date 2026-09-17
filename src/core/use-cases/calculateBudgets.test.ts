import { describe, it, expect } from 'vitest';
import { calculateBudgets } from './calculateBudgets';
import type { DistributionCategory } from '../domain/models/types';

describe('calculateBudgets', () => {
  it('should distribute total income exactly and allocate the remainder to the highest percentage', () => {
    // 10001 cents total income
    const totalIncomeCents = 10001;
    const baseCategory = {
      user_id: 'user-1',
      is_default: true,
      is_savings: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const categories: DistributionCategory[] = [
      { ...baseCategory, id: '1', name: 'Necesidades', percentage: 50 },
      { ...baseCategory, id: '2', name: 'Gustos', percentage: 30 },
      { ...baseCategory, id: '3', name: 'Ahorro', percentage: 20 },
    ];

    const result = calculateBudgets(totalIncomeCents, categories);

    // 5000.5 -> 5000
    // 3000.3 -> 3000
    // 2000.2 -> 2000
    // Remainder: 10001 - 10000 = 1
    // Highest is 50%, so it gets the 1 cent.
    
    expect(result.find(c => c.id === '1')?.budget).toBe(5001);
    expect(result.find(c => c.id === '2')?.budget).toBe(3000);
    expect(result.find(c => c.id === '3')?.budget).toBe(2000);
    
    // Total should equal original total
    const totalBudget = result.reduce((acc, curr) => acc + curr.budget, 0);
    expect(totalBudget).toBe(10001);
  });
});
