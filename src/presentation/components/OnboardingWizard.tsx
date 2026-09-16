'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { ExpenseCategory, ExpenseSubcategory } from '../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import OnboardingStep1 from './OnboardingStep1';
import OnboardingStep2 from './OnboardingStep2';

// ---------------------------------------------------------------------------
// Seed data for Step 3 (populated only when no expense categories exist)
// ---------------------------------------------------------------------------
const DEFAULT_CATEGORIES = [
  { name: 'Alimentación', subcategories: ['Desayuno', 'Almuerzo', 'Cena', 'Snack'] },
  { name: 'Ocio',         subcategories: ['Deporte', 'Cine', 'Fiesta', 'Restaurante'] },
  { name: 'Transporte',   subcategories: ['Combustible', 'Taxi/Uber', 'Transporte público'] },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  profileId: string;
  startStep?: 1 | 2 | 3;
  onComplete: () => void;
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
              <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
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
// Step 3 — Expense category management
// ---------------------------------------------------------------------------
function Step3Categories({
  profileId,
  onComplete,
}: {
  profileId: string;
  onComplete: () => void;
}) {
  const [items, setItems] = useState<CategoryWithSubs[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  // New category input
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  // New subcategory input — keyed by categoryId
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  // Inline error messages
  const [errors, setErrors] = useState<Record<string, string>>({});

  const catRepo = new LocalCategoryRepository();
  const movRepo = new LocalMovementRepository();

  // Load all categories + their subcategories
  const loadAll = useCallback(async () => {
    const cats = await catRepo.getExpenseCategories(profileId);
    const withSubs: CategoryWithSubs[] = await Promise.all(
      cats.map(async (cat) => ({
        category: cat,
        subcategories: await catRepo.getSubcategories(cat.id),
      }))
    );
    setItems(withSubs);
    setLoading(false);
    return cats;
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed on first load if no categories exist
  useEffect(() => {
    const init = async () => {
      const cats = await loadAll();
      if (cats.length === 0 && !seeded) {
        setSeeded(true);
        for (const def of DEFAULT_CATEGORIES) {
          const catId = uuidv7();
          await catRepo.saveExpenseCategory({ id: catId, user_id: profileId, name: def.name });
          for (const subName of def.subcategories) {
            await catRepo.saveSubcategory({ id: uuidv7(), category_id: catId, name: subName });
          }
        }
        await loadAll();
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const catId = uuidv7();
    await catRepo.saveExpenseCategory({ id: catId, user_id: profileId, name });
    setNewCatName('');
    setAddingCat(false);
    await loadAll();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const count = await movRepo.countByExpenseCategory(categoryId);
    if (count > 0) {
      setErrors(prev => ({
        ...prev,
        [categoryId]: `No se puede eliminar: tiene ${count} movimiento${count > 1 ? 's' : ''} asociado${count > 1 ? 's' : ''}.`,
      }));
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
    const count = await movRepo.countByExpenseSubcategory(subcategoryId);
    if (count > 0) {
      setErrors(prev => ({
        ...prev,
        [subcategoryId]: `No se puede eliminar: tiene ${count} movimiento${count > 1 ? 's' : ''} asociado${count > 1 ? 's' : ''}.`,
      }));
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
      <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categorías de gasto</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organizá tus gastos en categorías y subcategorías.
          </p>
        </div>

        {/* Category list */}
        <div className="space-y-3">
          {items.map(({ category, subcategories }) => (
            <div key={category.id} className="border border-border rounded-xl p-4 space-y-2">
              {/* Category header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{category.name}</span>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-destructive hover:text-destructive/80 text-xs font-medium"
                  aria-label={`Eliminar categoría ${category.name}`}
                >
                  Eliminar
                </button>
              </div>

              {/* Category-level error */}
              {errors[category.id] && (
                <p className="text-xs text-destructive">{errors[category.id]}</p>
              )}

              {/* Subcategory list */}
              <ul className="pl-3 space-y-1">
                {subcategories.map(sub => (
                  <li key={sub.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">• {sub.name}</span>
                    <button
                      onClick={() => handleDeleteSubcategory(sub.id, category.id)}
                      className="text-destructive/70 hover:text-destructive text-xs ml-2"
                      aria-label={`Eliminar subcategoría ${sub.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {errors[subcategories.find(s => errors[s.id])?.id ?? ''] && (
                  <li className="text-xs text-destructive">
                    {errors[subcategories.find(s => errors[s.id])?.id ?? '']}
                  </li>
                )}
              </ul>

              {/* Add subcategory inline */}
              {addingSubFor === category.id ? (
                <div className="flex gap-2 mt-1">
                  <input
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
                    className="flex-1 bg-background border border-input rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                  <button
                    onClick={() => handleAddSubcategory(category.id)}
                    className="py-1.5 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Agregar
                  </button>
                  <button
                    onClick={() => setAddingSubFor(null)}
                    className="py-1.5 px-3 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSubFor(category.id)}
                  className="text-xs text-primary hover:text-primary/80 font-medium mt-1"
                >
                  + Agregar subcategoría
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add category */}
        {addingCat ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Nombre de categoría"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
                if (e.key === 'Escape') setAddingCat(false);
              }}
              className="flex-1 bg-background border border-input rounded-xl py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            <button
              onClick={handleAddCategory}
              className="py-2 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Agregar
            </button>
            <button
              onClick={() => setAddingCat(false)}
              className="py-2 px-3 bg-muted text-muted-foreground rounded-xl text-sm hover:bg-muted/80 transition-colors"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCat(true)}
            className="w-full py-2.5 px-4 border border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            + Nueva categoría
          </button>
        )}

        {/* Finish button */}
        <button
          onClick={onComplete}
          disabled={!canFinish}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Finalizar configuración
        </button>

        {!canFinish && (
          <p className="text-xs text-muted-foreground text-center">
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
    setCurrentStep(3);
  };

  const handleStep3Complete = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-2">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-3xl">🌿</span>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">ez-life</h1>
        </div>
        <ProgressBar currentStep={currentStep} />
      </div>

      {currentStep === 1 && (
        <OnboardingStep1 onComplete={handleStep1Complete} />
      )}

      {currentStep === 2 && (
        <OnboardingStep2 profileId={wizardProfileId} onComplete={handleStep2Complete} />
      )}

      {currentStep === 3 && (
        <Step3Categories profileId={wizardProfileId} onComplete={handleStep3Complete} />
      )}
    </div>
  );
}
