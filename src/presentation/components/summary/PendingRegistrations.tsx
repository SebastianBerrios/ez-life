'use client';

import React, { useMemo, useState } from 'react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PendingRegistration } from '../../../core/domain/models/types';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import { SUMMARY_MASKED_AMOUNT } from './HideAmountsToggle';

const INITIAL_VISIBLE_COUNT = 3;

interface Props {
  items: PendingRegistration[];
  hidden?: boolean;
  onRegister: (item: PendingRegistration) => void;
  onSkip: (item: PendingRegistration) => void;
}

/**
 * Section 2 of the minimalist Summary: "Por registrar" (spec 013 FR-015..FR-020).
 * Pure presentation: receives ordered items and callbacks from `useSummaryData`.
 * "Registrar" is a secondary button so "+" remains the sole primary CTA (FR-038).
 */
export default function PendingRegistrations({ items, hidden = false, onRegister, onSkip }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Overdue items always appear first, then ordered by day of month.
  const ordered = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.day - b.day || a.key.localeCompare(b.key);
      }),
    [items],
  );

  const hasOverflow = ordered.length > INITIAL_VISIBLE_COUNT;
  const visible = expanded ? ordered : ordered.slice(0, INITIAL_VISIBLE_COUNT);

  const money = (cents: number) => (hidden ? SUMMARY_MASKED_AMOUNT : formatMoney(cents));

  return (
    <Panel aria-label="Por registrar" className="gap-3 p-5" data-testid="pending-registrations">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-fredoka text-lg font-semibold text-foreground">Por registrar</h2>
        {ordered.length > 0 && (
          <span className="text-sm text-muted-foreground">{ordered.length}</span>
        )}
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes nada pendiente este mes.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map(item => (
            <li
              key={item.key}
              data-testid={`pending-item-${item.key}`}
              data-overdue={item.overdue ? 'true' : 'false'}
              className={cn(
                'flex flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between',
                item.overdue
                  ? 'border border-foreground/15 bg-surface-3 font-medium'
                  : 'bg-surface-2/60',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {`${item.title} · ${money(item.amount)} · día ${item.day}`}
                </p>
                {item.overdue && (
                  <p className="text-xs text-muted-foreground">Pendiente de días anteriores</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11"
                  onClick={() => onRegister(item)}
                >
                  Registrar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-muted-foreground"
                  onClick={() => onSkip(item)}
                >
                  Omitir este mes
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasOverflow && !expanded && (
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 w-full text-muted-foreground"
            onClick={() => setExpanded(true)}
          >
            {`Ver todos (${ordered.length})`}
          </Button>
        </div>
      )}
    </Panel>
  );
}
