'use client';

import React, { useId } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  online: boolean;
  /** True when the selected month has no movements to export. */
  exportDisabled: boolean;
  exporting: boolean;
  exportError: string;
  onExport: () => void;
}

/** Clean sentence-case header for Finanzas: title, subtle status badge, and secondary CSV export. */
export default function FinancesHeader({ online, exportDisabled, exporting, exportError, onExport }: Props) {
  const hintId = useId();
  return (
    <header className="flex flex-col gap-2" data-testid="finances-header">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-fredoka text-headline-lg-mobile md:text-headline-lg text-foreground">
            Finanzas
          </h2>
          <Badge variant={online ? 'positive' : 'warning'} data-testid="connection-badge">
            <span className={cn('size-1.5 rounded-full', online ? 'bg-primary' : 'bg-warning')} aria-hidden="true" />
            {online ? 'En línea' : 'Sin conexión'}
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled={exportDisabled || exporting}
          aria-describedby={exportDisabled ? hintId : undefined}
          title={exportDisabled ? 'No hay movimientos en este mes para exportar' : undefined}
          onClick={() => { if (!exportDisabled && !exporting) onExport(); }}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          Exportar CSV
        </Button>
      </div>
      {exportDisabled && (
        <p id={hintId} className="text-xs text-muted-foreground">
          No hay movimientos este mes para exportar.
        </p>
      )}
      {exportError && <p role="alert" className="text-body-sm text-destructive">{exportError}</p>}
    </header>
  );
}
