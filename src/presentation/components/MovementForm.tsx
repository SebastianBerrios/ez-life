'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { calendarKey, parseCalendarDate } from '../../core/use-cases/calendar';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { validateBalanceAdjustment } from '../../core/use-cases/validateBalanceAdjustment';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory, SavingsGoal, Movement, IncomeSource } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
  movement?: Movement;
}

export default function MovementForm({ userId, onComplete, onCancel, movement }: Props) {
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>(movement?.type ?? 'EXPENSE');
  const [amount, setAmount] = useState<string>(movement ? (movement.amount / 100).toFixed(2) : '');
  const [description, setDescription] = useState<string>(movement?.description ?? '');
  const [date, setDate] = useState(calendarKey(movement?.date ?? new Date()));
  const [incomeSourceId, setIncomeSourceId] = useState(movement?.income_source_id ?? '');
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const submitting = useRef(false);

  // Distribution category (bucket) — filters which expense categories are selectable below.
  const [distCategoryId, setDistCategoryId] = useState<string>(movement?.distribution_category_id ?? '');
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);

  // Expense category + subcategory
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(movement?.expense_category_id ?? '');
  const [allExpenseCategories, setAllExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenseSubcategoryId, setExpenseSubcategoryId] = useState<string>(movement?.expense_subcategory_id ?? '');
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, ExpenseSubcategory[]>>({});

  // Savings goal
  const [savingsGoalId, setSavingsGoalId] = useState<string>(movement?.savings_goal_id ?? '');
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  const [isRecurring, setIsRecurring] = useState(movement?.is_recurring ?? false);
  const [isAdjustment, setIsAdjustment] = useState(movement?.is_adjustment ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  // Load all static data on mount.
  // IMPORTANT: distCategoryId/expenseCategoryId must be set BEFORE dataLoaded=true
  // so the Selects never render with an empty value (which would show the raw UUID).
  useEffect(() => {
    const loadData = async () => {
      const catRepo = new LocalCategoryRepository();
      const goalRepo = new LocalSavingsGoalRepository();

      const [cats, expCats, goals, sources] = await Promise.all([
        catRepo.getDistributionCategories(userId),
        catRepo.getExpenseCategories(userId),
        goalRepo.getAll(userId),
        new LocalIncomeSourceRepository().getAll(userId),
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
      setIncomeSources(sources);
      if (!movement?.income_source_id) setIncomeSourceId(sources[0]?.id ?? '');

      const firstBucket = cats.find(c => c.id === movement?.distribution_category_id) ?? cats[0];
      if (firstBucket && !movement) setDistCategoryId(firstBucket.id);
      const firstCategoryInBucket = selectableCats.find(c => c.distribution_category_id === firstBucket?.id);
      if (firstCategoryInBucket && !movement) setExpenseCategoryId(firstCategoryInBucket.id);
      setDataLoaded(true);
    };
    loadData();
  }, [userId, movement]);

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
    setSavingsGoalId('');
  };

  const handleExpenseCategoryChange = (id: string) => {
    setExpenseCategoryId(id);
    setExpenseSubcategoryId(''); // cascade reset
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;

    let amountInCents: number;
    try {
      amountInCents = parseMoney(amount);
      validateMovementAmount(amountInCents);
      parseCalendarDate(date);
    } catch (err) {
      if (err instanceof DomainError) {
        setAmountError(err.message);
      }
      return;
    }
    setAmountError(null);

    // A balance adjustment never carries a distribution/expense category
    // (FR-004, data-model.md) — computed once so validation and the saved
    // payload agree on the exact same values.
    const distributionCategoryId = !isAdjustment && type === 'EXPENSE' ? distCategoryId : undefined;
    const expenseCategoryIdToSave = !isAdjustment && type === 'EXPENSE' && expenseCategoryId ? expenseCategoryId : undefined;
    const expenseSubcategoryIdToSave = !isAdjustment && type === 'EXPENSE' && expenseSubcategoryId ? expenseSubcategoryId : undefined;

    try {
      validateBalanceAdjustment({
        is_adjustment: isAdjustment,
        description,
        distribution_category_id: distributionCategoryId,
        expense_category_id: expenseCategoryIdToSave,
        expense_subcategory_id: expenseSubcategoryIdToSave,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        setAdjustmentError(err.message);
      }
      return;
    }
    setAdjustmentError(null);

    submitting.current = true;
    setIsSubmitting(true);

    try {
      const repo = new LocalMovementRepository();

      await repo.save({
        id: movement?.id ?? '',
        user_id: userId,
        type,
        amount: amountInCents,
        date: parseCalendarDate(date),
        description,
        distribution_category_id: distributionCategoryId,
        expense_category_id: expenseCategoryIdToSave,
        expense_subcategory_id: expenseSubcategoryIdToSave,
        income_source_id: !isAdjustment && type === 'INCOME' ? incomeSourceId || undefined : undefined,
        savings_goal_id: !isAdjustment && type === 'EXPENSE' && selectedBucket?.is_savings && savingsGoalId ? savingsGoalId : undefined,
        is_recurring: isRecurring,
        is_adjustment: isAdjustment,
      });

      onComplete();
    } catch (err) {
      setAmountError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const selectedBucket = distCategories.find(c => c.id === distCategoryId);
  const showSavingsGoal =
    !isAdjustment &&
    type === 'EXPENSE' &&
    savingsGoals.length > 0 &&
    selectedBucket?.is_savings === true;

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">{movement ? 'Editar Movimiento' : 'Registrar Movimiento'}</h2>
      <form onSubmit={handleSubmit} data-testid="movement-form" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="movement-date">Fecha</Label>
            <Input id="movement-date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {type === 'INCOME' && !isAdjustment && <div className="space-y-2">
            <Label htmlFor="income-source">Fuente de ingreso</Label>
            <Select value={incomeSourceId} onValueChange={value => setIncomeSourceId(value ?? '')} required>
              <SelectTrigger id="income-source"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
              <SelectContent>{incomeSources.map(source => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent>
            </Select>
            {dataLoaded && incomeSources.length === 0 && <p className="text-sm text-muted-foreground">Agregá una fuente de ingreso desde Ajustes.</p>}
          </div>}
          {/* Type toggle — visual tab style */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={`h-11 px-3 rounded-lg text-base font-medium transition-colors ${
                  type === 'EXPENSE'
                    ? 'bg-card text-foreground shadow-none'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={`h-11 px-3 rounded-lg text-base font-medium transition-colors ${
                  type === 'INCOME'
                    ? 'bg-card text-foreground shadow-none'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ingreso
              </button>
            </div>
          </div>

          {/* Balance adjustment toggle — when active, hides category/subcategory
              selectors (they never apply to an adjustment, FR-004) and makes
              the description mandatory (FR-002, validateBalanceAdjustment). */}
          <div className="flex items-center space-x-2">
            <input
              id="isAdjustment"
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={isAdjustment}
              onChange={(e) => {
                setIsAdjustment(e.target.checked);
                setAdjustmentError(null);
              }}
            />
            <Label htmlFor="isAdjustment" className="cursor-pointer">
              Es un ajuste de balance
            </Label>
          </div>

          {/* Distribution category — first level of the cascade, filters the category list below */}
          {type === 'EXPENSE' && !isAdjustment && (
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
                <Skeleton className="h-11 w-full rounded-xl" />
              )}
            </div>
          )}

          {/* Expense category — cascaded, filtered by the selected bucket */}
          {type === 'EXPENSE' && !isAdjustment && (
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
                <Skeleton className="h-11 w-full rounded-xl" />
              )}
              {dataLoaded && expenseCategories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Esta categoría todavía no tiene categorías de gasto con subcategorías. Agregalas desde Ajustes.
                </p>
              )}
            </div>
          )}

          {/* Expense subcategory — enabled only when a category is selected */}
          {type === 'EXPENSE' && !isAdjustment && expenseCategoryId && (
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
                <Skeleton className="h-11 w-full rounded-xl" />
              )}
            </div>
          )}

          {/* Savings goal — shown when the selected bucket is flagged as the savings bucket */}
          {showSavingsGoal && dataLoaded && (
            <div className="space-y-2">
              <Label htmlFor="savingsGoal">Meta de Ahorro (Opcional)</Label>
              <Select value={savingsGoalId} onValueChange={(val) => setSavingsGoalId(val === 'unassigned' ? '' : val || '')}>
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

          <details open={isAdjustment || Boolean(movement?.description || movement?.is_recurring)} className="border-t border-border pt-2">
            <summary className="text-sm font-medium">{isAdjustment ? 'Motivo obligatorio del ajuste' : 'Opciones adicionales'}</summary>
            <div className="space-y-4 pt-3">
          {/* Description — mandatory motive when isAdjustment is active (FR-002) */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {isAdjustment ? 'Motivo del ajuste' : 'Descripción'}
            </Label>
            <Input
              type="text"
              id="description"
              placeholder={isAdjustment ? 'Ej. Reembolso extraordinario' : 'Ej. Cena familiar'}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (adjustmentError) setAdjustmentError(null);
              }}
            />
            {adjustmentError && (
              <p className="text-sm text-destructive">{adjustmentError}</p>
            )}
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

            </div>
          </details>

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
    </div>
  );
}
