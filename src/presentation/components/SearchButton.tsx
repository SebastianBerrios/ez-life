'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { isMacPlatform } from '../hooks/useHotkey';

interface Props {
  onClick: () => void;
  /** `bar`: the desktop topbar field with its shortcut hint. `icon`: the compact mobile header button. */
  variant: 'bar' | 'icon';
  className?: string;
}

/** Opens the ⌘K palette. Shows the real shortcut for the platform ("⌘ K" on Apple, "Ctrl K" elsewhere). */
export default function SearchButton({ onClick, variant, className }: Props) {
  const mac = isMacPlatform();
  const keys = mac ? '⌘ K' : 'Ctrl K';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Buscar"
        aria-haspopup="dialog"
        className={cn(
          'flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:shadow-focus',
          className,
        )}
      >
        <Search className="size-[18px]" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
      className={cn(
        'flex h-11 w-72 max-w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-body-md text-muted-foreground outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:shadow-focus',
        className,
      )}
    >
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 text-left">Buscar…</span>
      <Kbd aria-hidden="true">{keys}</Kbd>
    </button>
  );
}
