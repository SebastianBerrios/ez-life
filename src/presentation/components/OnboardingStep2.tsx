'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { uuidv7 } from 'uuidv7';
import { LocalOnboardingRepository, type OnboardingBankDraft } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { DomainError } from '../../core/domain/errors/DomainError';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';

interface Props {
  profileId: string;
  onComplete: () => void;
}

interface BankRowState {
  id: string;
  name: string;
  kind: 'debit' | 'savings';
  balanceText: string;
}

function parseNonNegativeMoney(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith('-')) {
    throw new DomainError('El saldo no puede ser negativo.');
  }
  return parseMoney(trimmed);
}

export default function OnboardingStep2({ profileId, onComplete }: Props) {
  const [cashText, setCashText] = useState('0');
  const [banks, setBanks] = useState<BankRowState[]>([]);
  const [cashError, setCashError] = useState('');
  const [bankErrors, setBankErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addBankRow = () => {
    setBanks(prev => [...prev, { id: uuidv7(), name: '', kind: 'debit', balanceText: '0' }]);
    setFormError('');
  };

  const updateBank = (id: string, patch: Partial<BankRowState>) => {
    setBanks(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)));
    setBankErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const removeBank = (id: string) => {
    setBanks(prev => prev.filter(row => row.id !== id));
    setBankErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const submitAccounts = async (declareNoBanks: boolean) => {
    setCashError('');
    setBankErrors({});
    setFormError('');

    let cashCents: number;
    try {
      cashCents = parseNonNegativeMoney(cashText);
    } catch (err) {
      setCashError(err instanceof Error ? err.message : 'El saldo no puede ser negativo.');
      return;
    }

    const parsedBanks: OnboardingBankDraft[] = [];
    const nextErrors: Record<string, string> = {};

    if (!declareNoBanks) {
      for (const row of banks) {
        if (!row.name.trim()) {
          nextErrors[row.id] = 'El nombre de la cuenta es obligatorio.';
          continue;
        }
        try {
          const balance = parseNonNegativeMoney(row.balanceText);
          parsedBanks.push({
            id: row.id,
            name: row.name.trim(),
            kind: row.kind,
            balance,
          });
        } catch (err) {
          nextErrors[row.id] = err instanceof Error ? err.message : 'El saldo no puede ser negativo.';
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setBankErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await new LocalOnboardingRepository().saveAccounts(profileId, {
        cash: cashCents,
        banks: parsedBanks,
        ...(declareNoBanks ? { declareNoBanks: true } : {}),
      });
      onComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudieron guardar tus cuentas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitAccounts(false);
  };

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <Panel>
        <PanelHeader eyebrow="Paso 2 de 6" title="¿Dónde tienes tu dinero?" titleAs="h2">
          <p className="mt-1 text-sm text-muted-foreground">
            Cuéntanos cuánto tienes hoy en efectivo y en tus cuentas de banco o ahorros.
          </p>
        </PanelHeader>
        <PanelBody>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onboarding-cash">Efectivo</Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-body-md text-muted-foreground">S/</span>
                </div>
                <Input
                  id="onboarding-cash"
                  type="text"
                  inputMode="decimal"
                  className="pl-10 tabular-nums"
                  placeholder="0.00"
                  value={cashText}
                  onChange={(e) => {
                    setCashText(e.target.value);
                    setCashError('');
                  }}
                />
              </div>
              {cashError && <p role="alert" className="text-sm text-destructive">{cashError}</p>}
            </div>

            {banks.length > 0 && (
              <div className="space-y-3">
                {banks.map((bank, idx) => (
                  <div key={bank.id} className="space-y-3 rounded-2xl bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">Cuenta {idx + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBank(bank.id)}
                        aria-label={`Quitar cuenta ${idx + 1}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`bank-name-${bank.id}`}>Nombre</Label>
                      <Input
                        id={`bank-name-${bank.id}`}
                        type="text"
                        placeholder="Ej. BCP Débito"
                        value={bank.name}
                        onChange={(e) => updateBank(bank.id, { name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`bank-kind-${bank.id}`}>Tipo</Label>
                        <select
                          id={`bank-kind-${bank.id}`}
                          value={bank.kind}
                          onChange={(e) => updateBank(bank.id, { kind: e.target.value as 'debit' | 'savings' })}
                          className="flex h-11 w-full rounded-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:shadow-focus"
                        >
                          <option value="debit">Débito</option>
                          <option value="savings">Ahorros</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`bank-balance-${bank.id}`}>Saldo actual</Label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-sm text-muted-foreground">S/</span>
                          </div>
                          <Input
                            id={`bank-balance-${bank.id}`}
                            type="text"
                            inputMode="decimal"
                            className="pl-9 tabular-nums"
                            placeholder="0.00"
                            value={bank.balanceText}
                            onChange={(e) => updateBank(bank.id, { balanceText: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {bankErrors[bank.id] && (
                      <p role="alert" className="text-sm text-destructive">{bankErrors[bank.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button type="button" variant="outline" onClick={addBankRow} className="w-full">
              <Plus className="size-4" />
              + Agregar cuenta
            </Button>

            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

            <div className="space-y-2 pt-2">
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Guardando...' : 'Continuar'}
              </Button>

              {banks.length === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={isSubmitting}
                  onClick={() => void submitAccounts(true)}
                  className="w-full"
                >
                  Solo uso efectivo
                </Button>
              )}
            </div>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}
