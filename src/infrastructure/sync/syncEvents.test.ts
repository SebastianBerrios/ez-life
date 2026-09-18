import { describe, it, expect, vi } from 'vitest';
import { onSyncCompleted, emitSyncCompleted } from './syncEvents';

describe('syncEvents', () => {
  it('notifies a subscribed listener when sync completes', () => {
    const listener = vi.fn();
    onSyncCompleted(listener);

    emitSyncCompleted();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = onSyncCompleted(listener);
    unsubscribe();

    emitSyncCompleted();

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscribed listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    onSyncCompleted(first);
    onSyncCompleted(second);

    emitSyncCompleted();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
