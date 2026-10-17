'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

// Two-state toggle: the app defaults to dark and `enableSystem` is off (spec 010),
// so a "system" step would leave next-themes without a resolvable class.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown on the server: render the dark default until mounted
  // so the markup matches during hydration.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLight = mounted && theme === 'light';

  const label = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';

  return (
    <button
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className="relative flex size-11 items-center justify-center rounded-lg outline-none transition-colors hover:bg-surface-3 focus-visible:shadow-focus"
      title={label}
      aria-label={label}
    >
      <Sun className={`h-5 w-5 transition-all text-foreground ${isLight ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`} />
      <Moon className={`h-5 w-5 transition-all text-foreground ${!isLight ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
