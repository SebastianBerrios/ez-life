import { describe, it, expect } from 'vitest';
import { calculateSharedBalance } from './calculateSharedBalance';
import type { SharedMovement } from '../domain/models/types';

describe('calculateSharedBalance', () => {
  const base = {
    shared_space_id: 'space-1',
    type: 'expense' as const,
    split_mode: 'percentage' as const,
    linked_movement_ids: [],
    date: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  it('calculates that the non-payer owes their share to whoever paid (FR-010)', () => {
    const movements: SharedMovement[] = [
      {
        ...base, id: 'sm-1', created_by: 'ana', total_amount_cents: 10000,
        splits: [{ user_id: 'ana', share_cents: 5000 }, { user_id: 'bob', share_cents: 5000 }],
      },
    ];

    const result = calculateSharedBalance(movements);

    expect(result).toEqual([{ fromUserId: 'bob', toUserId: 'ana', amount: 5000 }]);
  });

  it('nets multiple movements between the same pair into one balance', () => {
    const movements: SharedMovement[] = [
      {
        ...base, id: 'sm-1', created_by: 'ana', total_amount_cents: 10000,
        splits: [{ user_id: 'ana', share_cents: 5000 }, { user_id: 'bob', share_cents: 5000 }],
      },
      {
        ...base, id: 'sm-2', created_by: 'bob', total_amount_cents: 6000,
        splits: [{ user_id: 'ana', share_cents: 3000 }, { user_id: 'bob', share_cents: 3000 }],
      },
    ];

    // bob owes ana 5000 from sm-1; ana owes bob 3000 from sm-2 -> net: bob owes ana 2000
    const result = calculateSharedBalance(movements);

    expect(result).toEqual([{ fromUserId: 'bob', toUserId: 'ana', amount: 2000 }]);
  });

  it('returns no balance when contributions net out exactly to zero', () => {
    const movements: SharedMovement[] = [
      {
        ...base, id: 'sm-1', created_by: 'ana', total_amount_cents: 10000,
        splits: [{ user_id: 'ana', share_cents: 5000 }, { user_id: 'bob', share_cents: 5000 }],
      },
      {
        ...base, id: 'sm-2', created_by: 'bob', total_amount_cents: 10000,
        splits: [{ user_id: 'ana', share_cents: 5000 }, { user_id: 'bob', share_cents: 5000 }],
      },
    ];

    expect(calculateSharedBalance(movements)).toEqual([]);
  });

  it('keeps balances independent across a 3-member space', () => {
    const movements: SharedMovement[] = [
      {
        ...base, id: 'sm-1', created_by: 'ana', total_amount_cents: 9000,
        splits: [{ user_id: 'ana', share_cents: 3000 }, { user_id: 'bob', share_cents: 3000 }, { user_id: 'cass', share_cents: 3000 }],
      },
    ];

    const result = calculateSharedBalance(movements);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      { fromUserId: 'bob', toUserId: 'ana', amount: 3000 },
      { fromUserId: 'cass', toUserId: 'ana', amount: 3000 },
    ]));
  });

  it('recalculates correctly once a movement is removed from the input (edge case: deleted shared movement)', () => {
    const movements: SharedMovement[] = [
      {
        ...base, id: 'sm-1', created_by: 'ana', total_amount_cents: 10000,
        splits: [{ user_id: 'ana', share_cents: 5000 }, { user_id: 'bob', share_cents: 5000 }],
      },
    ];

    expect(calculateSharedBalance(movements)).toHaveLength(1);
    expect(calculateSharedBalance([])).toEqual([]);
  });

  it('returns no balance for an empty list of movements', () => {
    expect(calculateSharedBalance([])).toEqual([]);
  });
});
