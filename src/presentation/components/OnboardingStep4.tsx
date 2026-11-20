'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { uuidv7 } from 'uuidv7';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { parseDayOfMonth } from '../../core/use-cases/parseDayOfMonth';
import { validateOnboardingLoan, type OnboardingLoanDraft } from '../../core/use-cases/validateOnboardingLoan';
import { DomainError } from '../../core/domain/errors/DomainError';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';

interface Props {
  profileId: string;
  onComplete: () => void;
}

interface LoanRowState {
  id: string;
  lenderName: string;
  hasInstallments: boolean;
  amountText: string;
  installmentAmountText: string;
  installmentCountText: string;
  alreadyPaidText: string;
  paymentDayText: string;
  pendingAmountText: string;
}

const createEmptyLoan = (): LoanRowState => ({
  id: uuidv7(),
  lenderName: '',
  hasInstallments: true,
  amountText: '',
  installmentAmountText: '',
  installmentCountText: '',
  alreadyPaidText: '0',
  paymentDayText: '',
  pendingAmountText: '',
});

function parseNonNegativeInt(text: string, fallbackZero: boolean): number {
  const trimmed = text.trim();
  if (!trimmed) return fallbackZero ? 0 : -1;
  if (!/^\d+$/.test(trimmed)) return -1;
  return Number(trimmed);
}

export default function OnboardingStep4({ profileId, onComplete }: Props) {
  const [loans, setLoans] = useState<LoanRowState[]>([createEmptyLoan()]);
  const [loanErrors, setLoanErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateLoan = (id: string, patch: Partial<LoanRowState>) => {
    setLoans(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)));
    setLoanErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addLoan = () => {
    setLoans(prev => [...prev, createEmptyLoan()]);
    setFormError('');
  };

  const removeLoan = (id: string) => {
    setLoans(prev => prev.filter(row => row.id !== id));
    setLoanErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveLoans = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanErrors({});
    setFormError('');

    if (loans.length === 0) {
      setFormError('Agrega al menos un préstamo o elige "No tengo préstamos".');
      return;
    }

    const parsed: OnboardingLoanDraft[] = [];
    const nextErrors: Record<string, string> = {};

    for (const row of loans) {
      try {
        let draft: OnboardingLoanDraft;
        if (row.hasInstallments) {
          if (!row.amountText.trim()) throw new DomainError('El monto del préstamo debe ser mayor a cero.');
          if (!row.installmentAmountText.trim()) throw new DomainError('El monto de la cuota debe ser mayor a cero.');
          const amountCents = parseMoney(row.amountText);
          const installmentAmountCents = parseMoney(row.installmentAmountText);
          const installmentCount = parseNonNegativeInt(row.installmentCountText, false);
          const alreadyPaid = parseNonNegativeInt(row.alreadyPaidText, true);
          const paymentDay = parseDayOfMonth(row.paymentDayText);

          draft = {
            id: row.id,
            lenderName: row.lenderName.trim(),
            hasInstallments: true,
            amountCents,
            installmentAmountCents,
            installmentCount,
            alreadyPaid,
            paymentDay,
          };
        } else {
          if (!row.pendingAmountText.trim()) throw new DomainError('El saldo pendiente debe ser mayor a cero.');
          const pendingAmountCents = parseMoney(row.pendingAmountText);
          draft = {
            id: row.id,
            lenderName: row.lenderName.trim(),
            hasInstallments: false,
            pendingAmountCents,
          };
        }

        validateOnboardingLoan(draft);
        parsed.push(draft);
      } catch (err) {
        nextErrors[row.id] = err instanceof Error ? err.message : 'Revisa los datos del préstamo.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setLoanErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await new LocalOnboardingRepository().saveLoans(profileId, parsed);
      onComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudieron guardar tus préstamos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoLoans = async () => {
    setIsSubmitting(true);
    setFormError('');
    try {
      await new LocalOnboardingRepository().declareNotApplicable(profileId, 'loans');
      onComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar tu elección.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    setFormError('');
    try {
      await new LocalOnboardingRepository().skipStep(profileId, 4);
      onComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo omitir este paso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <Panel>
        <PanelHeader eyebrow="Paso 4 de 6" title="¿Tienes préstamos?" titleAs="h2">
          <p className="mt-1 text-sm text-muted-foreground">
            Registra tus préstamos en cuotas o deudas pendientes para ver cuánto debes y cuándo toca pagar.
          </p>
        </PanelHeader>
        <PanelBody>
          <form onSubmit={handleSaveLoans} noValidate className="space-y-4">
            <div className="space-y-4">
              {loans.map((loan, idx) => (
                <div key={loan.id} className="space-y-3 rounded-2xl bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">Préstamo {idx + 1}</span>
                    {loans.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLoan(loan.id)}
                        aria-label={`Quitar préstamo ${idx + 1}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`loan-lender-${loan.id}`}>Entidad o persona</Label>
                    <Input
                      id={`loan-lender-${loan.id}`}
                      type="text"
                      placeholder="Ej. BCP o Carlos"
                      value={loan.lenderName}
                      onChange={(e) => updateLoan(loan.id, { lenderName: e.target.value })}
                    />
                  </div>

                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-1">
                    <span className="text-sm font-medium text-foreground">¿Pagas en cuotas?</span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={loan.hasInstallments}
                      checked={loan.hasInstallments}
                      onChange={(e) => updateLoan(loan.id, { hasInstallments: e.target.checked })}
                      className="size-5 accent-primary"
                    />
                  </label>

                  {loan.hasInstallments ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`loan-amount-${loan.id}`}>Monto</Label>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <span className="text-sm text-muted-foreground">S/</span>
                            </div>
                            <Input
                              id={`loan-amount-${loan.id}`}
                              type="text"
                              inputMode="decimal"
                              className="pl-9 tabular-nums"
                              placeholder="12000.00"
                              value={loan.amountText}
                              onChange={(e) => updateLoan(loan.id, { amountText: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`loan-installment-${loan.id}`}>Cuota</Label>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <span className="text-sm text-muted-foreground">S/</span>
                            </div>
                            <Input
                              id={`loan-installment-${loan.id}`}
                              type="text"
                              inputMode="decimal"
                              className="pl-9 tabular-nums"
                              placeholder="1000.00"
                              value={loan.installmentAmountText}
                              onChange={(e) => updateLoan(loan.id, { installmentAmountText: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`loan-total-${loan.id}`}>Cuotas totales</Label>
                          <Input
                            id={`loan-total-${loan.id}`}
                            type="text"
                            inputMode="numeric"
                            className="tabular-nums"
                            placeholder="12"
                            value={loan.installmentCountText}
                            onChange={(e) => updateLoan(loan.id, { installmentCountText: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`loan-paid-${loan.id}`}>Cuotas ya pagadas</Label>
                          <Input
                            id={`loan-paid-${loan.id}`}
                            type="text"
                            inputMode="numeric"
                            className="tabular-nums"
                            placeholder="0"
                            value={loan.alreadyPaidText}
                            onChange={(e) => updateLoan(loan.id, { alreadyPaidText: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`loan-day-${loan.id}`}>Día de pago</Label>
                          <Input
                            id={`loan-day-${loan.id}`}
                            type="text"
                            inputMode="numeric"
                            className="tabular-nums"
                            placeholder="5"
                            value={loan.paymentDayText}
                            onChange={(e) => updateLoan(loan.id, { paymentDayText: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor={`loan-pending-${loan.id}`}>Saldo pendiente</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-sm text-muted-foreground">S/</span>
                        </div>
                        <Input
                          id={`loan-pending-${loan.id}`}
                          type="text"
                          inputMode="decimal"
                          className="pl-9 tabular-nums"
                          placeholder="0.00"
                          value={loan.pendingAmountText}
                          onChange={(e) => updateLoan(loan.id, { pendingAmountText: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {loanErrors[loan.id] && (
                    <p role="alert" className="text-sm text-destructive">{loanErrors[loan.id]}</p>
                  )}
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addLoan} className="w-full">
              <Plus className="size-4" />
              + Agregar préstamo
            </Button>

            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

            <div className="space-y-2 pt-2">
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Guardando...' : 'Guardar préstamos y continuar'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={isSubmitting}
                onClick={() => void handleNoLoans()}
                className="w-full"
              >
                No tengo préstamos
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                disabled={isSubmitting}
                onClick={() => void handleSkip()}
                className="w-full"
              >
                Omitir por ahora
              </Button>
            </div>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}
