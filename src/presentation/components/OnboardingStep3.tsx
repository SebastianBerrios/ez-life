'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { uuidv7 } from 'uuidv7';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { parseDayOfMonth } from '../../core/use-cases/parseDayOfMonth';
import { formatMoney } from '../../core/use-cases/formatMoney';
import { validateOnboardingCard, type OnboardingCardDraft } from '../../core/use-cases/validateOnboardingCard';
import { DomainError } from '../../core/domain/errors/DomainError';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';

interface Props {
  profileId: string;
  onComplete: () => void;
}

interface CardRowState {
  id: string;
  name: string;
  creditLimitText: string;
  consumedText: string;
  closingDayText: string;
  paymentDayText: string;
}

const createEmptyCard = (): CardRowState => ({
  id: uuidv7(),
  name: '',
  creditLimitText: '',
  consumedText: '0',
  closingDayText: '',
  paymentDayText: '',
});

function tryParseCents(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith('-')) return null;
  try {
    return parseMoney(trimmed);
  } catch {
    return null;
  }
}

function tryParseDay(text: string): number | undefined {
  try {
    return parseDayOfMonth(text);
  } catch {
    return undefined;
  }
}

export default function OnboardingStep3({ profileId, onComplete }: Props) {
  const [cards, setCards] = useState<CardRowState[]>([createEmptyCard()]);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateCard = (id: string, patch: Partial<CardRowState>) => {
    setCards(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)));
    setCardErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addCard = () => {
    setCards(prev => [...prev, createEmptyCard()]);
    setFormError('');
  };

  const removeCard = (id: string) => {
    setCards(prev => prev.filter(row => row.id !== id));
    setCardErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveCards = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardErrors({});
    setFormError('');

    if (cards.length === 0) {
      setFormError('Agrega al menos una tarjeta o elige "No tengo tarjetas".');
      return;
    }

    const parsed: OnboardingCardDraft[] = [];
    const nextErrors: Record<string, string> = {};

    for (const row of cards) {
      try {
        if (!row.creditLimitText.trim()) {
          throw new DomainError('La línea de crédito es obligatoria.');
        }
        const creditLimitCents = row.creditLimitText.trim().startsWith('-')
          ? -1
          : parseMoney(row.creditLimitText);

        let consumedCents = 0;
        if (row.consumedText.trim()) {
          if (row.consumedText.trim().startsWith('-')) {
            throw new DomainError('El consumo no puede ser negativo.');
          }
          consumedCents = parseMoney(row.consumedText);
        }

        const closingDay = parseDayOfMonth(row.closingDayText);
        const paymentDay = parseDayOfMonth(row.paymentDayText);

        const draft: OnboardingCardDraft = {
          id: row.id,
          name: row.name.trim(),
          creditLimitCents,
          consumedCents,
          closingDay,
          paymentDay,
        };
        validateOnboardingCard(draft);
        parsed.push(draft);
      } catch (err) {
        nextErrors[row.id] = err instanceof Error ? err.message : 'Revisa los datos de la tarjeta.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setCardErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await new LocalOnboardingRepository().saveCards(profileId, parsed);
      onComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudieron guardar tus tarjetas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoCards = async () => {
    setIsSubmitting(true);
    setFormError('');
    try {
      await new LocalOnboardingRepository().declareNotApplicable(profileId, 'cards');
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
      await new LocalOnboardingRepository().skipStep(profileId, 3);
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
        <PanelHeader eyebrow="Paso 3 de 6" title="¿Tienes tarjetas de crédito?" titleAs="h2">
          <p className="mt-1 text-sm text-muted-foreground">
            Agrega tus tarjetas en soles (PEN) para llevar el control de tu consumo y fechas de pago.
          </p>
        </PanelHeader>
        <PanelBody>
          <form onSubmit={handleSaveCards} noValidate className="space-y-4">
            <div className="space-y-4">
              {cards.map((card, idx) => {
                const limitCents = card.creditLimitText.trim() ? tryParseCents(card.creditLimitText) : null;
                const consumedCents = tryParseCents(card.consumedText) ?? 0;
                const payDay = tryParseDay(card.paymentDayText);
                const showSummary = limitCents !== null && limitCents > 0;

                return (
                  <div key={card.id} className="space-y-3 rounded-2xl bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">Tarjeta {idx + 1}</span>
                      {cards.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCard(card.id)}
                          aria-label={`Quitar tarjeta ${idx + 1}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`card-name-${card.id}`}>Nombre</Label>
                      <Input
                        id={`card-name-${card.id}`}
                        type="text"
                        placeholder="Ej. BBVA Visa"
                        value={card.name}
                        onChange={(e) => updateCard(card.id, { name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`card-limit-${card.id}`}>Línea de crédito</Label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-sm text-muted-foreground">S/</span>
                          </div>
                          <Input
                            id={`card-limit-${card.id}`}
                            type="text"
                            inputMode="decimal"
                            className="pl-9 tabular-nums"
                            placeholder="5000.00"
                            value={card.creditLimitText}
                            onChange={(e) => updateCard(card.id, { creditLimitText: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`card-consumed-${card.id}`}>Consumido hasta hoy</Label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-sm text-muted-foreground">S/</span>
                          </div>
                          <Input
                            id={`card-consumed-${card.id}`}
                            type="text"
                            inputMode="decimal"
                            className="pl-9 tabular-nums"
                            placeholder="0.00"
                            value={card.consumedText}
                            onChange={(e) => updateCard(card.id, { consumedText: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`card-closing-${card.id}`}>Día de cierre (opcional)</Label>
                        <Input
                          id={`card-closing-${card.id}`}
                          type="text"
                          inputMode="numeric"
                          className="tabular-nums"
                          placeholder="Ej. 10"
                          value={card.closingDayText}
                          onChange={(e) => updateCard(card.id, { closingDayText: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`card-payment-${card.id}`}>Día de pago (opcional)</Label>
                        <Input
                          id={`card-payment-${card.id}`}
                          type="text"
                          inputMode="numeric"
                          className="tabular-nums"
                          placeholder="Ej. 15"
                          value={card.paymentDayText}
                          onChange={(e) => updateCard(card.id, { paymentDayText: e.target.value })}
                        />
                      </div>
                    </div>

                    {showSummary && (
                      <p className="text-sm text-muted-foreground" data-testid={`card-summary-${idx}`}>
                        {`Usaste ${formatMoney(consumedCents)} de ${formatMoney(limitCents)}${payDay ? ` · Pagas el ${payDay}` : ''}`}
                      </p>
                    )}

                    {cardErrors[card.id] && (
                      <p role="alert" className="text-sm text-destructive">{cardErrors[card.id]}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="outline" onClick={addCard} className="w-full">
              <Plus className="size-4" />
              + Agregar tarjeta
            </Button>

            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

            <div className="space-y-2 pt-2">
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Guardando...' : 'Guardar tarjetas y continuar'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={isSubmitting}
                onClick={() => void handleNoCards()}
                className="w-full"
              >
                No tengo tarjetas
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
