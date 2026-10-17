import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTaskRecurrenceEvaluator } from './useTaskRecurrenceEvaluator';
import { db } from '../../infrastructure/db/db';
import { calendarKey } from '../../core/use-cases/calendar';

describe('useTaskRecurrenceEvaluator', () => {
  const userId = 'user-1';

  beforeEach(async () => {
    await db.tasks.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('on mount, invokes evaluateTaskRecurrence and persists the new occurrence via the repository (FR-003)', async () => {
    // Only fake Date so IndexedDB's own internal scheduling (setTimeout/microtasks)
    // keeps running on real timers (same pattern as useRecurrenceEvaluator.test.tsx).
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date(2025, 11, 20, 9);

    await db.tasks.put({
      id: 't1',
      user_id: userId,
      title: 'Sacar la basura',
      due_date: new Date(2026, 0, 3, 12), // Saturday, local noon
      status: 'pending',
      schedule_mode: 'fixed_days',
      fixed_days: ['sat'],
      recurrence_series_id: 'series-1',
      recurrence_active: true,
      created_at: now,
      updated_at: now,
    });

    vi.setSystemTime(new Date(2026, 0, 11, 22, 30)); // Sunday evening, after the next Saturday

    const { unmount } = renderHook(() => useTaskRecurrenceEvaluator(userId));

    await waitFor(async () => {
      const tasks = await db.tasks.where('user_id').equals(userId).toArray();
      expect(tasks).toHaveLength(2);
    });

    const tasks = await db.tasks.where('user_id').equals(userId).toArray();
    const generated = tasks.find(t => t.id !== 't1');
    expect(generated).toBeDefined();
    expect(generated?.recurrence_series_id).toBe('series-1');
    expect(generated?.status).toBe('pending');
    // A local calendar day at local noon (UTC arithmetic produced the previous day west of UTC).
    expect(calendarKey(new Date(generated!.due_date))).toBe('2026-01-10');
    expect(new Date(generated!.due_date).getHours()).toBe(12);

    unmount();
  });

  it('does nothing when userId is null', async () => {
    renderHook(() => useTaskRecurrenceEvaluator(null));

    await new Promise(resolve => setTimeout(resolve, 50));

    const tasks = await db.tasks.toArray();
    expect(tasks).toHaveLength(0);
  });
});
