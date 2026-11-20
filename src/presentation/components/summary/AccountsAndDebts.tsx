'use client';

import React from 'react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { SummaryAccountItem, SummaryDebts } from '../../hooks/useSummaryData';
import { SUMMARY_MASKED_AMOUNT } from './HideAmountsToggle';

const ACCOUNT_KIND_LABELS: Record<SummaryAccountItem['kind'], string> = {
  debit: 'Débito',
  cash: 'Efectivo',
  savings: 'Ahorro',
};

interface Props {
  accounts: SummaryAccountItem[];
  debts: SummaryDebts;
  hidden?: boolean;
  onAddCreditLimit?: (accountId: string) => void;
}

/**
 * Section 3 of the minimalist Summary: "Cuentas" and "Deudas" (spec 013 FR-034, FR-035).
 * Stacked on mobile, side-by-side on desktop (`md:grid-cols-2`). Pure presentation.
 */
export default function AccountsAndDebts({ accounts, debts, hidden = false, onAddCreditLimit }: Props) {
  const money = (cents: number) => (hidden ? SUMMARY_MASKED_AMOUNT : formatMoney(cents));
  const hasDebts = debts.cards.length > 0 || debts.loans.length > 0 || debts.informalDebts.length > 0;

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      data-tour="accounts"
      data-testid="accounts-and-debts"
    >
      <Panel aria-label="Cuentas" className="gap-3 p-5" data-testid="summary-accounts">
        <h2 className="font-fredoka text-lg font-semibold text-foreground">Cuentas</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tienes cuentas registradas.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map(account => (
              <li
                key={account.id}
                data-testid={`summary-account-${account.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
                  <p className="text-xs text-muted-foreground">{ACCOUNT_KIND_LABELS[account.kind]}</p>
                </div>
                <span className="shrink-0 font-fredoka text-base font-semibold text-foreground">
                  {money(account.balanceCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel aria-label="Deudas" className="gap-3 p-5" data-testid="summary-debts">
        <h2 className="font-fredoka text-lg font-semibold text-foreground">Deudas</h2>
        {!hasDebts ? (
          <p className="text-sm text-muted-foreground">
            No tienes tarjetas ni préstamos. Si los tienes, agrégalos para ver cuánto debes.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {debts.cards.map(card => {
              const paySuffix = card.paymentDay !== undefined ? ` · Pagas el ${card.paymentDay}` : '';
              return (
                <li
                  key={card.accountId}
                  data-testid={`summary-card-${card.accountId}`}
                  className="space-y-2 rounded-2xl bg-surface-2/60 px-3 py-2.5"
                >
                  <p className="truncate text-sm font-medium text-foreground">{card.name}</p>
                  {card.creditLimit !== undefined ? (
                    <p className="text-sm text-muted-foreground">
                      {`Usaste ${money(card.owed)} de ${money(card.creditLimit)}${paySuffix}`}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">{`Debes ${money(card.owed)}${paySuffix}`}</p>
                      {onAddCreditLimit && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-h-11"
                          onClick={() => onAddCreditLimit(card.accountId)}
                        >
                          Agregar línea de crédito
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}

            {debts.loans.map(loan => (
              <li
                key={loan.id}
                data-testid={`summary-loan-${loan.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{loan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {`Próxima cuota ${money(loan.nextInstallment.amountCents)}${loan.paymentDay !== undefined ? ` · día ${loan.paymentDay}` : ''}`}
                  </p>
                </div>
                <span className="shrink-0 font-fredoka text-base font-semibold text-foreground">
                  {money(loan.remainingBalanceCents)}
                </span>
              </li>
            ))}

            {debts.informalDebts.map(debt => (
              <li
                key={debt.id}
                data-testid={`summary-informal-debt-${debt.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3 py-2.5"
              >
                <p className="min-w-0 truncate text-sm font-medium text-foreground">{debt.name}</p>
                <span className="shrink-0 font-fredoka text-base font-semibold text-foreground">
                  {`Debes ${money(debt.remainingBalanceCents)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
