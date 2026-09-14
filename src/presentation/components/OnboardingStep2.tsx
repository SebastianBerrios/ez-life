'use client';

import React, { useState } from 'react';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { uuidv7 } from 'uuidv7';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  profileId: string;
  onComplete: () => void;
}

export default function OnboardingStep2({ profileId, onComplete }: Props) {
  const [needs, setNeeds] = useState<number>(50);
  const [wants, setWants] = useState<number>(30);
  const [savings, setSavings] = useState<number>(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingIds, setExistingIds] = useState<Record<string, string>>({});
  const [tutorialOpen, setTutorialOpen] = useState(true);

  React.useEffect(() => {
    const loadCats = async () => {
      const repo = new LocalCategoryRepository();
      const cats = await repo.getDistributionCategories(profileId);
      if (cats.length > 0) {
        const ids: Record<string, string> = {};
        cats.forEach(c => {
          if (c.name.includes('Necesidades')) { setNeeds(c.percentage); ids.needs = c.id; }
          if (c.name.includes('Gustos')) { setWants(c.percentage); ids.wants = c.id; }
          if (c.name.includes('Ahorro')) { setSavings(c.percentage); ids.savings = c.id; }
        });
        setExistingIds(ids);
      }
    };
    loadCats();
  }, [profileId]);

  const total = needs + wants + savings;
  const isValid = total === 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      const repo = new LocalCategoryRepository();

      await Promise.all([
        repo.saveDistributionCategory({ id: existingIds.needs || uuidv7(), user_id: profileId, name: 'Necesidades Básicas', percentage: needs, is_default: true }),
        repo.saveDistributionCategory({ id: existingIds.wants || uuidv7(), user_id: profileId, name: 'Gustos y Deseos', percentage: wants, is_default: true }),
        repo.saveDistributionCategory({ id: existingIds.savings || uuidv7(), user_id: profileId, name: 'Ahorro e Inversión', percentage: savings, is_default: true }),
      ]);

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4">
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-foreground">Tu distribución de ingresos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Definí cómo querés distribuir lo que ganás cada mes.
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
              <span className="text-sm font-semibold text-primary">¿Qué es el método 50/30/20?</span>
            </div>
            {tutorialOpen
              ? <ChevronUp className="w-4 h-4 text-primary shrink-0" />
              : <ChevronDown className="w-4 h-4 text-primary shrink-0" />
            }
          </button>

          {tutorialOpen && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-foreground/80">
                Una regla simple para organizar tus ingresos en tres categorías:
              </p>
              <div className="space-y-2">
                <TutorialItem emoji="🏠" label="50% — Necesidades" description="Alquiler, comida, transporte, servicios." color="text-emerald-600 dark:text-emerald-400" />
                <TutorialItem emoji="🎉" label="30% — Gustos" description="Salidas, streaming, ropa, hobbies." color="text-amber-600 dark:text-amber-400" />
                <TutorialItem emoji="💰" label="20% — Ahorro" description="Fondo de emergencia, inversiones, metas." color="text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs text-muted-foreground">
                Podés ajustar los porcentajes según tu realidad. Solo asegurate de que sumen 100%.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <PercentInput
            id="needs"
            label="🏠 Necesidades Básicas"
            value={needs}
            onChange={setNeeds}
          />
          <PercentInput
            id="wants"
            label="🎉 Gustos y Deseos"
            value={wants}
            onChange={setWants}
          />
          <PercentInput
            id="savings"
            label="💰 Ahorro e Inversión"
            value={savings}
            onChange={setSavings}
          />

          <div className={`text-sm font-medium px-4 py-3 rounded-xl ${isValid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
            Total: {total}% {isValid ? '✓ Perfecto' : '— Debe sumar exactamente 100%'}
          </div>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar distribución'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PercentInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          id={id}
          required
          min="0"
          max="100"
          className="flex-1 bg-background border border-input rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-sm font-medium text-muted-foreground w-6">%</span>
      </div>
    </div>
  );
}

function TutorialItem({ emoji, label, description, color }: { emoji: string; label: string; description: string; color: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-base shrink-0 mt-0.5">{emoji}</span>
      <div>
        <p className={`text-xs font-semibold ${color}`}>{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
