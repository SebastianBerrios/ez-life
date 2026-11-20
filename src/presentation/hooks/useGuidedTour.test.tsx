import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../infrastructure/db/db';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { useGuidedTour } from './useGuidedTour';

describe('useGuidedTour (T074)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('activates once for a completed v1 profile without tour_seen, walks steps 1..4, and persists tour_seen on finish', async () => {
    const userId = 'v1-user';
    await new LocalProfileRepository().save({ id: userId, onboarding_step: 3 });

    const { result, unmount } = renderHook(() => useGuidedTour(userId, true));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.step).toBe(1);

    act(() => result.current.next());
    expect(result.current.step).toBe(2);
    act(() => result.current.next());
    expect(result.current.step).toBe(3);
    act(() => result.current.next());
    expect(result.current.step).toBe(4);

    act(() => result.current.finish());
    expect(result.current.active).toBe(false);
    await waitFor(async () => expect((await db.profiles.get(userId))?.tour_seen).toBe(true));

    // Remounting does not auto-show the tour again
    unmount();
    const reopened = renderHook(() => useGuidedTour(userId, true));
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(reopened.result.current.active).toBe(false);
  });

  it('persists tour_seen when skipped on any step', async () => {
    const userId = 'skip-user';
    await new LocalProfileRepository().save({ id: userId, onboarding_step: 6, onboarding_version: 2 });

    const { result } = renderHook(() => useGuidedTour(userId, true));
    await waitFor(() => expect(result.current.active).toBe(true));

    act(() => result.current.next());
    expect(result.current.step).toBe(2);

    act(() => result.current.skip());
    expect(result.current.active).toBe(false);
    await waitFor(async () => expect((await db.profiles.get(userId))?.tour_seen).toBe(true));
  });

  it('replays from step 1 without mutating tour_seen', async () => {
    const userId = 'replay-user';
    const saved = await new LocalProfileRepository().save({ id: userId, onboarding_step: 6, tour_seen: true });
    const beforeUpdatedAt = saved.updated_at.getTime();

    const { result } = renderHook(() => useGuidedTour(userId, true));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(result.current.active).toBe(false);

    act(() => result.current.replay());
    expect(result.current.active).toBe(true);
    expect(result.current.step).toBe(1);

    act(() => result.current.skip());
    expect(result.current.active).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 30));
    const after = await db.profiles.get(userId);
    expect(after?.tour_seen).toBe(true);
    expect(after?.updated_at.getTime()).toBe(beforeUpdatedAt);
  });
});
