'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const label =
    theme === 'light' ? 'Cambiar a modo oscuro' :
    theme === 'dark' ? 'Usar tema del sistema' :
    'Cambiar a modo claro';

  return (
    <button
      onClick={cycleTheme}
      className="relative p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
      title={label}
      aria-label={label}
    >
      {/* Light */}
      <Sun className={`h-5 w-5 transition-all text-foreground ${theme === 'light' ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`} />
      {/* Dark */}
      <Moon className={`h-5 w-5 transition-all text-foreground ${theme === 'dark' ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`} />
      {/* System */}
      <Monitor className={`h-5 w-5 transition-all text-foreground ${(!theme || theme === 'system') ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
