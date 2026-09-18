'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { InstallmentAdjustmentType, InstallmentLoan, InstallmentPayment } from '../../core/domain/models/types';
import { DomainError } from '../../core/domain/errors/DomainError';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import InstallmentLoanForm from './InstallmentLoanForm';

interface Props {
  userId: string;
}

const centsToDisplay = (cents: number) => (cents / 100).toFixed(2);

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
    const amountDraft = principalAmountDrafts[loan.id] ?? '';
    const amountInCents = Math.round(parseFloat(amountDraft.replace(/,/g, '')) * 100);
    const adjustmentType = adjustmentTypeDrafts[loan.id];
    const resultingDraft = resultingValueDrafts[loan.id] ?? '';

    if (!adjustmentType) {
      setPrincipalErrors(prev => ({ ...prev, [loan.id]: 'Elegí si el abono reduce el plazo o la cuota.' }));
      return;
    }

    const adjustment = adjustmentType === 'reduce_term'
      ? { type: 'reduce_term' as const, newRemainingInstallments: parseInt(resultingDraft, 10) }
      : { type: 'reduce_installment_amount' as const, newInstallmentAmountCents: Math.round(parseFloat(resultingDraft.replace(/,/g, '')) * 100) };

    try {
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
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (loans.length === 0) {
    return null;
  }

  return (
    <div className="animate-fade-slide-up space-y-4">
      {loans.map(loan => {
        const isSettled = loan.status === 'settled';

        return (
          <Card key={loan.id} className="relative shadow-warm-sm">
            <div className="flex items-start justify-between px-5">
              <div>
                <h3 className="font-heading font-bold text-foreground">{loan.lender_name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {loan.remaining_installments} de {loan.installment_count} cuotas restantes · S/ {centsToDisplay(loan.installment_amount)} c/u
                  {loan.interest_rate !== undefined && ` · ${loan.interest_rate}% (informativo)`}
                </p>
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

            <div className="mt-4 space-y-1 px-5">
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium">S/ {centsToDisplay(loan.amount)} monto original</span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => toggleHistory(loan)}>
                  {historyOpenFor === loan.id ? 'Ocultar historial' : 'Ver historial de pagos'}
                </Button>
              </div>
            </div>

            {historyOpenFor === loan.id && (
              <div className="mt-2 px-5 space-y-1">
                {(paymentHistory[loan.id] ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
                )}
                {(paymentHistory[loan.id] ?? []).map(payment => (
                  <p key={payment.id} className="text-sm text-muted-foreground">
                    {new Date(payment.date).toLocaleDateString()} · S/ {centsToDisplay(payment.amount)} ·{' '}
                    {payment.kind === 'installment' ? 'Cuota' : 'Abono a capital'}
                  </p>
                ))}
              </div>
            )}

            {!isSettled && (
              <div className="mt-4 px-5 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`installments-${loan.id}`}>Cuotas a pagar</Label>
                    <Input
                      id={`installments-${loan.id}`}
                      type="text"
                      placeholder="1"
                      value={installmentDrafts[loan.id] ?? ''}
                      onChange={(e) => setInstallmentDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                    />
                  </div>
                  <Button size="sm" onClick={() => handlePayInstallments(loan)}>
                    Pagar cuota(s)
                  </Button>
                </div>
                {installmentErrors[loan.id] && <p className="text-sm text-destructive">{installmentErrors[loan.id]}</p>}

                {!showPrincipalFlow[loan.id] && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setShowPrincipalFlow(prev => ({ ...prev, [loan.id]: true }))}>
                    Registrar abono a capital
                  </Button>
                )}

                {showPrincipalFlow[loan.id] && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="space-y-1">
                      <Label htmlFor={`principal-amount-${loan.id}`}>Monto del abono</Label>
                      <Input
                        id={`principal-amount-${loan.id}`}
                        type="text"
                        placeholder="0.00"
                        value={principalAmountDrafts[loan.id] ?? ''}
                        onChange={(e) => setPrincipalAmountDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`adjustment-${loan.id}`}>¿Este abono reduce el plazo o la cuota?</Label>
                      <Select
                        value={adjustmentTypeDrafts[loan.id] ?? ''}
                        onValueChange={(val) => setAdjustmentTypeDrafts(prev => ({ ...prev, [loan.id]: val as InstallmentAdjustmentType }))}
                      >
                        <SelectTrigger id={`adjustment-${loan.id}`}>
                          <SelectValue placeholder="Elegir..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reduce_term">Reducir plazo (menos cuotas)</SelectItem>
                          <SelectItem value="reduce_installment_amount">Reducir cuota (misma cantidad de cuotas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {adjustmentTypeDrafts[loan.id] === 'reduce_term' && (
                      <div className="space-y-1">
                        <Label htmlFor={`resulting-${loan.id}`}>Nuevo número de cuotas restantes</Label>
                        <Input
                          id={`resulting-${loan.id}`}
                          type="text"
                          value={resultingValueDrafts[loan.id] ?? ''}
                          onChange={(e) => setResultingValueDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        />
                      </div>
                    )}
                    {adjustmentTypeDrafts[loan.id] === 'reduce_installment_amount' && (
                      <div className="space-y-1">
                        <Label htmlFor={`resulting-${loan.id}`}>Nuevo monto de cuota</Label>
                        <Input
                          id={`resulting-${loan.id}`}
                          type="text"
                          value={resultingValueDrafts[loan.id] ?? ''}
                          onChange={(e) => setResultingValueDrafts(prev => ({ ...prev, [loan.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                        />
                      </div>
                    )}

                    {principalErrors[loan.id] && <p className="text-sm text-destructive">{principalErrors[loan.id]}</p>}

                    <Button size="sm" className="w-full" onClick={() => handleConfirmPrincipalPayment(loan)}>
                      Confirmar abono
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isSettled && (
              <p className="mt-4 px-5 text-sm text-primary font-medium">Pagado/Saldado ✓</p>
            )}
          </Card>
        );
      })}

      {editingLoan && (
        <Dialog open onOpenChange={(open) => !open && setEditingLoan(null)}>
          <DialogContent>
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
