'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemePreference, type ThemePreference } from '../hooks/useThemePreference';

const OPTIONS: { value: ThemePreference; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
];

/**
 * Three-way theme preference selector: Claro / Oscuro / Sistema (spec 013 FR-040).
 * Updates immediately and persists via `next-themes` when the user chooses an option.
 */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useThemePreference();

  return (
    <div
      role="radiogroup"
      aria-label="Tema visual"
      className={cn('inline-flex items-center gap-1 rounded-full bg-surface-2 p-1', className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full text-xs font-medium outline-none transition-colors focus-visible:shadow-focus',
              compact ? 'min-w-11 px-2' : 'px-3',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className={compact ? 'sr-only' : undefined}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
