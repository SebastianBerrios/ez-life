'use client';

import React from 'react';
import { CreditCard } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import type { FinancesHeroSummary } from '../../../core/use-cases/buildFinancesHero';
import { formatCreditCardPhrase } from '../../../core/use-cases/formatFinancesPhrases';
import InstallmentLoanList from '../InstallmentLoanList';
import DebtList from '../DebtList';

interface Props {
  userId: string;
  hero: FinancesHeroSummary;
  hasLoansOrDebts: boolean;
  installmentRefreshKey: number;
  debtRefreshKey: number;
  onNewInstallmentLoan: () => void;
  onNewDebt: () => void;
  onAddCreditLimit?: (accountId: string) => void;
}

/** Préstamos: single hero total owed, separate "Te deben" block, credit cards, installment loans and informal debts. */
export default function LoansSection({
  userId,
  hero,
  hasLoansOrDebts,
  installmentRefreshKey,
  debtRefreshKey,
  onNewInstallmentLoan,
  onNewDebt,
  onAddCreditLimit,
}: Props) {
  const isCompletelyEmpty = !hasLoansOrDebts && hero.creditCards.length === 0;

  return (
    <section aria-label="Préstamos" data-testid="loans-section" className="flex flex-col gap-4">
      <Panel data-testid="loans-hero" className="gap-3 p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Total que debes</p>
          <Money cents={hero.totalOwedCents} size="lg" className="text-display-hero-mobile md:text-display-hero" />
          <p className="text-sm text-muted-foreground">
            Suma de tus préstamos en cuotas, tarjetas de crédito y deudas por pagar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onNewInstallmentLoan}>
            + Con cuotas
          </Button>
          <Button size="sm" variant="outline" onClick={onNewDebt}>
            + Nuevo préstamo
          </Button>
        </div>
      </Panel>

      {hero.totalOwedToMeCents > 0 && (
        <Panel data-testid="owed-to-me-card" className="flex-row items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Te deben</p>
            <p className="text-xs text-muted-foreground">Préstamos informales por cobrar</p>
          </div>
          <Money cents={hero.totalOwedToMeCents} size="md" tone="income" className="font-semibold" />
        </Panel>
      )}

      {hero.creditCards.length > 0 && (
        <div className="flex flex-col gap-2.5" data-testid="credit-cards-section">
          <p className="px-1 text-xs font-medium text-muted-foreground">Tarjetas de crédito</p>
          {hero.creditCards.map((card) => (
            <Panel key={card.accountId} className="gap-2 p-5" data-testid={`credit-card-${card.accountId}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
                    <CreditCard className="size-4" />
                  </span>
                  <h4 className="font-fredoka text-headline-sm text-foreground">{card.name}</h4>
                </div>
                {card.creditLimitCents === undefined && onAddCreditLimit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddCreditLimit(card.accountId)}
                  >
                    Agregar línea de crédito
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{formatCreditCardPhrase(card)}</p>
            </Panel>
          ))}
        </div>
      )}

      {isCompletelyEmpty ? (
        <EmptyState
          icon={<CreditCard className="size-6" />}
          title="Aún no tienes préstamos"
          description="Registra un préstamo en cuotas o una deuda informal para seguir tu avance."
          actionLabel="Agregar préstamo"
          onAction={onNewInstallmentLoan}
          secondaryActionLabel="Deuda informal"
          onSecondaryAction={onNewDebt}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <InstallmentLoanList key={`installments-${installmentRefreshKey}`} userId={userId} />
          <DebtList key={`debts-${debtRefreshKey}`} userId={userId} hideEmpty />
        </div>
      )}
    </section>
  );
}
