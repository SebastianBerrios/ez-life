'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { validateDeletion } from '../../core/use-cases/validateDeletion';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory, UUID } from '../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import OnboardingStep1 from './OnboardingStep1';
import OnboardingStep2 from './OnboardingStep2';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Seed data for Step 3 (populated only when no expense categories exist).
// Mapped to buckets structurally (highest-% non-savings bucket, then the
// next one) rather than by name, since bucket names are user-editable.
// ---------------------------------------------------------------------------
// FR-023: the wizard's template must pre-load example categories in EVERY
// bucket, including the savings one — not just the two spending buckets.
const DEFAULT_CATEGORIES = [
  { bucket: 'primary' as const, name: 'Alimentación', subcategories: ['Desayuno', 'Almuerzo', 'Cena', 'Snack'] },
  { bucket: 'secondary' as const, name: 'Ocio', subcategories: ['Deporte', 'Cine', 'Fiesta', 'Restaurante'] },
  { bucket: 'primary' as const, name: 'Transporte', subcategories: ['Combustible', 'Taxi/Uber', 'Transporte público'] },
  { bucket: 'savings' as const, name: 'Ahorro', subcategories: ['Fondo de emergencia', 'Inversiones'] },
];

// Returns undefined per slot when no bucket exists yet for it, rather than
// falling back to '' — an empty-string distribution_category_id used to
// slip through as a "valid" id and only fail much later, at push time,
// against Postgres's NOT NULL constraint (see repairDanglingExpenseCategories
// for the historical rows this already produced).
function pickSeedBuckets(buckets: DistributionCategory[]): { primary?: UUID; secondary?: UUID; savings?: UUID } {
  const nonSavings = [...buckets].filter(b => !b.is_savings).sort((a, b) => b.percentage - a.percentage);
  const primary = nonSavings[0]?.id ?? buckets[0]?.id;
  const secondary = nonSavings[1]?.id ?? primary;
  const savingsBucket = buckets.find(b => b.is_savings)?.id ?? primary;
  return { primary, secondary, savings: savingsBucket };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  profileId: string;
  startStep?: 1 | 2 | 3;
  onComplete: (profileId: string) => void;
}

interface CategoryWithSubs {
  category: ExpenseCategory;
  subcategories: ExpenseSubcategory[];
}

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------
function ProgressBar({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { number: 1, label: 'Ingresos' },
    { number: 2, label: 'Distribución' },
    { number: 3, label: 'Categorías' },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-8 px-4">
      {steps.map((step, idx) => {
        const isCompleted = step.number < currentStep;
        const isActive = step.number === currentStep;
        return (
          <React.Fragment key={step.number}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isActive
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? '✓' : step.number}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 w-12 mb-5 mx-1 transition-colors ${
                  step.number < currentStep ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Expense category management, grouped by distribution bucket
// ---------------------------------------------------------------------------
function Step3Categories({
  profileId,
  onComplete,
}: {
  profileId: string;
  onComplete: () => void;
}) {
  const [buckets, setBuckets] = useState<DistributionCategory[]>([]);
  const [items, setItems] = useState<CategoryWithSubs[]>([]);
  const [loading, setLoading] = useState(true);
  // Guards the seed effect below against React 18 Strict Mode's dev
  // double-invoke, which replays effect setup on the same mounted instance.
  const seedStartedRef = useRef(false);

  // New category input — keyed by bucketId (each bucket section has its own inline add-input)
  const [newCatName, setNewCatName] = useState<Record<string, string>>({});
  const [addingCatFor, setAddingCatFor] = useState<string | null>(null);

  // New subcategory input — keyed by categoryId
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  // Inline error messages
  const [errors, setErrors] = useState<Record<string, string>>({});

  const catRepo = new LocalCategoryRepository();
  const movRepo = new LocalMovementRepository();

  // Load buckets + categories + their subcategories
  const loadAll = useCallback(async () => {
    const loadedBuckets = await catRepo.getDistributionCategories(profileId);
    const cats = await catRepo.getExpenseCategories(profileId);
    const withSubs: CategoryWithSubs[] = await Promise.all(
      cats.map(async (cat) => ({
        category: cat,
        subcategories: await catRepo.getSubcategories(cat.id),
      }))
    );
    setBuckets(loadedBuckets);
    setItems(withSubs);
    setLoading(false);
    return { cats, loadedBuckets };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Seed on first load if no expense categories exist yet.
  // The ref guard is checked and set synchronously, before any `await` —
  // a `useState`-based guard is racy here because Strict Mode's second
  // invocation starts before the first invocation's state update commits,
  // so both async closures would see the old "not seeded" value.
  useEffect(() => {
    if (seedStartedRef.current) return;
    seedStartedRef.current = true;
    const init = async () => {
      const { cats, loadedBuckets } = await loadAll();
      if (cats.length === 0 && loadedBuckets.length > 0) {
        const seedBuckets = pickSeedBuckets(loadedBuckets);
        for (const def of DEFAULT_CATEGORIES) {
          const bucketId = seedBuckets[def.bucket];
          if (!bucketId) continue; // no valid bucket yet — skip rather than seed a dangling category
          const catId = uuidv7();
          await catRepo.saveExpenseCategory({
            id: catId,
            user_id: profileId,
            distribution_category_id: bucketId,
            name: def.name,
          });
          for (const subName of def.subcategories) {
            await catRepo.saveSubcategory({ id: uuidv7(), category_id: catId, name: subName });
          }
        }
        await loadAll();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddCategory = async (bucketId: string) => {
    const name = (newCatName[bucketId] || '').trim();
    if (!name) return;
    const catId = uuidv7();
    await catRepo.saveExpenseCategory({ id: catId, user_id: profileId, distribution_category_id: bucketId, name });
    setNewCatName(prev => ({ ...prev, [bucketId]: '' }));
    setAddingCatFor(null);
    await loadAll();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const count = await movRepo.countByExpenseCategory(categoryId);
    try {
      validateDeletion(
        count,
        `No se puede eliminar: tiene ${count} movimiento${count > 1 ? 's' : ''} asociado${count > 1 ? 's' : ''}.`
      );
    } catch (err) {
      if (err instanceof DomainError) setErrors(prev => ({ ...prev, [categoryId]: err.message }));
      return;
    }
    setErrors(prev => { const next = { ...prev }; delete next[categoryId]; return next; });
    await catRepo.deleteExpenseCategory(categoryId);
    await loadAll();
  };

  const handleAddSubcategory = async (categoryId: string) => {
    const name = (newSubName[categoryId] || '').trim();
    if (!name) return;
    await catRepo.saveSubcategory({ id: uuidv7(), category_id: categoryId, name });
    setNewSubName(prev => ({ ...prev, [categoryId]: '' }));
    setAddingSubFor(null);
    await loadAll();
  };

  const handleDeleteSubcategory = async (subcategoryId: string, categoryId: string) => {
    const categoryItem = items.find(i => i.category.id === categoryId);
    if (categoryItem && categoryItem.subcategories.length <= 1) {
      setErrors(prev => ({ ...prev, [subcategoryId]: 'No se puede eliminar: la categoría necesita al menos una subcategoría.' }));
      return;
    }

    const count = await movRepo.countByExpenseSubcategory(subcategoryId);
    try {
      validateDeletion(
        count,
        `No se puede eliminar: tiene ${count} movimiento${count > 1 ? 's' : ''} asociado${count > 1 ? 's' : ''}.`
      );
    } catch (err) {
      if (err instanceof DomainError) setErrors(prev => ({ ...prev, [subcategoryId]: err.message }));
      return;
    }

    setErrors(prev => { const next = { ...prev }; delete next[subcategoryId]; return next; });
    await catRepo.deleteSubcategory(subcategoryId);
    // Reload just this category's subs
    const updatedSubs = await catRepo.getSubcategories(categoryId);
    setItems(prev => prev.map(item =>
      item.category.id === categoryId
        ? { ...item, subcategories: updatedSubs }
        : item
    ));
  };

  // "Finalizar" is enabled when at least 1 category with at least 1 subcategory exists
  const canFinish = items.some(item => item.subcategories.length > 0);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-md mx-auto px-4 space-y-4">
      <div className="bg-card border border-border rounded-2xl shadow-warm-md p-6 space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">Categorías de gasto</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organizá tus gastos en categorías y subcategorías, agrupadas por cada categoría de distribución.
          </p>
        </div>

        {/* One section per distribution bucket */}
        {buckets.map(bucket => {
          const bucketItems = items.filter(i => i.category.distribution_category_id === bucket.id);
          return (
            <div key={bucket.id} className="space-y-3">
              <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wide">
                {bucket.name} <span className="font-normal normal-case text-muted-foreground">({bucket.percentage}%)</span>
              </h3>

              <div className="space-y-3">
                {bucketItems.map(({ category, subcategories }) => (
                  <div key={category.id} className="border border-border rounded-xl p-5 space-y-2">
                    {/* Category header */}
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-foreground">{category.name}</span>
                      <Button
                        variant="link"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="h-auto p-0 text-destructive hover:text-destructive/80"
                        aria-label={`Eliminar categoría ${category.name}`}
                      >
                        Eliminar
                      </Button>
                    </div>

                    {errors[category.id] && (
                      <p className="text-sm text-destructive">{errors[category.id]}</p>
                    )}

                    {/* Subcategory list */}
                    <ul className="pl-3 space-y-1">
                      {subcategories.map(sub => (
                        <li key={sub.id}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">• {sub.name}</span>
                            <Button
                              variant="link"
                              onClick={() => handleDeleteSubcategory(sub.id, category.id)}
                              className="h-auto p-0 ml-2 text-destructive/70 hover:text-destructive"
                              aria-label={`Eliminar subcategoría ${sub.name}`}
                            >
                              ×
                            </Button>
                          </div>
                          {errors[sub.id] && (
                            <p className="text-sm text-destructive">{errors[sub.id]}</p>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* Add subcategory inline */}
                    {addingSubFor === category.id ? (
                      <div className="flex gap-2 mt-1">
                        <Input
                          autoFocus
                          type="text"
                          placeholder="Nombre de subcategoría"
                          value={newSubName[category.id] || ''}
                          onChange={(e) =>
                            setNewSubName(prev => ({ ...prev, [category.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddSubcategory(category.id); }
                            if (e.key === 'Escape') setAddingSubFor(null);
                          }}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => handleAddSubcategory(category.id)}>
                          Agregar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setAddingSubFor(null)}>
                          ×
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="link"
                        onClick={() => setAddingSubFor(category.id)}
                        className="h-auto p-0 mt-1"
                      >
                        + Agregar subcategoría
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add category, scoped to this bucket */}
              {addingCatFor === bucket.id ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    type="text"
                    placeholder="Nombre de categoría"
                    value={newCatName[bucket.id] || ''}
                    onChange={(e) => setNewCatName(prev => ({ ...prev, [bucket.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(bucket.id); }
                      if (e.key === 'Escape') setAddingCatFor(null);
                    }}
                    className="flex-1"
                  />
                  <Button onClick={() => handleAddCategory(bucket.id)}>
                    Agregar
                  </Button>
                  <Button variant="secondary" onClick={() => setAddingCatFor(null)}>
                    ×
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setAddingCatFor(bucket.id)}
                  className="w-full border-dashed text-muted-foreground hover:text-foreground"
                >
                  + Nueva categoría en {bucket.name}
                </Button>
              )}
            </div>
          );
        })}

        {/* Finish button */}
        <Button onClick={onComplete} disabled={!canFinish} size="lg" className="w-full">
          Finalizar configuración
        </Button>

        {!canFinish && (
          <p className="text-sm text-muted-foreground text-center">
            Necesitás al menos una categoría con una subcategoría para continuar.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------
export default function OnboardingWizard({ profileId, startStep = 1, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(startStep);
  const [wizardProfileId, setWizardProfileId] = useState<string>(profileId);

  const handleStep1Complete = (newProfileId: string) => {
    setWizardProfileId(newProfileId);
    setCurrentStep(2);
  };

  const handleStep2Complete = () => {
    // Entered directly to edit distribution (e.g. from Settings) — return
    // right away instead of dragging the user into category management too.
    if (startStep === 2) {
      onComplete(wizardProfileId);
      return;
    }
    setCurrentStep(3);
  };

  const handleStep3Complete = () => {
    onComplete(wizardProfileId);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-2">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-3xl">🌿</span>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight font-heading">ez-life</h1>
        </div>
        <ProgressBar currentStep={currentStep} />
      </div>

      <div key={currentStep} className="animate-fade-slide-up">
        {currentStep === 1 && (
          <OnboardingStep1 profileId={wizardProfileId} onComplete={handleStep1Complete} />
        )}

        {currentStep === 2 && (
          <OnboardingStep2 profileId={wizardProfileId} onComplete={handleStep2Complete} />
        )}

        {currentStep === 3 && (
          <Step3Categories profileId={wizardProfileId} onComplete={handleStep3Complete} />
        )}
      </div>
    </div>
  );
}
