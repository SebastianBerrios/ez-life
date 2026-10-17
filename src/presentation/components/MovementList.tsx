'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import type { Movement } from '../../core/domain/models/types';
import { describeMovement, type MovementLookups } from '../../core/use-cases/describeMovement';
import { useRevealTarget } from '../hooks/useRevealTarget';
import {
  categoryOptions, countByFilter, DEFAULT_SELECTION, isSelectionActive, selectMovements, type MovementSelection,
} from '../../core/use-cases/filterMovements';
import { groupByDay } from '../../core/use-cases/groupMovementsByDay';
import { pageNumbers, paginate } from '../../core/use-cases/paginate';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import MovementForm from './MovementForm';
import MovementToolbar, { SearchField } from './finances/MovementToolbar';
import { MovementCard, MovementTable } from './finances/MovementRows';

/** Rows per page on the desktop table. */
export const MOVEMENT_PAGE_SIZE = 20;

interface Props {
  userId: string;
  /** Movements of the selected month (the screen reads them through `useFinancesData`). */
  movements: Movement[];
  lookups: MovementLookups;
  /** Ids of movements with changes not yet pushed to the server (desktop "Estado" column). */
  pendingIds: ReadonlySet<string>;
  /** Net balance of the whole cycle (income - expense, transfers excluded), shown in the table footer. */
  balanceCents: number;
  /** Moment "Hoy"/"Ayer" are relative to. */
  today: Date;
  loading: boolean;
  desktop: boolean;
  /** Called after an edit or delete so the screen can refresh its data. */
  onChanged: () => void;
  /** Movement a ⌘K selection wants shown: editable ones open their edit dialog, the rest are revealed in the list. */
  focusId?: string;
  /** Changes every time the same movement is requested again. */
  focusNonce?: number;
  /** Called once the request was served, or abandoned because the movement is not in this month. */
  onFocusHandled?: () => void;
}

/** A request whose movement never shows up (deleted, other month) is dropped after this long. */
const FOCUS_GIVE_UP_MS = 4000;

function emptyMessage(selection: MovementSelection): string {
  if (selection.query.trim() !== '' || selection.categoryId !== DEFAULT_SELECTION.categoryId) {
    return 'No hay movimientos que coincidan con tu búsqueda o filtro.';
  }
  switch (selection.filter) {
    case 'expense': return 'No hay gastos en este mes.';
    case 'income': return 'No hay ingresos en este mes.';
    case 'transfer': return 'No hay transferencias en este mes.';
    case 'shared': return 'No hay movimientos compartidos en este mes.';
    default: return 'No hay movimientos en este mes.';
  }
}

function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  const pageButton = 'min-w-11 px-2 font-mono text-label-mono-sm tabular-nums';
  return (
    <nav aria-label="Paginación de movimientos" className="flex flex-wrap items-center gap-1">
      <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
      {pageNumbers(page, pageCount).map((number, index) =>
        number === null ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">…</span>
        ) : (
          <Button
            key={number}
            type="button"
            variant={number === page ? 'default' : 'ghost'}
            aria-label={`Página ${number}`}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onPage(number)}
            className={pageButton}
          >
            {number}
          </Button>
        ),
      )}
      <Button type="button" variant="ghost" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Siguiente</Button>
    </nav>
  );
}

/**
 * Movement history of the selected month: tab filters with counts, local search, category filter,
 * date sort, edit/delete through a row menu. Mobile groups rows by day; desktop shows a paginated table.
 * All selection logic lives in `core/use-cases`; this component only renders and wires events.
 */
export default function MovementList({
  userId, movements, lookups, pendingIds, balanceCents, today, loading, desktop, onChanged, focusId, focusNonce, onFocusHandled,
}: Props) {
  const [selection, setSelection] = useState<MovementSelection>(DEFAULT_SELECTION);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Movement | undefined>();
  const [error, setError] = useState('');
  const [revealId, setRevealId] = useState<string | undefined>();
  const servedFocus = useRef<string | null>(null);

  const counts = useMemo(() => countByFilter(movements), [movements]);
  const categories = useMemo(() => categoryOptions(movements, lookups), [movements, lookups]);
  const selected = useMemo(() => selectMovements(movements, lookups, selection), [movements, lookups, selection]);
  const current = useMemo(() => paginate(selected, page, MOVEMENT_PAGE_SIZE), [selected, page]);
  const groups = useMemo(() => groupByDay(selected, today), [selected, today]);

  const changeSelection = (next: MovementSelection) => {
    setSelection(next);
    setPage(1);
  };

  const handleDelete = async (movement: Movement) => {
    if (!window.confirm('¿Seguro que deseas eliminar este movimiento?')) return;
    try {
      await new LocalMovementRepository().delete(movement.id, userId);
      setError('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    }
  };

  useEffect(() => {
    if (!focusId || loading) return;
    const request = `${focusId}:${focusNonce ?? ''}`;
    if (servedFocus.current === request) return;
    const movement = movements.find(item => item.id === focusId);
    if (!movement) {
      const giveUp = setTimeout(() => onFocusHandled?.(), FOCUS_GIVE_UP_MS);
      return () => clearTimeout(giveUp);
    }
    servedFocus.current = request;
    // Show it unfiltered, on the page that holds it.
    setSelection(DEFAULT_SELECTION);
    const position = selectMovements(movements, lookups, DEFAULT_SELECTION).findIndex(item => item.id === focusId);
    setPage(Math.floor(Math.max(position, 0) / MOVEMENT_PAGE_SIZE) + 1);
    if (describeMovement(movement, lookups).editable) setEditing(movement);
    else setRevealId(movement.id);
    onFocusHandled?.();
  }, [focusId, focusNonce, loading, movements, lookups, onFocusHandled]);
  useRevealTarget(revealId ? `movement-${revealId}` : undefined, focusNonce, true, () => setRevealId(undefined));

  const actions = { onEdit: setEditing, onDelete: handleDelete };
  const filtered = isSelectionActive(selection);

  const editDialog = (
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(undefined); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        {editing && (
          <MovementForm
            userId={userId}
            movement={editing}
            onCancel={() => setEditing(undefined)}
            onComplete={() => { setEditing(undefined); onChanged(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  // The desktop panel has its own padding; on mobile the rows sit directly on the page background.
  const pad = desktop ? 'px-5' : '';

  const body = loading ? (
    <div className={cn('flex flex-col gap-3 pb-5', pad)} aria-busy="true">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  ) : movements.length === 0 ? (
    <p className={cn('pb-6 text-body-md text-muted-foreground', pad)}>{emptyMessage(DEFAULT_SELECTION)}</p>
  ) : (
    <>
      <MovementToolbar
        selection={selection}
        onChange={changeSelection}
        counts={counts}
        categories={categories}
        desktop={desktop}
        part={desktop ? 'filters' : 'all'}
        className={cn('pb-4', pad)}
      />
      {error && <p role="alert" className={cn('pb-3 text-body-md text-destructive', pad)}>{error}</p>}
      {selected.length === 0 ? (
        <div className={cn('flex flex-col items-start gap-3 pb-6', pad)}>
          <p className="text-body-md text-muted-foreground">{emptyMessage(selection)}</p>
          {filtered && <Button type="button" variant="outline" onClick={() => changeSelection(DEFAULT_SELECTION)}>Limpiar filtros</Button>}
        </div>
      ) : desktop ? (
        <>
          <MovementTable movements={current.items} lookups={lookups} pendingIds={pendingIds} {...actions} />
          <div className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3', pad)}>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-label-mono-sm text-muted-foreground">
              <span>
                Mostrando {current.items.length} de {selected.length}{' '}
                {filtered
                  ? `${selected.length === 1 ? 'registro filtrado' : 'registros filtrados'} (${movements.length} del mes)`
                  : `${selected.length === 1 ? 'registro' : 'registros'} del mes`}
              </span>
              <span aria-hidden="true" className="h-4 w-px bg-border" />
              <span className="flex items-center gap-1.5">
                Balance neto del ciclo:
                <Money cents={balanceCents} sign="always" tone="auto" size="sm" className="font-semibold" />
              </span>
            </p>
            {current.pageCount > 1 && <Pager page={current.page} pageCount={current.pageCount} onPage={setPage} />}
          </div>
        </>
      ) : (
        <div className={cn('flex flex-col gap-4 pb-5', pad)}>
          {groups.map(group => (
            <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
              <h3 className="font-mono text-label-mono-xs uppercase text-muted-foreground">{group.label}</h3>
              <ul className="flex flex-col gap-2">
                {group.items.map(movement => (
                  <MovementCard key={movement.id} movement={movement} lookups={lookups} {...actions} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );

  return (
    <Panel aria-label="Historial de movimientos" className={cn(desktop ? '' : 'border-0 bg-transparent')} data-testid="history-panel">
      {desktop ? (
        <PanelHeader
          eyebrow="Historial"
          title="Historial detallado de transacciones"
          action={movements.length > 0 && !loading ? (
            <SearchField selection={selection} onChange={changeSelection} className="w-72" />
          ) : undefined}
        />
      ) : (
        <PanelHeader eyebrow="Historial" title="Movimientos del mes" titleAs="h3" className="px-0" />
      )}
      {editDialog}
      <div className="flex flex-col">{body}</div>
    </Panel>
  );
}
