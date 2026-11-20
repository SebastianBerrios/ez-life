'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { InstallmentAdjustmentType, InstallmentLoan, InstallmentPayment, PaymentAccount } from '../../core/domain/models/types';
import { DomainError } from '../../core/domain/errors/DomainError';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { pickPrimaryAccount } from '../../core/use-cases/pickPrimaryAccount';
import { formatShortDate } from '../../core/use-cases/formatMovementWhen';
import { formatInstallmentLoanPhrase } from '../../core/use-cases/formatFinancesPhrases';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import InstallmentLoanForm from './InstallmentLoanForm';

interface Props {
  userId: string;
}

export default function InstallmentLoanList({ userId }: Props) {
  const [loans, setLoans] = useState<InstallmentLoan[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [installmentDrafts, setInstallmentDrafts] = useState<Record<string, string>>({});
  const [installmentAccountDrafts, setInstallmentAccountDrafts] = useState<Record<string, string>>({});
  const [installmentErrors, setInstallmentErrors] = useState<Record<string, string>>({});

  const [showPrincipalFlow, setShowPrincipalFlow] = useState<Record<string, boolean>>({});
  const [principalAmountDrafts, setPrincipalAmountDrafts] = useState<Record<string, string>>({});
  const [principalAccountDrafts, setPrincipalAccountDrafts] = useState<Record<string, string>>({});
  const [adjustmentTypeDrafts, setAdjustmentTypeDrafts] = useState<Record<string, InstallmentAdjustmentType | ''>>({});
  const [resultingValueDrafts, setResultingValueDrafts] = useState<Record<string, string>>({});
  const [principalErrors, setPrincipalErrors] = useState<Record<string, string>>({});
  const [principalSubmitting, setPrincipalSubmitting] = useState<Record<string, boolean>>({});

  const [paymentHistory, setPaymentHistory] = useState<Record<string, InstallmentPayment[]>>({});
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);

  const [editingLoan, setEditingLoan] = useState<InstallmentLoan | null>(null);

  const activeAccounts = accounts.filter(a => !a.archived && !a.deleted_at);
  const primaryAccountId = pickPrimaryAccount(accounts, userId)?.id ?? activeAccounts[0]?.id ?? '';

  const loadLoans = useCallback(async () => {
    try {
      const repo = new LocalInstallmentLoanRepository();
      const [loadedLoans, loadedAccounts] = await Promise.all([
        repo.getAll(userId),
        new LocalPaymentAccountRepository().getAll(userId).catch(() => [] as PaymentAccount[]),
      ]);
      setLoans(loadedLoans);
      setAccounts(loadedAccounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadLoans();
    return onLocalChanges(['installment_loans', 'payment_accounts'], loadLoans);
  }, [loadLoans]);

  const handlePayInstallments = async (loan: InstallmentLoan) => {
    const draft = installmentDrafts[loan.id] ?? '';
    const count = parseInt(draft, 10);
    const selectedAccountId = installmentAccountDrafts[loan.id] || primaryAccountId || undefined;

    try {
      const repo = new LocalInstallmentLoanRepository();
      if (selectedAccountId) {
        await repo.recordInstallmentPayment(loan.id, count, new Date(), selectedAccountId);
      } else {
        await repo.recordInstallmentPayment(loan.id, count, new Date());
      }
      setInstallmentDrafts(prev => ({ ...prev, [loan.id]: '' }));
      setInstallmentErrors(prev => ({ ...prev, [loan.id]: '' }));
      await loadLoans();
    } catch (err) {
      const message = err instanceof DomainError ? err.message : 'No se pudo registrar el pago de cuota(s).';
      setInstallmentErrors(prev => ({ ...prev, [loan.id]: message }));
    }
  };

  const handleConfirmPrincipalPayment = async (loan: InstallmentLoan) => {
    const adjustmentType = adjustmentTypeDrafts[loan.id];

    if (!adjustmentType) {
      setPrincipalErrors(prev => ({ ...prev, [loan.id]: 'Elige si el abono reduce el plazo o la cuota.' }));
      return;
    }

    setPrincipalSubmitting(prev => ({ ...prev, [loan.id]: true }));
    try {
      const amountInCents = parseMoney(principalAmountDrafts[loan.id] ?? '');
      const resultingDraft = resultingValueDrafts[loan.id] ?? '';
      const adjustment = adjustmentType === 'reduce_term'
        ? { type: 'reduce_term' as const, newRemainingInstallments: parseInt(resultingDraft, 10) }
        : { type: 'reduce_installment_amount' as const, newInstallmentAmountCents: parseMoney(resultingDraft) };
      const selectedAccountId = principalAccountDrafts[loan.id] || primaryAccountId || undefined;

      const repo = new LocalInstallmentLoanRepository();
      if (selectedAccountId) {
        await repo.recordPrincipalPayment(loan.id, amountInCents, new Date(), adjustment, selectedAccountId);
      } else {
        await repo.recordPrincipalPayment(loan.id, amountInCents, new Date(), adjustment);
      }
      setPrincipalAmountDrafts(prev => ({ ...prev, [loan.id]: '' }));
      setAdjustmentTypeDrafts(prev => ({ ...prev, [loan.id]: '' }));
      setResultingValueDrafts(prev => ({ ...prev, [loan.id]: '' }));
      setPrincipalErrors(prev => ({ ...prev, [loan.id]: '' }));
      setShowPrincipalFlow(prev => ({ ...prev, [loan.id]: false }));
      await loadLoans();
    } catch (err) {
      const message = err instanceof DomainError ? err.message : 'No se pudo registrar el abono a capital.';
      setPrincipalErrors(prev => ({ ...prev, [loan.id]: message }));
    } finally {
      setPrincipalSubmitting(prev => ({ ...prev, [loan.id]: false }));
    }
  };

  const toggleHistory = async (loan: InstallmentLoan) => {
    if (historyOpenFor === loan.id) {
      setHistoryOpenFor(null);
      return;
    }
    const repo = new LocalInstallmentLoanRepository();
    setPaymentHistory(prev => ({ ...prev, [loan.id]: prev[loan.id] ?? [] }));
    const payments = await repo.getPayments(loan.id);
    setPaymentHistory(prev => ({ ...prev, [loan.id]: payments }));
    setHistoryOpenFor(loan.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este préstamo?')) return;
    try {
      const repo = new LocalInstallmentLoanRepository();
      await repo.delete(id);
      await loadLoans();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-card" />
      </div>
    );
  }

  if (loans.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="installment-loans">
      <p className="px-1 text-xs font-medium text-muted-foreground">Préstamos en cuotas</p>
      {loans.map(loan => {
        const isSettled = loan.status === 'settled';
        const paid = Math.max(0, loan.installment_count - loan.remaining_installments);
        const paidPercent = loan.installment_count > 0 ? Math.round((paid * 100) / loan.installment_count) : 0;
        const phrase = formatInstallmentLoanPhrase(loan);

        return (
          <Panel key={loan.id} className="gap-4 p-5" data-testid={`installment-loan-${loan.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
                  <Landmark className="size-5" />
                </span>
                <div className="min-w-0">
                  <h4 className="flex flex-wrap items-center gap-2 font-fredoka text-headline-sm text-foreground">
                    {loan.lender_name}
                    <Badge variant={isSettled ? 'positive' : 'primary'}>{isSettled ? 'Saldado' : 'Activo'}</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground">{phrase}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditingLoan(loan)}>
                  Corregir términos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(loan.id)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Borrar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Cuota actual: <Money cents={loan.installment_amount} size="sm" className="font-semibold text-foreground" />
              </span>
              <span>
                Original: <Money cents={loan.amount} size="sm" className="text-foreground" />
                {loan.interest_rate !== undefined && ` · ${loan.interest_rate}%`}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>{loan.remaining_installments} de {loan.installment_count} cuotas restantes</span>
                <span>{paidPercent}%</span>
              </div>
              <Progress value={paidPercent} aria-label={`Avance de cuotas de ${loan.lender_name}`} />
            </div>

            <div className="flex">
              <Button variant="link" size="sm" className="h-auto min-h-11 p-0" onClick={() => toggleHistory(loan)}>
                {historyOpenFor === loan.id ? 'Ocultar historial' : 'Ver historial de pagos'}
              </Button>
            </div>

            {historyOpenFor === loan.id && (
              <ul className="flex flex-col gap-1.5 rounded-2xl bg-surface-2/60 p-3">
                {(paymentHistory[loan.id] ?? []).length === 0 && (
                  <li className="text-body-sm text-muted-foreground">Todavía no hay pagos registrados.</li>
                )}
                {(paymentHistory[loan.id] ?? []).map(payment => (
                  <li key={payment.id} className="flex flex-wrap items-baseline gap-x-2 text-body-sm text-muted-foreground">
                    <span className="text-xs">{formatShortDate(new Date(payment.date))}</span>
                    <Money cents={payment.amount} size="sm" className="text-foreground" />
                    <span>· {payment.kind === 'installment' ? 'Cuota' : 'Abono a capital'}</span>
                  </li>
                ))}
              </ul>
            )}

            {!isSettled && !loan.distribution_category_id && (
              <p className="text-body-sm text-muted-foreground">
                Asigna una categoría de distribución (50/30/20) desde &quot;Corregir términos&quot; antes de registrar un pago — la necesita para poder generar el movimiento de gasto correspondiente.
              </p>
            )}

            {!isSettled && loan.distribution_category_id && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h5 className="text-xs font-medium text-muted-foreground">Pagar cuota(s)</h5>
                  {activeAccounts.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`installment-account-${loan.id}`}>Cuenta de origen</Label>
                      <select
                        id={`installment-account-${loan.id}`}
                        value={installmentAccountDrafts[loan.id] || primaryAccountId}
                        onChange={(e) => setInstallmentAccountDrafts(prev => ({ ...prev, [loan.id]: e.target.value }))}
                        className="flex h-11 w-full rounded-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:shadow-focus"
                      >
                        {activeAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <div className="flex flex-1 flex-col gap-1">
                      <Label htmlFor={`installments-${loan.id}`}>Cuotas a pagar</Label>
                      <Input
                        id={`installments-${loan.id}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={installmentDrafts[loan.id] ?? ''}
                        onChange={(e) => setInstallmentDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                      />
                    </div>
                    <Button onClick={() => handlePayInstallments(loan)}>
                      Pagar cuota(s)
                    </Button>
                  </div>
                  {installmentErrors[loan.id] && <p className="text-body-sm text-destructive">{installmentErrors[loan.id]}</p>}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <h5 className="text-xs font-medium text-muted-foreground">Registrar abono a capital</h5>

                  {!showPrincipalFlow[loan.id] && (
                    <Button variant="outline" className="w-full" onClick={() => setShowPrincipalFlow(prev => ({ ...prev, [loan.id]: true }))}>
                      Registrar abono a capital
                    </Button>
                  )}

                  {showPrincipalFlow[loan.id] && (
                    <div className="flex flex-col gap-3 rounded-2xl bg-surface-2/60 p-4">
                      {activeAccounts.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`principal-account-${loan.id}`}>Cuenta de origen del abono</Label>
                          <select
                            id={`principal-account-${loan.id}`}
                            value={principalAccountDrafts[loan.id] || primaryAccountId}
                            onChange={(e) => setPrincipalAccountDrafts(prev => ({ ...prev, [loan.id]: e.target.value }))}
                            className="flex h-11 w-full rounded-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:shadow-focus"
                          >
                            {activeAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`principal-amount-${loan.id}`}>Monto del abono</Label>
                        <Input
                          id={`principal-amount-${loan.id}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={principalAmountDrafts[loan.id] ?? ''}
                          onChange={(e) => setPrincipalAmountDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`adjustment-${loan.id}`}>¿Este abono reduce el plazo o la cuota?</Label>
                        <Select
                          value={adjustmentTypeDrafts[loan.id] ?? ''}
                          onValueChange={(val) => setAdjustmentTypeDrafts(prev => ({ ...prev, [loan.id]: val as InstallmentAdjustmentType }))}
                        >
                          <SelectTrigger id={`adjustment-${loan.id}`} className="w-full">
                            <SelectValue placeholder="Elegir..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reduce_term">Reducir plazo (menos cuotas)</SelectItem>
                            <SelectItem value="reduce_installment_amount">Reducir cuota (misma cantidad de cuotas)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {adjustmentTypeDrafts[loan.id] === 'reduce_term' && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`resulting-${loan.id}`}>Nuevo número de cuotas restantes</Label>
                          <Input
                            id={`resulting-${loan.id}`}
                            type="text"
                            inputMode="numeric"
                            value={resultingValueDrafts[loan.id] ?? ''}
                            onChange={(e) => setResultingValueDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                          />
                        </div>
                      )}
                      {adjustmentTypeDrafts[loan.id] === 'reduce_installment_amount' && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`resulting-${loan.id}`}>Nuevo monto de cuota</Label>
                          <Input
                            id={`resulting-${loan.id}`}
                            type="text"
                            inputMode="decimal"
                            value={resultingValueDrafts[loan.id] ?? ''}
                            onChange={(e) => setResultingValueDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                          />
                        </div>
                      )}

                      {principalErrors[loan.id] && <p className="text-body-sm text-destructive">{principalErrors[loan.id]}</p>}

                      <Button
                        className="w-full"
                        disabled={Boolean(principalSubmitting[loan.id])}
                        onClick={() => handleConfirmPrincipalPayment(loan)}
                      >
                        Confirmar abono
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isSettled && (
              <p className="text-body-md font-medium text-success">Pagado/Saldado ✓</p>
            )}
          </Panel>
        );
      })}

      {editingLoan && (
        <Sheet open onOpenChange={(open) => !open && setEditingLoan(null)}>
          <SheetContent>
            <InstallmentLoanForm
              userId={userId}
              existing={editingLoan}
              onComplete={() => { setEditingLoan(null); loadLoans(); }}
              onCancel={() => setEditingLoan(null)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
