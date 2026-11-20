'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SUMMARY_MASKED_AMOUNT = '••••';

/** Eye toggle for hiding monetary amounts on the Summary screen (min 44px touch target). */
export function HideAmountsToggle({ hidden, onToggle, className }: { hidden: boolean; onToggle: () => void; className?: string }) {
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
