'use client';

import React from 'react';
import { CreditCard } from 'lucide-react';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import InstallmentLoanList from '../InstallmentLoanList';
import DebtList from '../DebtList';

interface Props {
  userId: string;
  desktop: boolean;
  /** Installment loans not yet settled plus informal debts with a pending balance. */
  activeCount: number;
  installmentRefreshKey: number;
  debtRefreshKey: number;
  onNewInstallmentLoan: () => void;
  onNewDebt: () => void;
}

/** Préstamos: installment loans and informal debts, each list keeping its own payment flows. */
export default function LoansSection({
  userId, desktop, activeCount, installmentRefreshKey, debtRefreshKey, onNewInstallmentLoan, onNewDebt,
}: Props) {
  return (
    <Panel aria-label="Préstamos" data-testid="loans-section">
      <PanelHeader
        eyebrow={desktop ? 'Pasivo financiero' : undefined}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <CreditCard className="size-5 shrink-0 text-expense" aria-hidden="true" />
            {desktop ? 'Préstamos y créditos activos' : 'Préstamos activos'}
            {activeCount > 0 && <Badge variant="negative">{activeCount} {activeCount === 1 ? 'Activo' : 'Activos'}</Badge>}
          </span>
        }
        titleAs="h3"
        className="flex-wrap"
        action={
          <>
            <Button size="sm" variant="outline" className="min-h-11" onClick={onNewInstallmentLoan}>
              + Con cuotas
            </Button>
            <Button size="sm" variant="outline" className="min-h-11" onClick={onNewDebt}>
              + Nuevo préstamo
            </Button>
          </>
        }
      />
      <PanelBody className="flex flex-col gap-4">
        <InstallmentLoanList key={`installments-${installmentRefreshKey}`} userId={userId} />
        <DebtList key={`debts-${debtRefreshKey}`} userId={userId} />
      </PanelBody>
    </Panel>
  );
}
