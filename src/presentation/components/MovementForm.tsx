'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory, SavingsGoal } from '../../core/domain/models/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function MovementForm({ userId, onComplete, onCancel }: Props) {
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Distribution category (bucket) — filters which expense categories are selectable below.
  const [distCategoryId, setDistCategoryId] = useState<string>('');
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);

  // Expense category + subcategory
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('');
  const [allExpenseCategories, setAllExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenseSubcategoryId, setExpenseSubcategoryId] = useState<string>('');
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, ExpenseSubcategory[]>>({});

  // Savings goal
  const [savingsGoalId, setSavingsGoalId] = useState<string>('');
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Load all static data on mount.
  // IMPORTANT: distCategoryId/expenseCategoryId must be set BEFORE dataLoaded=true
  // so the Selects never render with an empty value (which would show the raw UUID).
  useEffect(() => {
    const loadData = async () => {
      const catRepo = new LocalCategoryRepository();
      const goalRepo = new LocalSavingsGoalRepository();

      const [cats, expCats, goals] = await Promise.all([
        catRepo.getDistributionCategories(userId),
        catRepo.getExpenseCategories(userId),
        goalRepo.getAll(userId),
      ]);

      const subsEntries = await Promise.all(
        expCats.map(async (c) => [c.id, await catRepo.getSubcategories(c.id)] as const)
      );
      const subsMap = Object.fromEntries(subsEntries);

      // A category with no subcategories yet has nothing to classify a movement
      // under — keep it out of the picker until it has at least one.
      const selectableCats = expCats.filter(c => (subsMap[c.id]?.length ?? 0) > 0);

      setDistCategories(cats);
      setAllExpenseCategories(selectableCats);
      setSubcategoriesByCategory(subsMap);
      setSavingsGoals(goals);

      const firstBucket = cats[0];
      if (firstBucket) setDistCategoryId(firstBucket.id);
      const firstCategoryInBucket = selectableCats.find(c => c.distribution_category_id === firstBucket?.id);
      if (firstCategoryInBucket) setExpenseCategoryId(firstCategoryInBucket.id);
      setDataLoaded(true);
    };
    loadData();
  }, [userId]);

  const expenseCategories = useMemo(
    () => allExpenseCategories.filter(c => c.distribution_category_id === distCategoryId),
    [allExpenseCategories, distCategoryId]
  );

  const subcategories = useMemo(
    () => subcategoriesByCategory[expenseCategoryId] ?? [],
    [subcategoriesByCategory, expenseCategoryId]
  );

  const handleDistCategoryChange = (id: string) => {
    setDistCategoryId(id);
    const nextCategories = allExpenseCategories.filter(c => c.distribution_category_id === id);
    setExpenseCategoryId(nextCategories[0]?.id ?? '');
    setExpenseSubcategoryId('');
  };

  const handleExpenseCategoryChange = (id: string) => {
    setExpenseCategoryId(id);
    setExpenseSubcategoryId(''); // cascade reset
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountInCents = Math.round(parseFloat(amount.replace(/,/g, '')) * 100);
    try {
      validateMovementAmount(amountInCents);
    } catch (err) {
      if (err instanceof DomainError) {
        setAmountError(err.message);
      }
      return;
    }
    setAmountError(null);

    setIsSubmitting(true);

    try {
      const repo = new LocalMovementRepository();

      await repo.save({
        id: '',
        user_id: userId,
        type,
        amount: amountInCents,
        date: new Date(),
        description,
        distribution_category_id: type === 'EXPENSE' ? distCategoryId : undefined,
        expense_category_id: type === 'EXPENSE' && expenseCategoryId ? expenseCategoryId : undefined,
        expense_subcategory_id: type === 'EXPENSE' && expenseSubcategoryId ? expenseSubcategoryId : undefined,
        savings_goal_id: type === 'EXPENSE' && savingsGoalId ? savingsGoalId : undefined,
        is_recurring: isRecurring,
      });

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBucket = distCategories.find(c => c.id === distCategoryId);
  const showSavingsGoal =
    type === 'EXPENSE' &&
    savingsGoals.length > 0 &&
    selectedBucket?.is_savings === true;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Registrar Movimiento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} data-testid="movement-form" className="space-y-5">
          {/* Type toggle — visual tab style */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={`h-11 px-3 rounded-lg text-base font-medium transition-colors ${
                  type === 'EXPENSE'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                💸 Gasto
              </button>
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={`h-11 px-3 rounded-lg text-base font-medium transition-colors ${
                  type === 'INCOME'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                💰 Ingreso
              </button>
            </div>
          </div>

          {/* Distribution category — first level of the cascade, filters the category list below */}
          {type === 'EXPENSE' && (
            <div className="space-y-2">
              <Label htmlFor="distCat">Categoría (50/30/20)</Label>
              {dataLoaded ? (
                <Select value={distCategoryId} onValueChange={(val) => handleDistCategoryChange(val || '')} required>
                  <SelectTrigger id="distCat">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {distCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-11 bg-muted rounded-xl animate-pulse" />
              )}
            </div>
          )}

          {/* Expense category — cascaded, filtered by the selected bucket */}
          {type === 'EXPENSE' && (
            <div className="space-y-2">
              <Label htmlFor="expenseCat">Categoría de gasto</Label>
              {dataLoaded ? (
                <Select
                  value={expenseCategoryId}
                  onValueChange={(val) => handleExpenseCategoryChange(val || '')}
                >
                  <SelectTrigger id="expenseCat">
                    <SelectValue placeholder="Seleccionar categoría de gasto" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-11 bg-muted rounded-xl animate-pulse" />
              )}
              {dataLoaded && expenseCategories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Esta categoría todavía no tiene categorías de gasto con subcategorías. Agregalas desde Ajustes.
                </p>
              )}
            </div>
          )}

          {/* Expense subcategory — enabled only when a category is selected */}
          {type === 'EXPENSE' && expenseCategoryId && (
            <div className="space-y-2">
              <Label htmlFor="expenseSubcat">Subcategoría</Label>
              {dataLoaded ? (
                <Select
                  value={expenseSubcategoryId}
                  onValueChange={(val) => setExpenseSubcategoryId(val || '')}
                >
                  <SelectTrigger id="expenseSubcat">
                    <SelectValue placeholder="Seleccionar subcategoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-11 bg-muted rounded-xl animate-pulse" />
              )}
            </div>
          )}

          {/* Savings goal — shown when the selected bucket is flagged as the savings bucket */}
          {showSavingsGoal && dataLoaded && (
            <div className="space-y-2">
              <Label htmlFor="savingsGoal">Meta de Ahorro (Opcional)</Label>
              <Select value={savingsGoalId} onValueChange={(val) => setSavingsGoalId(val || '')}>
                <SelectTrigger id="savingsGoal">
                  <SelectValue placeholder="— Sin asignar —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">— Sin asignar —</SelectItem>
                  {savingsGoals.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Monto</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-muted-foreground text-base font-medium">S/</span>
              </div>
              <Input
                type="text"
                id="amount"
                required
                className="pl-9"
                placeholder="0.00"
                value={amount}
                onFocus={() => {
                  if (amount) setAmount(amount.replace(/,/g, ''));
                }}
                onBlur={() => {
                  if (amount && !isNaN(Number(amount))) {
                    setAmount(
                      Number(amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    );
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setAmount(val);
                  if (amountError) setAmountError(null);
                }}
              />
            </div>
            {amountError && (
              <p className="text-sm text-destructive">{amountError}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              type="text"
              id="description"
              placeholder="Ej. Cena familiar"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center space-x-2">
            <input
              id="isRecurring"
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <Label htmlFor="isRecurring" className="cursor-pointer">
              Es un gasto fijo (recurrente cada mes)
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
