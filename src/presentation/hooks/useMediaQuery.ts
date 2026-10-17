import { useSyncExternalStore } from 'react';

/** Tailwind `md` breakpoint: the redesigned screens switch from the phone to the desktop layout here. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * Live `matchMedia` match. Returns `false` where `matchMedia` does not exist (SSR, jsdom), so the
 * mobile layout is the safe default. Subscribes with `useSyncExternalStore`, so the first client
 * render already reads the real value (no flash of the wrong layout).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
