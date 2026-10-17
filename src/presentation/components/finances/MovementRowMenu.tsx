'use client';

import React from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';

interface Props {
  /** Movement title, used to give the trigger a unique accessible name. */
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** Kebab menu with Editar / Eliminar for one movement row (keyboard and screen-reader operable). */
export default function MovementRowMenu({ label, onEdit, onDelete }: Props) {
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
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
