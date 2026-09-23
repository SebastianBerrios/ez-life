'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { Movement } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

const NO_CATEGORY_LABEL = 'Sin categoría';

export default function MovementList({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categoryNameById, setCategoryNameById] = useState<Map<string, string>>(new Map());
  const [subcategoryNameById, setSubcategoryNameById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadMovements = useCallback(async () => {
    try {
      const repo = new LocalMovementRepository();
      const catRepo = new LocalCategoryRepository();
      const [start, end] = calculateMonthlyCycle(new Date());

      const [data, expenseCategories] = await Promise.all([
        repo.getAllByCycle(userId, start, end),
        catRepo.getExpenseCategories(userId),
      ]);
      // Sort newest first
      data.sort((a, b) => b.date.getTime() - a.date.getTime());

      // Category/subcategory lookup built once per load (research.md §7) —
      // resolving id -> name here is presentation-only assembly, not
      // business logic, so it stays in this component rather than in
      // core/use-cases (Principio III).
      const subcategoriesByCategory = await Promise.all(
        expenseCategories.map(cat => catRepo.getSubcategories(cat.id))
      );

      setMovements(data);
      setCategoryNameById(new Map(expenseCategories.map(cat => [cat.id, cat.name])));
      setSubcategoryNameById(new Map(subcategoriesByCategory.flat().map(sub => [sub.id, sub.name])));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este movimiento?')) return;
    try {
      const repo = new LocalMovementRepository();
      await repo.delete(id);
      await loadMovements();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No hay movimientos en este mes.</p>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-slide-up overflow-hidden py-0 shadow-warm-sm">
      <ul className="divide-y divide-border">
        {movements.map(m => {
          const categoryName = m.expense_category_id ? (categoryNameById.get(m.expense_category_id) ?? NO_CATEGORY_LABEL) : NO_CATEGORY_LABEL;
          const subcategoryName = m.expense_subcategory_id ? subcategoryNameById.get(m.expense_subcategory_id) : undefined;

          return (
          <li
            key={m.id}
            className="flex items-center justify-between p-5 transition-colors hover:bg-muted"
          >
            <div>
              <p className="text-base font-medium text-foreground">{m.description || 'Sin descripción'}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(m.date).toLocaleDateString()} · {categoryName}{subcategoryName ? ` / ${subcategoryName}` : ''}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {m.is_adjustment && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Ajuste
                </span>
              )}
              <span className={`text-base font-bold ${m.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                {m.type === 'INCOME' ? '+' : '-'} S/ {(m.amount / 100).toFixed(2)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(m.id)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Eliminar
              </Button>
            </div>
          </li>
          );
        })}
      </ul>
    </Card>
  );
}
