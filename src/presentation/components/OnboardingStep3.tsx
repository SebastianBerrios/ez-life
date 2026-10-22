'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { validateDeletion } from '../../core/use-cases/validateDeletion';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory } from '../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { useTransientMessages } from '../hooks/useTransientMessages';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';

interface Props {
  profileId: string;
  onComplete: () => void;
}

interface CategoryWithSubs {
  category: ExpenseCategory;
  subcategories: ExpenseSubcategory[];
}

/**
 * Step 3 — expense category management, grouped by distribution bucket. Seeds the default categories
 * once (when none exist yet) so every bucket, savings included, starts with examples (FR-023).
 */
export default function OnboardingStep3({ profileId, onComplete }: Props) {
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

  // Blocked-delete notices fade on their own (keyed by the category/subcategory that caused them);
  // a seeding failure is not transient, so it stays in its own state.
  const { messages: errors, show: showError, clearAll: clearNotices } = useTransientMessages();
  const [seedError, setSeedError] = useState('');

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
      await catRepo.seedDefaults(profileId);
      await loadAll();
    };
    init().catch(error => { setSeedError(error instanceof Error ? error.message : 'No se pudieron preparar las categorías.'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddCategory = async (bucketId: string) => {
    clearNotices();
    const name = (newCatName[bucketId] || '').trim();
    if (!name) return;
    const catId = uuidv7();
    await catRepo.saveExpenseCategory({ id: catId, user_id: profileId, distribution_category_id: bucketId, name });
    setNewCatName(prev => ({ ...prev, [bucketId]: '' }));
    setAddingCatFor(null);
    await loadAll();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    clearNotices();
    const count = await movRepo.countByExpenseCategory(categoryId);
    try {
      validateDeletion(
        count,
        `No se puede eliminar: tiene ${count} movimiento${count > 1 ? 's' : ''} asociado${count > 1 ? 's' : ''}.`
      );
    } catch (err) {
      if (err instanceof DomainError) showError(categoryId, err.message);
      return;
    }
    await catRepo.deleteExpenseCategory(categoryId);
    await loadAll();
  };

  const handleAddSubcategory = async (categoryId: string) => {
    clearNotices();
    const name = (newSubName[categoryId] || '').trim();
    if (!name) return;
    await catRepo.saveSubcategory({ id: uuidv7(), category_id: categoryId, name });
    setNewSubName(prev => ({ ...prev, [categoryId]: '' }));
    setAddingSubFor(null);
    await loadAll();
  };

  const handleDeleteSubcategory = async (subcategoryId: string, categoryId: string) => {
    clearNotices();
    const categoryItem = items.find(i => i.category.id === categoryId);
    if (categoryItem && categoryItem.subcategories.length <= 1) {
      showError(subcategoryId, 'No se puede eliminar: la categoría necesita al menos una subcategoría.');
      return;
    }

    const count = await movRepo.countByExpenseSubcategory(subcategoryId);
    try {
      validateDeletion(
        count,
        `No se puede eliminar: tiene ${count} movimiento${count > 1 ? 's' : ''} asociado${count > 1 ? 's' : ''}.`
      );
    } catch (err) {
      if (err instanceof DomainError) showError(subcategoryId, err.message);
      return;
    }

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
  const canFinish = items.length > 0 && items.every(item => item.subcategories.length > 0);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground" role="status">Cargando...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <Panel>
        <PanelHeader eyebrow="Paso 3 de 3" title="Categorías de gasto" titleAs="h2">
          <p className="mt-1 text-body-md text-muted-foreground">
            Organiza tus gastos en categorías y subcategorías, agrupadas por cada categoría de distribución.
          </p>
        </PanelHeader>
        <PanelBody className="space-y-6">
          {seedError && <p role="alert" className="text-body-md text-destructive">{seedError}</p>}

          {/* One section per distribution bucket */}
          {[...buckets].sort((a, b) => b.percentage - a.percentage).map(bucket => {
            const bucketItems = items.filter(i => i.category.distribution_category_id === bucket.id);
            return (
              <section key={bucket.id} aria-label={bucket.name} className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <h3 className="font-mono text-label-mono-sm uppercase text-foreground">{bucket.name}</h3>
                  <Badge>{bucket.percentage}%</Badge>
                </div>

                <div className="space-y-3">
                  {bucketItems.map(({ category, subcategories }) => (
                    <div key={category.id} className="space-y-2 rounded-lg bg-surface-2 p-3">
                      {/* Category header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 break-words text-body-md font-semibold text-foreground">{category.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="shrink-0 text-destructive hover:text-destructive"
                          aria-label={`Eliminar categoría ${category.name}`}
                        >
                          <Trash2 />
                          Eliminar
                        </Button>
                      </div>

                      {errors[category.id] && (
                        <p role="alert" className="text-body-md text-destructive">{errors[category.id]}</p>
                      )}

                      {subcategories.length === 0 && (
                        <p role="status" className="text-body-md text-muted-foreground">Agrega al menos una subcategoría.</p>
                      )}

                      {/* Subcategory list */}
                      <ul className="space-y-1 pl-1">
                        {subcategories.map(sub => (
                          <li key={sub.id}>
                            <div className="flex items-center justify-between gap-2 text-body-md">
                              <span className="min-w-0 break-words text-muted-foreground">• {sub.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSubcategory(sub.id, category.id)}
                                className="shrink-0 text-destructive hover:text-destructive"
                                aria-label={`Eliminar subcategoría ${sub.name}`}
                              >
                                <X />
                              </Button>
                            </div>
                            {errors[sub.id] && (
                              <p role="alert" className="text-body-md text-destructive">{errors[sub.id]}</p>
                            )}
                          </li>
                        ))}
                      </ul>

                      {/* Add subcategory inline */}
                      {addingSubFor === category.id ? (
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            type="text"
                            placeholder="Nombre de subcategoría"
                            aria-label={`Nombre de subcategoría en ${category.name}`}
                            value={newSubName[category.id] || ''}
                            onChange={(e) =>
                              setNewSubName(prev => ({ ...prev, [category.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); handleAddSubcategory(category.id); }
                              if (e.key === 'Escape') setAddingSubFor(null);
                            }}
                            className="min-w-0 flex-1"
                          />
                          <Button type="button" onClick={() => handleAddSubcategory(category.id)}>
                            Agregar
                          </Button>
                          <Button type="button" variant="secondary" size="icon" aria-label="Cancelar subcategoría" onClick={() => setAddingSubFor(null)}>
                            <X />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddingSubFor(category.id)}
                          className="text-primary hover:text-primary"
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
                      aria-label={`Nombre de categoría en ${bucket.name}`}
                      value={newCatName[bucket.id] || ''}
                      onChange={(e) => setNewCatName(prev => ({ ...prev, [bucket.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(bucket.id); }
                        if (e.key === 'Escape') setAddingCatFor(null);
                      }}
                      className="min-w-0 flex-1"
                    />
                    <Button type="button" onClick={() => handleAddCategory(bucket.id)}>
                      Agregar
                    </Button>
                    <Button type="button" variant="secondary" size="icon" aria-label="Cancelar categoría" onClick={() => setAddingCatFor(null)}>
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddingCatFor(bucket.id)}
                    className="w-full border-dashed text-muted-foreground hover:text-foreground"
                  >
                    <Plus />
                    Nueva categoría en {bucket.name}
                  </Button>
                )}
              </section>
            );
          })}

          {/* Finish button */}
          <div className="space-y-2">
            <Button type="button" onClick={onComplete} disabled={!canFinish} size="lg" className="w-full">
              Finalizar configuración
            </Button>

            {!canFinish && (
              <p className="text-center text-body-md text-muted-foreground">
                Necesitas al menos una categoría con una subcategoría para continuar.
              </p>
            )}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
