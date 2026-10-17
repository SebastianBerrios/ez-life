'use client';

import React, { useId } from 'react';
import { Download, Loader2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  desktop: boolean;
  online: boolean;
  /** True when the selected month has no movements to export. */
  exportDisabled: boolean;
  exporting: boolean;
  exportError: string;
  onExport: () => void;
  onNewMovement: () => void;
}

/** Eyebrow, title, connection badge and the two header actions of Finanzas. The month comes from the shell. */
export default function FinancesHeader({ desktop, online, exportDisabled, exporting, exportError, onExport, onNewMovement }: Props) {
  const hintId = useId();
  return (
    <header className="flex flex-col gap-3" data-testid="finances-header">
      {desktop && (
        <p className="font-mono text-label-mono-xs uppercase text-muted-foreground">
          Finanzas personales / <span className="text-primary">Panel maestro</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-headline-lg-mobile md:text-headline-lg text-foreground">
          {desktop ? 'Movimientos, Presupuestos & Préstamos' : 'Finanzas'}
        </h2>
        {!desktop && <Badge>PEN (S/)</Badge>}
        <Badge variant={online ? 'positive' : 'warning'} data-testid="connection-badge">
          <span className={cn('size-1.5 rounded-full', online ? 'bg-primary' : 'bg-warning')} aria-hidden="true" />
          {online ? 'En línea' : 'Sin conexión'}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          aria-disabled={exportDisabled || exporting}
          aria-describedby={exportDisabled ? hintId : undefined}
          title={exportDisabled ? 'No hay movimientos en este mes para exportar' : undefined}
          onClick={() => { if (!exportDisabled && !exporting) onExport(); }}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          Exportar CSV
        </Button>
        <Button type="button" onClick={onNewMovement}>
          <Plus aria-hidden="true" />
          Nuevo Movimiento
        </Button>
        {exportDisabled && (
          <p id={hintId} className="font-mono text-label-mono-xs text-muted-foreground">
            No hay movimientos este mes para exportar.
          </p>
        )}
        {exportError && <p role="alert" className="text-body-sm text-destructive">{exportError}</p>}
      </div>
    </header>
  );
}
