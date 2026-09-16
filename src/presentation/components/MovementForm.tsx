'use client';

import React, { useState, useEffect } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
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

  // Distribution category
  const [distCategoryId, setDistCategoryId] = useState<string>('');
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);

  // Expense category + subcategory
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('');
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenseSubcategoryId, setExpenseSubcategoryId] = useState<string>('');
  const [subcategories, setSubcategories] = useState<ExpenseSubcategory[]>([]);

  // Savings goal
  const [savingsGoalId, setSavingsGoalId] = useState<string>('');
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load all static data on mount.
  // IMPORTANT: distCategoryId must be set BEFORE dataLoaded=true so the Select
  // never renders with an empty value (which would show the raw UUID).
  useEffect(() => {
    const loadData = async () => {
      const catRepo = new LocalCategoryRepository();
      const goalRepo = new LocalSavingsGoalRepository();

      const [cats, expCats, goals] = await Promise.all([
        catRepo.getDistributionCategories(userId),
        catRepo.getExpenseCategories(userId),
        goalRepo.getAll(userId),
      ]);

      setDistCategories(cats);
      setExpenseCategories(expCats);
      setSavingsGoals(goals);
      // Set selected values BEFORE enabling Select render
      if (cats.length > 0) setDistCategoryId(cats[0].id);
      if (expCats.length > 0) setExpenseCategoryId(expCats[0].id);
      setDataLoaded(true);
    };
    loadData();
  }, [userId]);

  // Load subcategories whenever the selected expense category changes.
  useEffect(() => {
    if (!expenseCategoryId) {
      setSubcategories([]);
      return;
    }
    const catRepo = new LocalCategoryRepository();
    catRepo.getSubcategories(expenseCategoryId).then(setSubcategories);
  }, [expenseCategoryId]);

  const handleExpenseCategoryChange = (id: string) => {
    setExpenseCategoryId(id);
    setExpenseSubcategoryId(''); // cascade reset
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const repo = new LocalMovementRepository();
      const amountInCents = Math.round(parseFloat(amount.replace(/,/g, '')) * 100);

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

  const selectedCategory = distCategories.find(c => c.id === distCategoryId);
  const showSavingsGoal =
    type === 'EXPENSE' &&
    savingsGoals.length > 0 &&
    selectedCategory?.name.toLowerCase().includes('ahorro');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Registrar Movimiento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} data-testid="movement-form" className="space-y-4">
          {/* Type toggle — visual tab style */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
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
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  type === 'INCOME'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                💰 Ingreso
              </button>
            </div>
          </div>

          {/* Distribution category — only render Select once data is loaded to avoid UUID flash */}
          {type === 'EXPENSE' && (
            <div className="space-y-2">
              <Label htmlFor="distCat">Categoría (50/30/20)</Label>
              {dataLoaded ? (
                <Select value={distCategoryId} onValueChange={(val) => setDistCategoryId(val || '')} required>
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
                <div className="h-10 bg-muted rounded-xl animate-pulse" />
              )}
            </div>
          )}

          {/* Expense category — cascaded, only for EXPENSE type */}
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
                <div className="h-10 bg-muted rounded-xl animate-pulse" />
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
                <div className="h-10 bg-muted rounded-xl animate-pulse" />
              )}
            </div>
          )}

          {/* Savings goal */}
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
                <span className="text-muted-foreground text-sm font-medium">S/</span>
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
                }}
              />
            </div>
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
