import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNotificationEvaluator } from './useNotificationEvaluator';
import { db } from '../../infrastructure/db/db';

describe('useNotificationEvaluator', () => {
  const userId = 'user-1';
  const now = new Date();

  beforeEach(async () => {
    await db.profiles.clear();
    await db.movements.clear();
    await db.distribution_categories.clear();
    await db.savings_goals.clear();
    await db.notifications.clear();
    await db.sync_queue.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a budget_over_80 notification when a bucket crosses 80% of its budget, and a second run does not duplicate it', async () => {
    await db.profiles.put({
      id: userId,
      push_enabled: false, // avoid touching the real browser Notification API in tests
      created_at: now,
      updated_at: now,
    });

    await db.distribution_categories.put({
      id: 'bucket-1',
      user_id: userId,
      name: 'Necesidades',
      percentage: 100,
      is_default: true,
      is_savings: false,
      created_at: now,
      updated_at: now,
    });

    await db.movements.put({
      id: 'income-1',
      user_id: userId,
      type: 'INCOME',
      amount: 10000,
      date: now,
      is_recurring: false,
      created_at: now,
      updated_at: now,
    });

    await db.movements.put({
      id: 'expense-1',
      user_id: userId,
      type: 'EXPENSE',
      amount: 9000, // 90% of the 100%-budgeted bucket
      date: now,
      distribution_category_id: 'bucket-1',
      is_recurring: false,
      created_at: now,
      updated_at: now,
    });

    const { unmount } = renderHook(() => useNotificationEvaluator(userId));

    await waitFor(async () => {
      const notifications = await db.notifications.where('user_id').equals(userId).toArray();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('budget_over_80');
      expect(notifications[0].related_id).toBe('bucket-1');
    });

    unmount();

    // A second evaluation run (e.g. the 5-minute interval, or a remount)
    // must not create a duplicate for the same bucket/month.
    const { unmount: unmountSecond } = renderHook(() => useNotificationEvaluator(userId));

    await waitFor(async () => {
      const notifications = await db.notifications.where('user_id').equals(userId).toArray();
      expect(notifications.length).toBeGreaterThan(0);
    });

    // Give any in-flight save a moment to settle before asserting no duplicate exists.
    await new Promise(resolve => setTimeout(resolve, 50));

    const notifications = await db.notifications.where('user_id').equals(userId).toArray();
    expect(notifications).toHaveLength(1);

    unmountSecond();
  });

  it('does nothing when userId is null', async () => {
    renderHook(() => useNotificationEvaluator(null));

    await new Promise(resolve => setTimeout(resolve, 50));

    const notifications = await db.notifications.toArray();
    expect(notifications).toHaveLength(0);
  });
});
