'use client';

import React from 'react';
import { ChevronRight, Users, Award } from 'lucide-react';

interface Props {
  onNavigate: (route: string) => void;
  showProgress: boolean;
}

/**
 * Transitional mobile-only entry rows: Espacio Compartido and Mi Progreso have no slot in the
 * five-item bottom nav. Rendered on Inicio and Ajustes (deliberate redundancy); Phase 4 replaces
 * the Inicio copy with the dashboard cards.
 */
export default function MobileRouteLinks({ onNavigate, showProgress }: Props) {
  const rows = [
    { id: 'shared-space', label: 'Espacio compartido', Icon: Users, visible: true },
    { id: 'progress', label: 'Mi progreso', Icon: Award, visible: showProgress },
  ].filter((row) => row.visible);

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card md:hidden" data-testid="mobile-route-links">
      {rows.map(({ id, label, Icon }) => (
        <li key={id}>
          <button
            type="button"
            onClick={() => onNavigate(id)}
            className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-body-md text-foreground outline-none transition-colors hover:bg-surface-3 focus-visible:shadow-focus"
          >
            <Icon className="size-[18px] text-muted-foreground" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-4 text-subtle" />
          </button>
        </li>
      ))}
    </ul>
  );
}
