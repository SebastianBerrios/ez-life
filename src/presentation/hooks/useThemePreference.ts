import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Hydration-safe wrapper around `next-themes` supporting Claro / Oscuro / Sistema
 * (spec 013 FR-040).
 */
export function useThemePreference() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current: ThemePreference =
    mounted && (theme === 'light' || theme === 'dark' || theme === 'system')
      ? theme
      : 'system';

  return {
    theme: current,
    resolvedTheme: mounted ? resolvedTheme : undefined,
    setTheme: (next: ThemePreference) => setTheme(next),
    mounted,
  };
}
