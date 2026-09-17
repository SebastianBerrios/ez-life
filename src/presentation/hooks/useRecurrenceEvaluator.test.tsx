import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecurrenceEvaluator } from './useRecurrenceEvaluator';
import { db } from '../../infrastructure/db/db';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';

describe('useRecurrenceEvaluator', () => {
  const userId = 'user-1';

  beforeEach(async () => {
    await db.movements.clear();
    await db.profiles.clear();
    await db.sync_queue.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rolls back cloned movements when the profile update fails mid-transaction', async () => {
    // Only fake Date so IndexedDB's own internal scheduling (setTimeout/microtasks)
    // keeps running on real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    const lastMonthDate = new Date(2023, 8, 10); // Sep 10, 2023
    const now = new Date(2023, 9, 15); // Oct 15, 2023
    vi.setSystemTime(now);

    await db.profiles.put({
      id: userId,
      last_recurrence_eval_month: '2023-09',
      created_at: lastMonthDate,
      updated_at: lastMonthDate,
    });

    await db.movements.put({
      id: 'recurring-1',
      user_id: userId,
      type: 'EXPENSE',
      amount: 500,
      date: lastMonthDate,
      is_recurring: true,
      created_at: lastMonthDate,
      updated_at: lastMonthDate,
    });

    const saveSpy = vi
      .spyOn(LocalProfileRepository.prototype, 'save')
      .mockRejectedValue(new Error('boom'));

    renderHook(() => useRecurrenceEvaluator(userId));

    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    // Let the rejected transaction settle.
    await waitFor(async () => {
      const profile = await db.profiles.get(userId);
      expect(profile?.last_recurrence_eval_month).toBe('2023-09');
    });

    const movements = await db.movements.where('user_id').equals(userId).toArray();
    // Only the original recurring movement remains — the clone written earlier
    // in the same transaction was rolled back with the failed profile save.
    expect(movements).toHaveLength(1);
    expect(movements[0].id).toBe('recurring-1');
  });
});
