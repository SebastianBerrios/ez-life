'use client';

import React, { useId } from 'react';
import { addQuickAmount, normalizeAmountInput } from '../../core/use-cases/addQuickAmount';
import { cn } from '@/lib/utils';

/** Quick-amount chips of the quick-record sheet, in integer cents. */
export const QUICK_AMOUNTS_CENTS = [1000, 2000, 5000, 10000] as const;

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Right of the "Monto a registrar" eyebrow (type badge). */
  badge?: React.ReactNode;
  error?: string | null;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Hero amount card shared by the movement and transfer forms: huge amount input, +S/ chips and a
 * "Limpiar monto" link. All the arithmetic lives in `addQuickAmount` (integer cents).
 */
export default function AmountHero({ value, onChange, badge, error, inputRef, autoFocus, className }: Props) {
  const errorId = useId();
  const widthCh = Math.max(value.length, 4);

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 text-center', className)}>
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="font-mono text-label-mono-xs uppercase text-muted-foreground" aria-hidden="true">Monto a registrar</span>
        {badge}
      </div>

      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-headline-lg-mobile font-medium text-muted-foreground" aria-hidden="true">S/</span>
        <input
          ref={inputRef}
          id="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label="Monto"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus={autoFocus}
          placeholder="0.00"
          value={value}
          style={{ width: `${widthCh + 0.5}ch` }}
          className="h-14 min-w-[4.5ch] max-w-[calc(100%-3rem)] rounded-md border-0 bg-transparent p-0 text-center text-display-hero-mobile font-semibold tabular-nums text-foreground caret-primary outline-none placeholder:text-subtle focus-visible:shadow-focus md:text-display-hero"
          onChange={event => onChange(event.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={() => {
            const normalized = normalizeAmountInput(value);
            if (normalized !== null && normalized !== value) onChange(normalized);
          }}
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS_CENTS.map(cents => {
          const label = `S/ ${Math.floor(cents / 100)}`;
          return (
            <button
              key={cents}
              type="button"
              aria-label={`Sumar ${label}`}
              onClick={() => onChange(addQuickAmount(value, cents))}
              className="h-11 rounded-lg border border-border bg-surface-3 font-mono text-label-mono-sm tabular-nums text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:shadow-focus active:translate-y-px"
            >
              +{label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange('')}
        className="mt-1 min-h-11 px-3 font-mono text-label-mono-xs text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:shadow-focus"
      >
        Limpiar monto
      </button>

      {error && <p id={errorId} role="alert" className="mt-1 text-body-md text-destructive">{error}</p>}
    </div>
  );
}
