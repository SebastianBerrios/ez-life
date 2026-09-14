import { describe, it, expect } from 'vitest';
import { evaluateRecurrence } from './evaluateRecurrence';
import { Movement } from '../domain/models/types';

describe('evaluateRecurrence', () => {
  const currentDate = new Date(2023, 9, 15); // Oct 15, 2023

  it('should not update if lastEvalMonth matches current month', () => {
    const result = evaluateRecurrence('2023-10', currentDate, []);
    expect(result.shouldUpdate).toBe(false);
    expect(result.newEvalMonth).toBe('2023-10');
    expect(result.clonedMovements).toHaveLength(0);
  });

  it('should update but not clone if lastEvalMonth is undefined (first run)', () => {
    const result = evaluateRecurrence(undefined, currentDate, []);
    expect(result.shouldUpdate).toBe(true);
    expect(result.newEvalMonth).toBe('2023-10');
    expect(result.clonedMovements).toHaveLength(0);
  });

  it('should clone recurring movements from the last evaluated month', () => {
    const allMovements: Movement[] = [
      {
        id: '1', user_id: 'user1', type: 'EXPENSE', amount: 1000, 
        date: new Date(2023, 8, 10), // Sept 10, 2023
        is_recurring: true, created_at: new Date(), updated_at: new Date()
      },
      {
        id: '2', user_id: 'user1', type: 'EXPENSE', amount: 500, 
        date: new Date(2023, 8, 11), // Sept 11, 2023
        is_recurring: false, created_at: new Date(), updated_at: new Date()
      },
      {
        id: '3', user_id: 'user1', type: 'EXPENSE', amount: 2000, 
        date: new Date(2023, 7, 10), // Aug 10, 2023
        is_recurring: true, created_at: new Date(), updated_at: new Date()
      }
    ];

    const result = evaluateRecurrence('2023-09', currentDate, allMovements);
    
    expect(result.shouldUpdate).toBe(true);
    expect(result.newEvalMonth).toBe('2023-10');
    expect(result.clonedMovements).toHaveLength(1);
    expect(result.clonedMovements[0].amount).toBe(1000);
    expect(result.clonedMovements[0].date).toBe(currentDate);
  });
});
