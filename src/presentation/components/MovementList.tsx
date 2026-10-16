'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { Movement } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import MovementForm from './MovementForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { onLocalChanges } from '../../infrastructure/db/localChanges';

interface Props {
  userId: string;
}

const NO_CATEGORY_LABEL = 'Sin categoría';

export default function MovementList({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categoryNameById, setCategoryNameById] = useState<Map<string, string>>(new Map());
  const [subcategoryNameById, setSubcategoryNameById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Movement | undefined>();
  const [error, setError] = useState('');

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
    return onLocalChanges(['movements', 'expense_categories', 'expense_subcategories'], loadMovements);
  }, [loadMovements]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este movimiento?')) return;
    try {
      const repo = new LocalMovementRepository();
      await repo.delete(id, userId);
      await loadMovements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
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
      <Card className="animate-fade-slide-up py-8 text-center shadow-none">
        <p className="text-muted-foreground">No hay movimientos en este mes.</p>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-slide-up overflow-hidden py-0 shadow-none">
      {error && <p role="alert" className="text-destructive p-4">{error}</p>}
      <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(undefined); }}>
        <DialogContent>{editing && <MovementForm userId={userId} movement={editing} onCancel={() => setEditing(undefined)} onComplete={() => { setEditing(undefined); loadMovements(); }} />}</DialogContent>
      </Dialog>
      <ul className="divide-y divide-border">
        {movements.map(m => {
          const categoryName = m.expense_category_id ? (categoryNameById.get(m.expense_category_id) ?? NO_CATEGORY_LABEL) : NO_CATEGORY_LABEL;
          const subcategoryName = m.expense_subcategory_id ? subcategoryNameById.get(m.expense_subcategory_id) : undefined;

          return (
          <li
            key={m.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground break-words">{m.description || 'Sin descripción'}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(m.date).toLocaleDateString()} · {categoryName}{subcategoryName ? ` / ${subcategoryName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {m.is_adjustment && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Ajuste
                </span>
              )}
              <span className={`text-sm font-semibold tabular-nums ${m.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                {m.type === 'INCOME' ? '+' : '-'} S/ {(m.amount / 100).toFixed(2)}
              </span>
              {!m.is_linked && !m.shared_movement_id && !m.installment_payment_id && <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>Editar</Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(m.id)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Eliminar
              </Button>
              </>}
            </div>
          </li>
          );
        })}
      </ul>
    </Card>
  );
}
