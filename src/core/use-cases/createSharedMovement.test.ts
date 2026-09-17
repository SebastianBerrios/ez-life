import { describe, it, expect } from 'vitest';
import { createSharedMovement } from './createSharedMovement';
import { DomainError } from '../domain/errors/DomainError';

describe('createSharedMovement', () => {
  it('splits a percentage-based expense evenly', () => {
    const splits = createSharedMovement({
      createdBy: 'ana', totalAmountCents: 10000, splitMode: 'percentage',
      splits: [{ user_id: 'ana', percentage: 50 }, { user_id: 'bob', percentage: 50 }],
    });

    expect(splits).toEqual([
      { user_id: 'ana', share_cents: 5000 },
      { user_id: 'bob', share_cents: 5000 },
    ]);
  });

  it('assigns the rounding remainder to whoever registered the movement (Clarifications, FR-009)', () => {
    const splits = createSharedMovement({
      createdBy: 'ana', totalAmountCents: 100, splitMode: 'percentage',
      splits: [
        { user_id: 'ana', percentage: 33.33 },
        { user_id: 'bob', percentage: 33.33 },
        { user_id: 'cass', percentage: 33.34 },
      ],
    });

    expect(splits.reduce((acc, s) => acc + s.share_cents, 0)).toBe(100);
    const anaShare = splits.find(s => s.user_id === 'ana')!.share_cents;
    expect(anaShare).toBeGreaterThanOrEqual(33);
  });

  it('accepts a fixed-amount split whose parts sum exactly to the total', () => {
    const splits = createSharedMovement({
      createdBy: 'ana', totalAmountCents: 9000, splitMode: 'fixed_amount',
      splits: [{ user_id: 'ana', amount_cents: 4000 }, { user_id: 'bob', amount_cents: 5000 }],
    });

    expect(splits).toEqual([
      { user_id: 'ana', share_cents: 4000 },
      { user_id: 'bob', share_cents: 5000 },
    ]);
  });

  it('rejects a fixed-amount split that does not sum to the total (edge case)', () => {
    expect(() => createSharedMovement({
      createdBy: 'ana', totalAmountCents: 9000, splitMode: 'fixed_amount',
      splits: [{ user_id: 'ana', amount_cents: 4000 }, { user_id: 'bob', amount_cents: 4000 }],
    })).toThrow(DomainError);
  });

  it('rejects percentages that do not add up to 100 (edge case)', () => {
    expect(() => createSharedMovement({
      createdBy: 'ana', totalAmountCents: 9000, splitMode: 'percentage',
      splits: [{ user_id: 'ana', percentage: 40 }, { user_id: 'bob', percentage: 40 }],
    })).toThrow(DomainError);
  });
});
