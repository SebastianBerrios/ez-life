'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCycleLabel } from '../../core/use-cases/calendar';
import { cn } from '@/lib/utils';

interface Props {
  refDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

const CHEVRON_CLASS =
  'flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:shadow-focus';

/** Shared month selector (chevrons + mono label); the label is the active cycle. */
export default function MonthSelector({ refDate, onPrevious, onNext, className }: Props) {
  return (
    <div className={cn('flex items-center', className)}>
      <button type="button" onClick={onPrevious} aria-label="Mes anterior" className={CHEVRON_CLASS}>
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[6.5rem] text-center font-mono text-label-mono-sm tabular-nums text-foreground" aria-live="polite">
        {formatCycleLabel(refDate)}
      </span>
      <button type="button" onClick={onNext} aria-label="Mes siguiente" className={CHEVRON_CLASS}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
