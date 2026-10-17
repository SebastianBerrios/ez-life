import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../infrastructure/db/db';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';
import { useHasUnreadNotifications } from './useHasUnreadNotifications';

const base = { user_id: 'u1', title: 't', body: 'b' };

beforeEach(async () => {
  await db.notifications.clear();
});

describe('useHasUnreadNotifications', () => {
  it('is false with no notifications and for a missing user', async () => {
    const { result } = renderHook(() => useHasUnreadNotifications('u1', true));
    await waitFor(() => expect(result.current).toBe(false));
    const { result: noUser } = renderHook(() => useHasUnreadNotifications(null, true));
    expect(noUser.current).toBe(false);
  });

  it('turns true for an unread notification and false once it is read', async () => {
    const repo = new LocalNotificationRepository();
    const { result } = renderHook(() => useHasUnreadNotifications('u1', true));
    await repo.save({ ...base, id: 'n1', type: 'daily_reminder' });
    await waitFor(() => expect(result.current).toBe(true));
    await repo.markRead('n1');
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('ignores achievement notifications when progress is hidden', async () => {
    await new LocalNotificationRepository().save({ ...base, id: 'n2', type: 'achievement_unlocked' });
    const { result } = renderHook(() => useHasUnreadNotifications('u1', false));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current).toBe(false);
  });
});
