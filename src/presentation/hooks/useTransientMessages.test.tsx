import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTransientMessages } from './useTransientMessages';

describe('useTransientMessages', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows a message and hides it after 4 seconds', () => {
    const { result } = renderHook(() => useTransientMessages());
    act(() => result.current.show('a', 'No se puede eliminar'));
    expect(result.current.messages).toEqual({ a: 'No se puede eliminar' });

    act(() => { vi.advanceTimersByTime(3999); });
    expect(result.current.messages.a).toBe('No se puede eliminar');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.messages).toEqual({});
  });

  it('showing the same key again restarts its timer and replaces the text', () => {
    const { result } = renderHook(() => useTransientMessages());
    act(() => result.current.show('a', 'primero'));
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => result.current.show('a', 'segundo'));
    act(() => { vi.advanceTimersByTime(3000); }); // 6 s after the first, 3 s after the second
    expect(result.current.messages).toEqual({ a: 'segundo' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.messages).toEqual({});
  });

  it('keeps independent timers per key', () => {
    const { result } = renderHook(() => useTransientMessages());
    act(() => result.current.show('a', 'uno'));
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => result.current.show('b', 'dos'));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.messages).toEqual({ b: 'dos' });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.messages).toEqual({});
  });

  it('clear(key) hides one message right away and cancels only its timer', () => {
    const { result } = renderHook(() => useTransientMessages());
    act(() => { result.current.show('a', 'uno'); result.current.show('b', 'dos'); });
    act(() => result.current.clear('a'));
    expect(result.current.messages).toEqual({ b: 'dos' });
    expect(vi.getTimerCount()).toBe(1);
  });

  it('clearAll() hides everything right away and cancels every timer', () => {
    const { result } = renderHook(() => useTransientMessages());
    act(() => { result.current.show('a', 'uno'); result.current.show('b', 'dos'); });
    act(() => result.current.clearAll());
    expect(result.current.messages).toEqual({});
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clear on a missing key and clearAll with nothing shown are harmless', () => {
    const { result } = renderHook(() => useTransientMessages());
    const before = result.current.messages;
    act(() => { result.current.clear('nope'); result.current.clearAll(); });
    expect(result.current.messages).toBe(before);
  });

  it('honours a custom ttl', () => {
    const { result } = renderHook(() => useTransientMessages(1000));
    act(() => result.current.show('a', 'rápido'));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.messages).toEqual({});
  });

  it('leaves no timer running after unmount (no state updates on an unmounted component)', () => {
    const { result, unmount } = renderHook(() => useTransientMessages());
    act(() => { result.current.show('a', 'uno'); result.current.show('b', 'dos'); });
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns stable callbacks across renders', () => {
    const { result, rerender } = renderHook(() => useTransientMessages());
    const first = result.current;
    rerender();
    expect(result.current.show).toBe(first.show);
    expect(result.current.clear).toBe(first.clear);
    expect(result.current.clearAll).toBe(first.clearAll);
  });
});
