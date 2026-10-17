'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import type { DashboardView } from '../../hooks/useDashboardData';

interface Props {
  view: DashboardView;
  desktop: boolean;
  /** Opens Finanzas on its loans tab. */
  onOpenLoans: () => void;
}

/**
 * "Préstamos activos": informal debts still pending (remaining = amount - settled) and the next
 * installment of every active installment loan. No due dates or outstanding principal are shown:
 * the model does not carry them and the app never derives an amortization table.
 */
export default function LoansCard({ view, desktop, onOpenLoans }: Props) {
  const { activeDebts, activeLoans } = view;
  const empty = activeDebts.length === 0 && activeLoans.length === 0;

  return (
    <Panel aria-label="Préstamos activos" data-testid="loans-card">
      <div className="flex flex-col gap-0.5 px-5 pt-5 pb-3">
        {desktop && <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Pasivo financiero</span>}
        <h3 className="flex items-center gap-2 text-headline-md text-foreground">
          {!desktop && <Landmark className="size-5 text-primary" aria-hidden="true" />}
          Préstamos activos
        </h3>
      </div>
      <PanelBody className="flex flex-col gap-3">
        {empty ? (
          <p className="text-body-md text-muted-foreground">No tenés deudas activas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeLoans.map(({ loan, next }) => (
              <li key={loan.id} className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-3 py-2.5" data-testid={`loan-${loan.id}`}>
                <div className="min-w-0">
                  <p className="truncate text-body-md font-medium text-foreground">{loan.lender_name}</p>
                  <p className="font-mono text-label-mono-xs text-muted-foreground">
                    Cuota {String(next.number).padStart(2, '0')}/{String(next.total).padStart(2, '0')} · {next.remaining} por pagar
                  </p>
                </div>
                <Money cents={next.amountCents} size="sm" className="shrink-0 font-semibold" />
              </li>
            ))}
            {activeDebts.map(debt => {
              const remaining = debt.amount - debt.settled_amount;
              const directionLabel = debt.direction === 'lent' ? 'Le prestaste a' : 'Te prestó';
              return (
                <li key={debt.id} className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-3 py-2.5" data-testid={`debt-${debt.id}`}>
                  <span className="min-w-0 truncate text-body-md text-foreground">
                    {directionLabel} {debt.counterparty_name}
                  </span>
                  <Money cents={remaining} size="sm" className="shrink-0 font-semibold text-primary" />
                </li>
              );
            })}
          </ul>
        )}
        {!empty && (
          <Button variant={desktop && activeLoans.length > 0 ? 'default' : 'outline'} onClick={onOpenLoans}>
            {desktop && activeLoans.length > 0 ? 'Registrar pago' : 'Ver préstamos'}
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
}
