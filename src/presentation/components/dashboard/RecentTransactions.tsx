'use client';

import React from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/money';
import { formatMovementWhen } from '../../../core/use-cases/formatMovementWhen';
import type { RecentMovement } from '../../../core/use-cases/selectRecentMovements';
import type { DashboardView } from '../../hooks/useDashboardData';

interface Props {
  view: DashboardView;
  onSeeAll: () => void;
}

const HEAD_CLASS = 'px-2 py-2 text-left font-mono text-label-mono-xs font-normal uppercase text-muted-foreground';

function concept(m: RecentMovement, view: DashboardView): string {
  if (m.isTransfer) return m.description?.trim() || 'Transferencia';
  return m.description?.trim() || (m.expense_category_id && view.categoryName[m.expense_category_id]) || (m.type === 'INCOME' ? 'Ingreso' : 'Gasto');
}

function Amount({ movement }: { movement: RecentMovement }) {
  if (movement.isTransfer) return <Money cents={movement.amount} sign="never" size="sm" className="text-muted-foreground" />;
  if (movement.type === 'INCOME') return <Money cents={movement.amount} sign="always" tone="income" size="sm" />;
  return <Money cents={-movement.amount} sign="auto" tone="expense" size="sm" />;
}

/** Desktop "Transacciones recientes": the latest movements; transfers are shown neutral and never counted as income/expense. */
export default function RecentTransactions({ view, onSeeAll }: Props) {
  return (
    <Panel aria-label="Transacciones recientes" data-testid="recent-transactions">
      <PanelHeader
        eyebrow="Libro mayor"
        title="Transacciones recientes"
        action={
          <button
            type="button"
            onClick={onSeeAll}
            className="flex min-h-11 items-center rounded-lg px-3 font-mono text-label-mono-sm text-primary outline-none hover:bg-surface-3 focus-visible:shadow-focus"
          >
            Ver todo
          </button>
        }
      />
      <PanelBody className="overflow-x-auto">
        {view.recent.length === 0 ? (
          <p className="text-body-md text-muted-foreground">Sin movimientos todavía.</p>
        ) : (
          <table className="w-full min-w-[34rem] border-collapse text-body-md">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={HEAD_CLASS}>Concepto</th>
                <th scope="col" className={HEAD_CLASS}>Categoría</th>
                <th scope="col" className={HEAD_CLASS}>Regla</th>
                <th scope="col" className={HEAD_CLASS}>Cuenta</th>
                <th scope="col" className={HEAD_CLASS}>Fecha</th>
                <th scope="col" className={`${HEAD_CLASS} text-right`}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {view.recent.map(m => {
                const bucket = m.distribution_category_id ? view.bucketName[m.distribution_category_id] : undefined;
                const category = m.expense_category_id ? view.categoryName[m.expense_category_id] : undefined;
                const account = m.account_id ? view.accountName[m.account_id] : undefined;
                const toAccount = m.to_account_id ? view.accountName[m.to_account_id] : undefined;
                return (
                  <tr key={m.id} className="border-b border-border last:border-b-0" data-testid={`recent-${m.id}`} data-kind={m.isTransfer ? 'transfer' : m.type.toLowerCase()}>
                    <td className="max-w-[12rem] truncate px-2 py-3 font-medium text-foreground">{concept(m, view)}</td>
                    <td className="px-2 py-3 text-muted-foreground">{m.isTransfer ? '—' : category ?? '—'}</td>
                    <td className="px-2 py-3">
                      {m.isTransfer ? <span className="text-muted-foreground">—</span> : m.type === 'INCOME' ? <Badge variant="positive">Ingreso</Badge> : bucket ? <Badge>{bucket}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={m.isTransfer ? 'px-2 py-3 text-muted-foreground' : 'whitespace-nowrap px-2 py-3 text-muted-foreground'}>
                      {m.isTransfer ? `${account ?? '—'} → ${toAccount ?? '—'}` : account ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 font-mono text-label-mono-sm text-muted-foreground">{formatMovementWhen(m.date, view.today)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right font-mono"><Amount movement={m} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PanelBody>
    </Panel>
  );
}
