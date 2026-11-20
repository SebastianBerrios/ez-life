'use client';

import React from 'react';
import { CheckCircle2, ChevronRight, Circle, X } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import type { SetupChecklist, SetupChecklistKey } from '../../../core/domain/models/types';

const ITEM_LABELS: Record<SetupChecklistKey, string> = {
  income: 'Ingresos',
  accounts: 'Cuentas',
  cards: 'Tarjetas',
  loans: 'Préstamos',
};

interface Props {
  checklist: SetupChecklist;
  onOpenStep: (key: SetupChecklistKey) => void;
  onDismiss: () => void;
}

/**
 * Section 6 of the minimalist Summary: "Completa tu configuración · N de 4" (spec 013 FR-027..FR-029).
 * Hidden automatically when dismissed or when all 4 items are done.
 */
export default function SetupChecklistCard({ checklist, onOpenStep, onDismiss }: Props) {
  if (!checklist.visible) return null;

  return (
    <Panel
      aria-label="Completa tu configuración"
      className="gap-3 p-5"
      data-tour="setup"
      data-testid="setup-checklist"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-fredoka text-lg font-semibold text-foreground">
          {`Completa tu configuración · ${checklist.doneCount} de ${checklist.items.length}`}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Descartar lista de configuración"
          className="-my-2 -mr-2 min-h-11 min-w-11 text-muted-foreground"
          onClick={onDismiss}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <ul className="space-y-1.5">
        {checklist.items.map(item => (
          <li key={item.key}>
            <button
              type="button"
              data-testid={`setup-checklist-item-${item.key}`}
              data-done={item.done ? 'true' : 'false'}
              onClick={() => onOpenStep(item.key)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-3 outline-none focus-visible:shadow-focus"
            >
              <span className="flex items-center gap-2.5">
                {item.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={item.done ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}>
                  {ITEM_LABELS[item.key]}
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{item.done ? 'Listo' : 'Completar'}</span>
                <ChevronRight className="size-4" aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
