'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Mono uppercase micro-title with an icon and an action slot, the header of every Control panel. */
export function SectionHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  action,
  titleId,
}: {
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-primary [&_svg]:size-4">{icon}</span>}
        <div className="flex min-w-0 flex-col gap-0.5">
          {eyebrow && <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">{eyebrow}</span>}
          <h3 id={titleId} className="text-headline-md text-foreground">{title}</h3>
          {subtitle && <p className="text-body-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action !== undefined && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Round check used by habits and tasks: a real checkbox (Space/Enter), disabled once it is done. */
export function CheckButton({
  done,
  label,
  onToggle,
  disabled,
}: {
  done: boolean;
  /** Accessible name, e.g. `Marcar "Leer" como cumplido`. */
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={done || disabled}
      onClick={onToggle}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full border outline-none transition-colors focus-visible:shadow-focus',
        done
          ? 'border-primary bg-primary text-primary-foreground disabled:opacity-100'
          : 'border-border-strong bg-surface-3 text-transparent hover:border-primary hover:text-primary',
      )}
    >
      <Check className="size-4" aria-hidden="true" />
    </button>
  );
}

/** Dashed empty-state block with an optional call to action. */
export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong p-4">
      <p className="text-body-md text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
