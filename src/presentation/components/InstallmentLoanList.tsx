'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { InstallmentAdjustmentType, InstallmentLoan, InstallmentPayment } from '../../core/domain/models/types';
import { DomainError } from '../../core/domain/errors/DomainError';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { formatShortDate } from '../../core/use-cases/formatMovementWhen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import InstallmentLoanForm from './InstallmentLoanForm';
import { FORM_DIALOG_CONTENT_CLASS } from './dialogChrome';

interface Props {
  userId: string;
}

const EYEBROW = 'font-mono text-label-mono-xs uppercase text-muted-foreground';

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className={EYEBROW}>{label}</dt>
      <dd className="text-body-md text-foreground">{children}</dd>
    </div>
  );
}

export default function InstallmentLoanList({ userId }: Props) {
  const [loans, setLoans] = useState<InstallmentLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const [installmentDrafts, setInstallmentDrafts] = useState<Record<string, string>>({});
  const [installmentErrors, setInstallmentErrors] = useState<Record<string, string>>({});

  const [showPrincipalFlow, setShowPrincipalFlow] = useState<Record<string, boolean>>({});
  const [principalAmountDrafts, setPrincipalAmountDrafts] = useState<Record<string, string>>({});
  const [adjustmentTypeDrafts, setAdjustmentTypeDrafts] = useState<Record<string, InstallmentAdjustmentType | ''>>({});
  const [resultingValueDrafts, setResultingValueDrafts] = useState<Record<string, string>>({});
  const [principalErrors, setPrincipalErrors] = useState<Record<string, string>>({});
  // FR-014: disables "Confirmar abono" while the payment is in flight, to
  // prevent an accidental double-submit from creating two payments/Movements.
  const [principalSubmitting, setPrincipalSubmitting] = useState<Record<string, boolean>>({});

  const [paymentHistory, setPaymentHistory] = useState<Record<string, InstallmentPayment[]>>({});
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);

  const [editingLoan, setEditingLoan] = useState<InstallmentLoan | null>(null);

  const loadLoans = useCallback(async () => {
    try {
      const repo = new LocalInstallmentLoanRepository();
      setLoans(await repo.getAll(userId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadLoans();
    // A loan changed from another tab or by a sync pull must show up without remounting.
    return onLocalChanges(['installment_loans'], loadLoans);
  }, [loadLoans]);

  const handlePayInstallments = async (loan: InstallmentLoan) => {
    const draft = installmentDrafts[loan.id] ?? '';
    const count = parseInt(draft, 10);

    try {
      const repo = new LocalInstallmentLoanRepository();
      await repo.recordInstallmentPayment(loan.id, count, new Date());
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
      setPrincipalErrors(prev => ({ ...prev, [loan.id]: 'Elegí si el abono reduce el plazo o la cuota.' }));
      return;
    }

    setPrincipalSubmitting(prev => ({ ...prev, [loan.id]: true }));
    try {
      const amountInCents = parseMoney(principalAmountDrafts[loan.id] ?? '');
      const resultingDraft = resultingValueDrafts[loan.id] ?? '';
      const adjustment = adjustmentType === 'reduce_term'
        ? { type: 'reduce_term' as const, newRemainingInstallments: parseInt(resultingDraft, 10) }
        : { type: 'reduce_installment_amount' as const, newInstallmentAmountCents: parseMoney(resultingDraft) };

      const repo = new LocalInstallmentLoanRepository();
      await repo.recordPrincipalPayment(loan.id, amountInCents, new Date(), adjustment);
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
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (loans.length === 0) {
    return null;
  }

  return (
    <div className="animate-fade-slide-up flex flex-col gap-3" data-testid="installment-loans">
      <p className={EYEBROW}>Con cuotas</p>
      {loans.map(loan => {
        const isSettled = loan.status === 'settled';
        const paid = Math.max(0, loan.installment_count - loan.remaining_installments);
        const paidPercent = loan.installment_count > 0 ? Math.round((paid * 100) / loan.installment_count) : 0;

        return (
          <article key={loan.id} className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4" data-testid={`installment-loan-${loan.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary">
                  <Landmark className="size-5" />
                </span>
                <div className="min-w-0">
                  <h4 className="flex flex-wrap items-center gap-2 text-headline-sm text-foreground">
                    {loan.lender_name}
                    <Badge variant={isSettled ? 'positive' : 'primary'}>{isSettled ? 'Saldado' : 'Activo'}</Badge>
                  </h4>
                  <p className="font-mono text-label-mono-xs text-muted-foreground">
                    {loan.interest_rate !== undefined ? `${loan.interest_rate}% (informativo)` : 'Sin tasa informada'}
                  </p>
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

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
              <Metric label="Monto original">
                <Money cents={loan.amount} size="sm" className="font-semibold text-primary" />
              </Metric>
              <Metric label="Cuota actual">
                <Money cents={loan.installment_amount} size="sm" className="font-semibold" />
                <span className="text-muted-foreground"> c/u</span>
              </Metric>
              <Metric label="Cuotas">
                <span className="tabular-nums">{loan.remaining_installments} de {loan.installment_count} cuotas restantes</span>
              </Metric>
            </dl>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 font-mono text-label-mono-xs text-muted-foreground">
                <span>Avance de cuotas</span>
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
              <ul className="flex flex-col gap-1">
                {(paymentHistory[loan.id] ?? []).length === 0 && (
                  <li className="text-body-sm text-muted-foreground">Todavía no hay pagos registrados.</li>
                )}
                {(paymentHistory[loan.id] ?? []).map(payment => (
                  <li key={payment.id} className="flex flex-wrap items-baseline gap-x-2 text-body-sm text-muted-foreground">
                    <span className="font-mono text-label-mono-sm">{formatShortDate(new Date(payment.date))}</span>
                    <Money cents={payment.amount} size="sm" className="text-foreground" />
                    <span>· {payment.kind === 'installment' ? 'Cuota' : 'Abono a capital'}</span>
                  </li>
                ))}
              </ul>
            )}

            {!isSettled && !loan.distribution_category_id && (
              <p className="text-body-sm text-muted-foreground">
                Asigná una categoría de distribución (50/30/20) desde &quot;Corregir términos&quot; antes de registrar un pago — la necesita para poder generar el movimiento de gasto correspondiente.
              </p>
            )}

            {!isSettled && loan.distribution_category_id && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h5 className={EYEBROW}>Pagar cuota(s)</h5>
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

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <h5 className={EYEBROW}>Registrar abono a capital</h5>

                  {!showPrincipalFlow[loan.id] && (
                    <Button variant="outline" className="w-full" onClick={() => setShowPrincipalFlow(prev => ({ ...prev, [loan.id]: true }))}>
                      Registrar abono a capital
                    </Button>
                  )}

                  {showPrincipalFlow[loan.id] && (
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
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
          </article>
        );
      })}

      {editingLoan && (
        <Dialog open onOpenChange={(open) => !open && setEditingLoan(null)}>
          <DialogContent className={FORM_DIALOG_CONTENT_CLASS}>
            <InstallmentLoanForm
              userId={userId}
              existing={editingLoan}
              onComplete={() => { setEditingLoan(null); loadLoans(); }}
              onCancel={() => setEditingLoan(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
