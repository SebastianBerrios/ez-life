import { useCallback, useEffect, useState } from 'react';

export const HIDE_AMOUNTS_STORAGE_KEY = 'ez-life:hide-amounts';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(HIDE_AMOUNTS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Ocultar montos" (eye toggle of the Inicio hero). Visible by default; the choice persists per
 * device in localStorage. Storage can be unavailable (private mode, blocked data): then it simply
 * works for the session. Read in an effect so server and first client render agree.
 */
export function useHideAmounts(): { hidden: boolean; toggle: () => void } {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readStored());
  }, []);

  const toggle = useCallback(() => {
    setHidden(current => {
      const next = !current;
      try {
        window.localStorage.setItem(HIDE_AMOUNTS_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Persistence is a convenience only.
      }
      return next;
    });
  }, []);

  return { hidden, toggle };
}
