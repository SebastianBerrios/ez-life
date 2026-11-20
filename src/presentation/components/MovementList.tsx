'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Receipt } from 'lucide-react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import type { Movement } from '../../core/domain/models/types';
import { describeMovement, type MovementLookups } from '../../core/use-cases/describeMovement';
import { useRevealTarget } from '../hooks/useRevealTarget';
import {
  categoryOptions, countByFilter, DEFAULT_SELECTION, isSelectionActive, selectMovements, type MovementSelection,
} from '../../core/use-cases/filterMovements';
import { groupByDay } from '../../core/use-cases/groupMovementsByDay';
import { formatMoney } from '../../core/use-cases/formatMoney';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import MovementForm from './MovementForm';
import MovementToolbar from './finances/MovementToolbar';
import { MovementCard } from './finances/MovementRows';

interface Props {
  userId: string;
  /** Movements of the selected month (the screen reads them through `useFinancesData`). */
  movements: Movement[];
  lookups: MovementLookups;
  /** Moment "Hoy"/"Ayer" are relative to. */
  today: Date;
  loading: boolean;
  /** Called after an edit or delete so the screen can refresh its data. */
  onChanged: () => void;
  /** Opens the quick record sheet from the empty state. */
  onNewMovement?: () => void;
  /** Movement a ⌘K selection wants shown: editable ones open their edit sheet, the rest are revealed in the list. */
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

/**
 * Movement history of the selected month: filtered net balance hero, filters/search,
 * and day-grouped warm cards across all viewports (no rigid table).
 */
export default function MovementList({
  userId, movements, lookups, today, loading, onChanged, onNewMovement, focusId, focusNonce, onFocusHandled,
}: Props) {
  const [selection, setSelection] = useState<MovementSelection>(DEFAULT_SELECTION);
  const [editing, setEditing] = useState<Movement | undefined>();
  const [error, setError] = useState('');
  const [revealId, setRevealId] = useState<string | undefined>();
  const servedFocus = useRef<string | null>(null);

  const counts = useMemo(() => countByFilter(movements), [movements]);
  const categories = useMemo(() => categoryOptions(movements, lookups), [movements, lookups]);
  const selected = useMemo(() => selectMovements(movements, lookups, selection), [movements, lookups, selection]);
  const groups = useMemo(() => groupByDay(selected, today), [selected, today]);

  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const m of selected) {
      if (m.deleted_at || m.type === 'TRANSFER') continue;
      if (m.type === 'INCOME') income += m.amount;
      else if (m.type === 'EXPENSE') expense += m.amount;
    }
    return { income, expense, net: income - expense };
  }, [selected]);

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
    setSelection(DEFAULT_SELECTION);
    if (describeMovement(movement, lookups).editable) setEditing(movement);
    else setRevealId(movement.id);
    onFocusHandled?.();
  }, [focusId, focusNonce, loading, movements, lookups, onFocusHandled]);

  useRevealTarget(revealId ? `movement-${revealId}` : undefined, focusNonce, true, () => setRevealId(undefined));

  const actions = { onEdit: setEditing, onDelete: handleDelete };
  const filtered = isSelectionActive(selection);

  const editSheet = (
    <Sheet open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(undefined); }}>
      <SheetContent>
        {editing && (
          <MovementForm
            userId={userId}
            movement={editing}
            onCancel={() => setEditing(undefined)}
            onComplete={() => { setEditing(undefined); onChanged(); }}
          />
        )}
      </SheetContent>
    </Sheet>
  );

  if (loading) {
    return (
      <section aria-label="Historial de movimientos" data-testid="history-panel" className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </section>
    );
  }

  return (
    <section aria-label="Historial de movimientos" data-testid="history-panel" className="flex flex-col gap-4">
      {editSheet}

      <Panel data-testid="movements-hero" className="gap-1.5 p-5">
        <p className="text-sm font-medium text-muted-foreground">
          {filtered ? 'Balance del filtro actual' : 'Balance del periodo'}
        </p>
        <Money cents={filteredTotals.net} sign="always" tone="auto" size="lg" className="text-display-hero-mobile md:text-display-hero" />
        <p className="text-sm text-muted-foreground">
          Ingresos {formatMoney(filteredTotals.income)} · Egresos {formatMoney(filteredTotals.expense)}
        </p>
      </Panel>

      {movements.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title="No hay movimientos en este mes"
          description="Registra tus ingresos o gastos del día para empezar a ver tu balance."
          actionLabel={onNewMovement ? 'Registrar movimiento' : undefined}
          onAction={onNewMovement}
        />
      ) : (
        <>
          <MovementToolbar
            selection={selection}
            onChange={setSelection}
            counts={counts}
            categories={categories}
            desktop={false}
          />
          {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}
          {selected.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-6" />}
              title={emptyMessage(selection)}
              actionLabel={filtered ? 'Limpiar filtros' : undefined}
              onAction={filtered ? () => setSelection(DEFAULT_SELECTION) : undefined}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map(group => (
                <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
                  <h3 className="px-1 text-xs font-medium text-muted-foreground">{group.label}</h3>
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
      )}
    </section>
  );
}
