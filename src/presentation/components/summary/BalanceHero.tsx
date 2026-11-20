'use client';

import React from 'react';
import { Panel } from '@/components/ui/panel';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { MonthBalance } from '../../../core/domain/models/types';
import { HideAmountsToggle, SUMMARY_MASKED_AMOUNT } from './HideAmountsToggle';

interface Props {
  balance: MonthBalance;
  hidden: boolean;
  onToggleHidden: () => void;
}

export default function BalanceHero({ balance, hidden, onToggleHidden }: Props) {
  const money = (cents: number) => (hidden ? SUMMARY_MASKED_AMOUNT : formatMoney(cents));

  const extraLines: string[] = [];
  if (balance.ahorraste > 0) extraLines.push(`Ahorraste ${money(balance.ahorraste)}`);
  if (balance.sacaste > 0) extraLines.push(`Sacaste ${money(balance.sacaste)} de tus ahorros`);
  if (balance.ajuste !== 0) extraLines.push(`Ajuste de saldo ${money(balance.ajuste)}`);

  return (
    <Panel
      aria-label="Balance del mes"
      className="gap-3 p-6"
      data-tour="balance"
      data-testid="balance-hero"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">Balance del mes</span>
        <HideAmountsToggle hidden={hidden} onToggle={onToggleHidden} className="-my-2 -mr-2" />
      </div>

      <div aria-live="polite" data-testid="balance-amount" className="font-fredoka text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {money(balance.balance)}
      </div>

      <p className="text-sm text-muted-foreground" data-testid="balance-flows">
        {`Entró ${money(balance.entro)} · Salió ${money(balance.salio)}`}
      </p>

      {extraLines.length > 0 && (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground" data-testid="balance-extras">
          {extraLines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      )}

      {balance.balance < 0 && (
        <p className="text-sm text-muted-foreground" data-testid="balance-negative-note">
          Gastaste más de lo que tenías este mes
        </p>
      )}
    </Panel>
  );
}
