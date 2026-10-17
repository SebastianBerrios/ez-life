'use client';

import React from 'react';
import { MoreVertical, Pencil, Square, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';

interface Props {
  /** Item title, used to give the trigger a unique accessible name. */
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  /** Extra action between Editar and Eliminar (e.g. "Detener recurrencia"). */
  extra?: { label: string; onSelect: () => void };
}

/** Kebab menu of one Control item: Editar / (extra) / Eliminar. Keyboard and screen-reader operable. */
export default function ItemMenu({ label, onEdit, onDelete, extra }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Acciones de ${label}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:shadow-focus aria-expanded:bg-surface-3 aria-expanded:text-foreground"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`Acciones de ${label}`}>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        {extra && (
          <DropdownMenuItem onClick={extra.onSelect}>
            <Square aria-hidden="true" />
            {extra.label}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
