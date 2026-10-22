'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Short-lived inline notices keyed by the element that caused them (e.g. a category id), so each one
 * shows next to its source. A notice hides after `ttlMs`, or right away via `clear` / `clearAll`
 * (call `clearAll` when the user starts another action). Form validation errors do NOT belong here:
 * they must stay until the user fixes them.
 */
export function useTransientMessages(ttlMs = 4000) {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const drop = useCallback((key: string) => {
    setMessages(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clear = useCallback((key: string) => {
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    drop(key);
  }, [drop]);

  const clearAll = useCallback(() => {
    timers.current.forEach(timer => clearTimeout(timer));
    timers.current.clear();
    setMessages(prev => (Object.keys(prev).length ? {} : prev));
  }, []);

  const show = useCallback((key: string, text: string) => {
    clearTimeout(timers.current.get(key));
    setMessages(prev => ({ ...prev, [key]: text }));
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      drop(key);
    }, ttlMs));
  }, [drop, ttlMs]);

  // Never leave a timer behind: it would update the state of an unmounted component.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(timer => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return { messages, show, clear, clearAll };
}
