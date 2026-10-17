'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { validateDeletion } from '../../core/use-cases/validateDeletion';
import { DomainError } from '../../core/domain/errors/DomainError';
import { uuidv7 } from 'uuidv7';
import { stableId } from '../../core/use-cases/stableId';
import { Info, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

interface Props {
  profileId: string;
  onComplete: () => void;
}

interface BucketDraft {
  id: string;
  name: string;
  percentage: number;
  is_default: boolean;
  is_savings: boolean;
}

const DEFAULT_BUCKETS: Omit<BucketDraft, 'id'>[] = [
  { name: 'Necesidades Básicas', percentage: 50, is_default: true, is_savings: false },
  { name: 'Gustos y Deseos', percentage: 30, is_default: true, is_savings: false },
  { name: 'Ahorro e Inversión', percentage: 20, is_default: true, is_savings: true },
];

export default function OnboardingStep2({ profileId, onComplete }: Props) {
  const [buckets, setBuckets] = useState<BucketDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(true);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const catRepo = new LocalCategoryRepository();
  const movementRepo = new LocalMovementRepository();

  // Guards the seed effect below against React 18 Strict Mode's dev
  // double-invoke, which would otherwise seed the 3 default buckets twice
  // (see Step3Categories' seedStartedRef for the same pattern).
  const seedStartedRef = useRef(false);

  // On first entry, seed the 3 default buckets as real DB rows right away —
  // their IDs must exist before Step 3 can reference them for the category seed.
  useEffect(() => {
    if (seedStartedRef.current) return;
    seedStartedRef.current = true;
    const init = async () => {
      const existing = await catRepo.getDistributionCategories(profileId);
      if (existing.length > 0) {
        setBuckets(existing.map(c => ({ id: c.id, name: c.name, percentage: c.percentage, is_default: c.is_default, is_savings: c.is_savings })));
      } else {
        const seeded = await catRepo.saveDistributionSet(profileId,
          DEFAULT_BUCKETS.map((b, index) => ({
              id: stableId(`seed-bucket:${profileId}:${index}`),
              user_id: profileId,
              name: b.name,
              percentage: b.percentage,
              is_default: b.is_default,
              is_savings: b.is_savings,
            }))
        );
        setBuckets(seeded.map(c => ({ id: c.id, name: c.name, percentage: c.percentage, is_default: c.is_default, is_savings: c.is_savings })));
      }
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const total = buckets.reduce((acc, b) => acc + (b.percentage || 0), 0);
  const isValid = total === 100 && buckets.length > 0;

  const updateBucket = (id: string, patch: Partial<BucketDraft>) => {
    setBuckets(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
  };

  const handleAddBucket = () => {
    setBuckets(prev => [...prev, { id: uuidv7(), name: '', percentage: 0, is_default: false, is_savings: false }]);
  };

  // Mutually-exclusive, radio-like semantics: marking one bucket as the
  // savings bucket unmarks every other one, so exactly one is always true.
  // There is no "unmark" action — the invariant is enforced by construction.
  const handleSetSavingsBucket = (id: string) => {
    setBuckets(prev => prev.map(b => ({ ...b, is_savings: b.id === id })));
  };

  const handleDeleteBucket = async (id: string) => {
    if (buckets.length <= 1) {
      setDeleteErrors(prev => ({ ...prev, [id]: 'Necesitás al menos una categoría de distribución.' }));
      return;
    }

    const attachedCategoriesCount = await catRepo.countExpenseCategoriesByDistribution(id);
    try {
      validateDeletion(
        attachedCategoriesCount,
        `No se puede eliminar: tiene ${attachedCategoriesCount} categoría${attachedCategoriesCount > 1 ? 's' : ''} de gasto asociada${attachedCategoriesCount > 1 ? 's' : ''}.`
      );
    } catch (err) {
      if (err instanceof DomainError) {
        setDeleteErrors(prev => ({ ...prev, [id]: err.message }));
      }
      return;
    }

    const attachedMovementsCount = await movementRepo.countByDistributionCategory(id);
    try {
      validateDeletion(
        attachedMovementsCount,
        `No se puede eliminar: tiene ${attachedMovementsCount} movimiento${attachedMovementsCount > 1 ? 's' : ''} asociado${attachedMovementsCount > 1 ? 's' : ''}.`
      );
    } catch (err) {
      if (err instanceof DomainError) {
        setDeleteErrors(prev => ({ ...prev, [id]: err.message }));
      }
      return;
    }

    setDeleteErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
    setBuckets(prev => prev.filter(b => b.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      await catRepo.saveDistributionSet(profileId,
        buckets.map(b => ({
            id: b.id,
            user_id: profileId,
            name: b.name.trim() || 'Sin nombre',
            percentage: b.percentage,
            is_default: b.is_default,
            is_savings: b.is_savings,
          }))
      );
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground" role="status">Cargando...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Paso 2 de 3" title="Tu distribución de ingresos" titleAs="h2">
          <p className="mt-1 text-body-md text-muted-foreground">
            Definí en qué categorías querés distribuir lo que ganás cada mes. Podés agregar, renombrar o eliminar las que necesites.
          </p>
        </PanelHeader>

        {/* Tutorial collapsible */}
        <div className="mx-5 mb-4 border-y border-border">
          <button
            type="button"
            onClick={() => setTutorialOpen(v => !v)}
            aria-expanded={tutorialOpen}
            aria-controls="onboarding-502030-tutorial"
            className="flex w-full items-center justify-between gap-2 px-1 py-3 text-left outline-none focus-visible:shadow-focus"
          >
            <span className="flex items-center gap-2">
              <Info className="size-4 shrink-0 text-primary" />
              <span className="text-body-md font-semibold text-primary">¿Qué es el método 50/30/20?</span>
            </span>
            {tutorialOpen
              ? <ChevronUp className="size-4 shrink-0 text-primary" />
              : <ChevronDown className="size-4 shrink-0 text-primary" />
            }
          </button>

          {tutorialOpen && (
            <div id="onboarding-502030-tutorial" className="space-y-3 px-1 pb-4">
              <p className="text-body-md text-foreground">
                Una regla simple para organizar tus ingresos en categorías:
              </p>
              <div className="space-y-2">
                <TutorialItem label="50% — Necesidades" description="Alquiler, comida, transporte, servicios." />
                <TutorialItem label="30% — Gustos" description="Salidas, streaming, ropa, hobbies." />
                <TutorialItem label="20% — Ahorro" description="Fondo de emergencia, inversiones, metas." />
              </div>
              <p className="text-body-md text-muted-foreground">
                Es solo un punto de partida — agregá, renombrá o eliminá categorías según tu realidad. Solo asegurate de que sumen 100%.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <PanelBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              {buckets.map((bucket, idx) => (
                <div key={bucket.id} className="space-y-1">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      aria-label={`Nombre de la categoría ${idx + 1}`}
                      value={bucket.name}
                      onChange={(e) => updateBucket(bucket.id, { name: e.target.value })}
                      placeholder="Nombre de la categoría"
                      className="w-full"
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          aria-label={`Porcentaje de la categoría ${idx + 1}`}
                          min="0"
                          max="100"
                          value={bucket.percentage}
                          onChange={(e) => updateBucket(bucket.id, { percentage: Number(e.target.value) })}
                          className="w-20 tabular-nums"
                        />
                        <span className="font-mono text-body-md text-muted-foreground">%</span>
                      </div>
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 font-mono text-label-mono-sm uppercase text-muted-foreground">
                        <input
                          type="radio"
                          name="savingsBucket"
                          aria-label={`Marcar categoría ${idx + 1} como ahorro`}
                          checked={bucket.is_savings}
                          onChange={() => handleSetSavingsBucket(bucket.id)}
                          className="size-4 accent-primary"
                        />
                        Ahorro
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBucket(bucket.id)}
                        aria-label={`Eliminar categoría ${bucket.name || idx + 1}`}
                        className="ml-auto shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {deleteErrors[bucket.id] && (
                    <p role="alert" className="text-body-md text-destructive">{deleteErrors[bucket.id]}</p>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddBucket}
              className="w-full border-dashed text-muted-foreground hover:text-foreground"
            >
              + Nueva categoría de distribución
            </Button>

            <div
              role="status"
              className={cn(
                'rounded-lg border px-4 py-3 text-body-md font-medium',
                isValid ? 'border-primary/25 bg-primary/10 text-primary' : 'border-destructive/25 bg-destructive/10 text-destructive',
              )}
            >
              Total: {total}% {isValid ? '✓ Perfecto' : '— Debe sumar exactamente 100%'}
            </div>

            <Button type="submit" size="lg" disabled={!isValid || isSubmitting} className="w-full">
              {isSubmitting ? 'Guardando...' : 'Guardar distribución'}
            </Button>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}

function TutorialItem({ label, description }: { label: string; description: string }) {
  return (
    <div>
      <p className="text-body-md font-semibold text-foreground">{label}</p>
      <p className="text-body-md text-muted-foreground">{description}</p>
    </div>
  );
}
