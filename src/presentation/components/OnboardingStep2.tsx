'use client';

import React, { useState, useEffect } from 'react';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { validateDeletion } from '../../core/use-cases/validateDeletion';
import { DomainError } from '../../core/domain/errors/DomainError';
import { uuidv7 } from 'uuidv7';
import { Info, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

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

  // On first entry, seed the 3 default buckets as real DB rows right away —
  // their IDs must exist before Step 3 can reference them for the category seed.
  useEffect(() => {
    const init = async () => {
      const existing = await catRepo.getDistributionCategories(profileId);
      if (existing.length > 0) {
        setBuckets(existing.map(c => ({ id: c.id, name: c.name, percentage: c.percentage, is_default: c.is_default, is_savings: c.is_savings })));
      } else {
        const seeded = await Promise.all(
          DEFAULT_BUCKETS.map(b =>
            catRepo.saveDistributionCategory({
              id: uuidv7(),
              user_id: profileId,
              name: b.name,
              percentage: b.percentage,
              is_default: b.is_default,
              is_savings: b.is_savings,
            })
          )
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

  const handleDeleteBucket = async (id: string) => {
    if (buckets.length <= 1) {
      setDeleteErrors(prev => ({ ...prev, [id]: 'Necesitás al menos una categoría de distribución.' }));
      return;
    }

    const attachedCount = await catRepo.countExpenseCategoriesByDistribution(id);
    try {
      validateDeletion(
        attachedCount,
        `No se puede eliminar: tiene ${attachedCount} categoría${attachedCount > 1 ? 's' : ''} de gasto asociada${attachedCount > 1 ? 's' : ''}.`
      );
    } catch (err) {
      if (err instanceof DomainError) {
        setDeleteErrors(prev => ({ ...prev, [id]: err.message }));
      }
      return;
    }

    setDeleteErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
    await catRepo.deleteDistributionCategory(id);
    setBuckets(prev => prev.filter(b => b.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      await Promise.all(
        buckets.map(b =>
          catRepo.saveDistributionCategory({
            id: b.id,
            user_id: profileId,
            name: b.name.trim() || 'Sin nombre',
            percentage: b.percentage,
            is_default: b.is_default,
            is_savings: b.is_savings,
          })
        )
      );
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-md mx-auto px-4">
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-foreground">Tu distribución de ingresos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Definí en qué categorías querés distribuir lo que ganás cada mes. Podés agregar, renombrar o eliminar las que necesites.
          </p>
        </div>

        {/* Tutorial collapsible */}
        <div className="mx-6 mb-4 bg-primary/8 border border-primary/20 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setTutorialOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span className="text-base font-semibold text-primary">¿Qué es el método 50/30/20?</span>
            </div>
            {tutorialOpen
              ? <ChevronUp className="w-4 h-4 text-primary shrink-0" />
              : <ChevronDown className="w-4 h-4 text-primary shrink-0" />
            }
          </button>

          {tutorialOpen && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-foreground/80">
                Una regla simple para organizar tus ingresos en categorías:
              </p>
              <div className="space-y-2">
                <TutorialItem emoji="🏠" label="50% — Necesidades" description="Alquiler, comida, transporte, servicios." color="text-emerald-600 dark:text-emerald-400" />
                <TutorialItem emoji="🎉" label="30% — Gustos" description="Salidas, streaming, ropa, hobbies." color="text-amber-600 dark:text-amber-400" />
                <TutorialItem emoji="💰" label="20% — Ahorro" description="Fondo de emergencia, inversiones, metas." color="text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                Es solo un punto de partida — agregá, renombrá o eliminá categorías según tu realidad. Solo asegurate de que sumen 100%.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="space-y-3">
            {buckets.map((bucket, idx) => (
              <div key={bucket.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Nombre de la categoría ${idx + 1}`}
                    value={bucket.name}
                    onChange={(e) => updateBucket(bucket.id, { name: e.target.value })}
                    placeholder="Nombre de la categoría"
                    className="flex-1 h-11 bg-background border border-input rounded-xl py-2.5 px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                  <input
                    type="number"
                    aria-label={`Porcentaje de la categoría ${idx + 1}`}
                    min="0"
                    max="100"
                    value={bucket.percentage}
                    onChange={(e) => updateBucket(bucket.id, { percentage: Number(e.target.value) })}
                    className="w-20 h-11 bg-background border border-input rounded-xl py-2.5 px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBucket(bucket.id)}
                    aria-label={`Eliminar categoría ${bucket.name || idx + 1}`}
                    className="text-destructive hover:text-destructive/80 h-11 w-11 flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {deleteErrors[bucket.id] && (
                  <p className="text-sm text-destructive">{deleteErrors[bucket.id]}</p>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddBucket}
            className="w-full h-11 px-4 border border-dashed border-border rounded-xl text-base font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            + Nueva categoría de distribución
          </button>

          <div className={`text-base font-medium px-4 py-3 rounded-xl ${isValid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
            Total: {total}% {isValid ? '✓ Perfecto' : '— Debe sumar exactamente 100%'}
          </div>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full h-12 px-4 rounded-xl text-base font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar distribución'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TutorialItem({ emoji, label, description, color }: { emoji: string; label: string; description: string; color: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-base shrink-0 mt-0.5">{emoji}</span>
      <div>
        <p className={`text-sm font-semibold ${color}`}>{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
