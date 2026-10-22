'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Pencil, Plus } from 'lucide-react';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { calculateAccountBalances } from '../../core/use-cases/calculateAccountBalances';
import { canArchiveAccount, usableAccounts } from '../../core/use-cases/transferAccounts';
import { Movement, PaymentAccount } from '../../core/domain/models/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import PaymentAccountForm, { ACCOUNT_KIND_LABELS } from './PaymentAccountForm';

type FormState = { open: boolean; existing?: PaymentAccount };

/**
 * Settings → "Cuentas de pago": list, create, rename / edit the opening balance and archive.
 * Accounts are never deleted from here: one with movements would orphan them, so it is archived.
 */
export default function PaymentAccountSettings({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [form, setForm] = useState<FormState>({ open: false });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedMovements] = await Promise.all([
        new LocalPaymentAccountRepository().getAll(userId),
        new LocalMovementRepository().getAll(userId),
      ]);
      setAccounts(loadedAccounts);
      setMovements(loadedMovements);
    } catch (err) {
      console.error(err);
      setAccounts(current => current ?? []);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    return onLocalChanges(['payment_accounts', 'movements'], () => { void load(); });
  }, [load]);

  const balances = useMemo(() => calculateAccountBalances(accounts ?? [], movements), [accounts, movements]);
  const movementCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const movement of movements) {
      for (const id of new Set([movement.account_id, movement.to_account_id])) {
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    return counts;
  }, [movements]);

  if (accounts === null) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  const visible = usableAccounts(accounts);

  const archive = async (account: PaymentAccount) => {
    setError(null);
    try {
      await new LocalPaymentAccountRepository().archive(account.id);
      setConfirmingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar la cuenta.');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-body-md text-muted-foreground">
        Tus cuentas y su saldo actual (saldo inicial + movimientos). Una cuenta con movimientos no se elimina: se archiva para conservar tu historial.
      </p>

      {visible.length === 0 ? (
        <p className="text-body-md text-muted-foreground">Todavía no tienes cuentas.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {visible.map(account => {
            const count = movementCounts[account.id] ?? 0;
            const archivable = canArchiveAccount(accounts, account.id);
            return (
              <li key={account.id} data-testid={`account-${account.id}`} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 truncate text-body-md font-medium text-foreground">{account.name}</span>
                  <Badge>{ACCOUNT_KIND_LABELS[account.kind]}</Badge>
                  <Money cents={balances[account.id] ?? 0} size="sm" aria-label={`Saldo de ${account.name}`} />
                </div>
                {count > 0 && (
                  <p className="text-body-sm text-muted-foreground">
                    {count} {count === 1 ? 'movimiento' : 'movimientos'} · se archiva, no se elimina.
                  </p>
                )}
                {confirmingId === account.id ? (
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirmar archivar ${account.name}`}>
                    <span className="text-body-md text-foreground">¿Archivar esta cuenta?</span>
                    <Button size="sm" variant="destructive" onClick={() => void archive(account)}>Sí, archivar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" aria-label={`Editar ${account.name}`} onClick={() => setForm({ open: true, existing: account })}>
                      <Pencil />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Archivar ${account.name}`}
                      disabled={!archivable}
                      title={archivable ? undefined : 'Necesitas al menos una cuenta activa.'}
                      onClick={() => setConfirmingId(account.id)}
                    >
                      <Archive />
                      Archivar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}

      <Button variant="outline" className="w-full" onClick={() => setForm({ open: true })}>
        <Plus />
        Nueva cuenta
      </Button>

      <Sheet open={form.open} onOpenChange={open => { if (!open) setForm({ open: false }); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{form.existing ? 'Editar cuenta' : 'Nueva cuenta'}</SheetTitle>
            <SheetDescription className="sr-only">Nombre, tipo y saldo inicial de la cuenta de pago.</SheetDescription>
          </SheetHeader>
          <PaymentAccountForm
            userId={userId}
            existing={form.existing}
            onCancel={() => setForm({ open: false })}
            onSaved={() => { setForm({ open: false }); void load(); }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
