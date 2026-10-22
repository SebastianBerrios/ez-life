'use client';

import React from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panel';
import { Money } from '@/components/ui/money';
import type { DashboardView } from '../../hooks/useDashboardData';

interface Props {
  view: DashboardView;
  onOpen: () => void;
}

/** Desktop "Espacio Compartido": the user's net balance per shared space. Hidden when there is none. */
export default function SharedSpaceCard({ view, onOpen }: Props) {
  const spaces = view.sharedSpaces;
  if (spaces.length === 0) return null;
  const hasPending = spaces.some(space => space.netCents !== 0);

  return (
    <Panel aria-label="Espacio Compartido" data-testid="shared-space-card">
      <PanelHeader eyebrow="Sincronización de gastos" title="Espacio Compartido" />
      <PanelBody className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {spaces.slice(0, 3).map(space => (
            <li key={space.id} className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-3 py-2.5" data-testid={`shared-${space.id}`}>
              <span className="min-w-0 truncate text-body-md text-foreground">{space.name}</span>
              {space.netCents === 0 ? (
                <span className="shrink-0 font-mono text-label-mono-xs text-muted-foreground">Sin saldos pendientes</span>
              ) : (
                <span className="flex shrink-0 items-baseline gap-1.5 font-mono text-label-mono-xs text-muted-foreground">
                  {space.netCents > 0 ? 'Te deben' : 'Debes'}
                  <Money cents={Math.abs(space.netCents)} sign="never" size="sm" tone={space.netCents > 0 ? 'income' : 'expense'} className="font-semibold" />
                </span>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-11 items-center justify-end rounded-lg px-2 font-mono text-label-mono-sm text-primary outline-none hover:bg-surface-3 focus-visible:shadow-focus"
        >
          {hasPending ? 'Liquidar saldo' : 'Ver espacio'}
        </button>
      </PanelBody>
    </Panel>
  );
}
