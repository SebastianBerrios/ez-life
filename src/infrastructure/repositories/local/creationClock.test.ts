import { afterEach, describe, it, expect, vi } from 'vitest';

// The clock keeps module-level state, so every test loads a fresh copy of it.
async function freshClock() {
  vi.resetModules();
  return (await import('./creationClock')).nextCreatedAt;
}

describe('nextCreatedAt', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns strictly increasing dates even within the same millisecond', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 10, 0, 0, 0));
    const nextCreatedAt = await freshClock();
    const first = nextCreatedAt(); const second = nextCreatedAt(); const third = nextCreatedAt();
    expect(first.getTime()).toBeLessThan(second.getTime());
    expect(second.getTime()).toBeLessThan(third.getTime());
    expect(second.getTime() - first.getTime()).toBe(1);
  });

  it('follows the real clock when it moves forward', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 10));
    const nextCreatedAt = await freshClock();
    nextCreatedAt();
    vi.setSystemTime(new Date(2026, 9, 22, 11));
    expect(nextCreatedAt().getTime()).toBe(new Date(2026, 9, 22, 11).getTime());
  });

  it('never goes backwards when the system clock does', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 10));
    const nextCreatedAt = await freshClock();
    const before = nextCreatedAt();
    vi.setSystemTime(new Date(2026, 9, 22, 9));
    expect(nextCreatedAt().getTime()).toBeGreaterThan(before.getTime());
  });

  it('returns a new Date each time (callers may mutate it safely)', async () => {
    const nextCreatedAt = await freshClock();
    expect(nextCreatedAt()).not.toBe(nextCreatedAt());
  });
});
