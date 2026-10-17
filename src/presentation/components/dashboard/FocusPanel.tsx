'use client';

import React from 'react';
import { Check, ChevronRight, Flame, Zap } from 'lucide-react';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import type { FocusItem } from '../../../core/use-cases/buildFocusToday';
import { cn } from '@/lib/utils';

/** Items shown before "Ver todo" takes over (the full list lives in Control & Hábitos). */
export const FOCUS_VISIBLE_ITEMS = 5;

interface Props {
  items: FocusItem[];
  desktop: boolean;
  onToggle: (item: FocusItem) => void;
  onSeeAll: () => void;
}

function streakLabel(item: FocusItem): string | null {
  if (item.kind !== 'habit' || !item.streak || item.streak <= 0) return null;
  return `Racha ${item.streak} ${item.streakUnit === 'weeks' ? 'sem' : 'd'}`;
}

function FocusRow({ item, onToggle }: { item: FocusItem; onToggle: (item: FocusItem) => void }) {
  const streak = streakLabel(item);
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-lg bg-foreground/[0.03] px-3 py-2" data-testid={`focus-item-${item.kind}-${item.id}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={`Marcar "${item.title}" como ${item.kind === 'habit' ? 'cumplido' : 'hecha'}`}
        disabled={item.done}
        onClick={() => onToggle(item)}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-full border outline-none transition-colors focus-visible:shadow-focus',
          item.done
            ? 'border-primary bg-primary text-primary-foreground disabled:opacity-100'
            : 'border-border-strong bg-surface-3 text-transparent hover:border-primary hover:text-primary',
        )}
      >
        <Check className="size-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-body-md font-medium text-foreground', item.done && 'text-muted-foreground line-through')}>
          {item.title}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-label-mono-xs text-muted-foreground">
          <span>{item.kind === 'habit' ? 'Hábito' : 'Tarea · vence hoy'}</span>
          {item.tag && <span>· {item.tag}</span>}
          {item.done && <span>· Completado</span>}
          {!item.done && streak && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Flame className="size-3" aria-hidden="true" />
              {streak}
            </span>
          )}
          {!item.done && item.kind === 'task' && item.priority === 'high' && <Badge variant="negative">Urgente</Badge>}
        </p>
      </div>
    </li>
  );
}

/** "Foco de Hoy": today's habits and tasks, each markable done. Done habits cannot be undone here. */
export default function FocusPanel({ items, desktop, onToggle, onSeeAll }: Props) {
  const pending = items.filter(item => !item.done).length;
  const visible = items.slice(0, FOCUS_VISIBLE_ITEMS);
  return (
    <Panel aria-label="Foco de Hoy" data-testid="focus-panel">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {desktop && <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Protocolos y rutinas</span>}
          <h3 className="flex items-center gap-2 text-headline-md text-foreground">
            {!desktop && <Zap className="size-5 text-primary" aria-hidden="true" />}
            Foco de Hoy
          </h3>
        </div>
        {desktop ? (
          items.length > 0 && (
            <span className="font-mono text-label-mono-xs text-primary">
              {pending} {pending === 1 ? 'Pendiente' : 'Pendientes'}
            </span>
          )
        ) : (
          items.length > 0 && (
            <button
              type="button"
              onClick={onSeeAll}
              className="-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 font-mono text-label-mono-sm text-primary outline-none hover:bg-surface-3 focus-visible:shadow-focus"
            >
              Ver todo ({items.length})
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )
        )}
      </div>
      <PanelBody className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-body-md text-muted-foreground">Nada programado para hoy</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map(item => (
              <FocusRow key={`${item.kind}-${item.id}`} item={item} onToggle={onToggle} />
            ))}
          </ul>
        )}
        {desktop && items.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="mt-1 flex min-h-11 items-center justify-center gap-1 rounded-lg font-mono text-label-mono-sm text-primary outline-none hover:bg-surface-3 focus-visible:shadow-focus"
          >
            Ver todo ({items.length})
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </PanelBody>
    </Panel>
  );
}
