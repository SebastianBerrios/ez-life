'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Money, type MoneyProps } from '@/components/ui/money';
import { cn } from '@/lib/utils';

export const MASKED_AMOUNT = '••••';

const MASK_SIZE_CLASS = {
  lg: 'text-metric-num-lg',
  md: 'text-metric-num-md',
  sm: 'text-body-md',
} as const;

/** `Money`, or a mask when the user chose to hide amounts. */
export function Amount({ hidden, cents, sign, tone, size = 'md', className, ...rest }: MoneyProps & { hidden?: boolean }) {
  if (!hidden) return <Money cents={cents} sign={sign} tone={tone} size={size} className={className} {...rest} />;
  return (
    <span
      aria-label="Monto oculto"
      className={cn('inline-flex items-baseline tabular-nums tracking-widest', MASK_SIZE_CLASS[size], className)}
      {...rest}
    >
      {MASKED_AMOUNT}
    </span>
  );
}

/** Eye toggle for hiding amounts; `aria-pressed` is true while amounts are hidden. */
export function HideAmountsToggle({ hidden, onToggle, className }: { hidden: boolean; onToggle: () => void; className?: string }) {
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:shadow-focus',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
