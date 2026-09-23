'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { onSyncCompleted } from '../../infrastructure/sync/syncEvents';
import { Movement, DistributionCategory, ExpenseCategory, ExpenseSubcategory, Debt } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { calculateCategoryBreakdown } from '../../core/use-cases/calculateCategoryBreakdown';
import { calculateBudgets } from '../../core/use-cases/calculateBudgets';
import { compareMonthlyPeriods, PeriodComparison } from '../../core/use-cases/compareMonthlyPeriods';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  userId: string;
}

// Budget-proximity thresholds for the semaphore indicator (T008) — a
// presentation-only mapping of an already-computed percentage into 3 display
// buckets, same category as the pre-existing `isOver` boolean it replaces.
const WARNING_THRESHOLD_PERCENT = 80;

type BudgetStatus = 'ok' | 'warning' | 'over';

function budgetStatusFor(progressPercent: number): BudgetStatus {
  if (progressPercent > 100) return 'over';
  if (progressPercent >= WARNING_THRESHOLD_PERCENT) return 'warning';
  return 'ok';
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: 'Dentro del límite',
  warning: 'Cerca del límite',
  over: 'Presupuesto excedido',
};

const STATUS_DOT_CLASS: Record<BudgetStatus, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  over: 'bg-destructive',
};

const STATUS_PROGRESS_CLASS: Record<BudgetStatus, string> = {
  ok: '[&>div]:bg-emerald-500',
  warning: '[&>div]:bg-amber-500',
  over: '[&>div]:bg-destructive',
};

function formatDelta(cents: number): string {
  const sign = cents >= 0 ? '+' : '-';
  return `${sign} S/ ${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default function Dashboard({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [previousMovements, setPreviousMovements] = useState<Movement[]>([]);
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenseSubcategories, setExpenseSubcategories] = useState<ExpenseSubcategory[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refDate, setRefDate] = useState(() => new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const moveRepo = new LocalMovementRepository();
      const catRepo = new LocalCategoryRepository();
      const debtRepo = new LocalDebtRepository();

      const [start, end] = calculateMonthlyCycle(refDate);
      const previousRefDate = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
      const [prevStart, prevEnd] = calculateMonthlyCycle(previousRefDate);

      const [movesData, prevMovesData, catsData, expenseCatsData, debtsData] = await Promise.all([
        moveRepo.getAllByCycle(userId, start, end),
        moveRepo.getAllByCycle(userId, prevStart, prevEnd),
        catRepo.getDistributionCategories(userId),
        catRepo.getExpenseCategories(userId),
        debtRepo.getAll(userId),
      ]);

      const subcategoriesByCategory = await Promise.all(
        expenseCatsData.map(cat => catRepo.getSubcategories(cat.id))
      );

      setMovements(movesData);
      setPreviousMovements(prevMovesData);
      setDistCategories(catsData);
      setExpenseCategories(expenseCatsData);
      setExpenseSubcategories(subcategoriesByCategory.flat());
      setDebts(debtsData.filter(d => d.settled_amount < d.amount));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId, refDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-read local data once a sync cycle pulls new rows in (e.g. a movement
  // registered on another device) — a one-shot effect wouldn't otherwise
  // notice data that arrives after this component already rendered.
  useEffect(() => onSyncCompleted(loadData), [loadData]);

  const goToPreviousMonth = () => setRefDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goToNextMonth = () => setRefDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const cycleLabel = refDate.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const totalIncome = movements.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0);
  const totalExpense = movements.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0);
  const balance = totalIncome - totalExpense;

  const budgets = calculateBudgets(totalIncome, distCategories);

  const breakdown = calculateCategoryBreakdown(movements, distCategories, expenseCategories, expenseSubcategories);
  const chartData = breakdown
    .flatMap(bucket => bucket.categories)
    .filter(cat => cat.spent > 0)
    .map(cat => ({ name: cat.name, spent: cat.spent / 100 }));

  const comparison: PeriodComparison = compareMonthlyPeriods(movements, previousMovements);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <button type="button" onClick={goToPreviousMonth} aria-label="Mes anterior" className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-foreground capitalize">{cycleLabel}</span>
        <button type="button" onClick={goToNextMonth} aria-label="Mes siguiente" className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-primary rounded-2xl p-6 text-primary-foreground shadow-warm-md">
        <h2 className="font-heading text-sm font-medium opacity-80 mb-1">Balance del Mes</h2>
        <p className="text-4xl font-bold mb-6">S/ {(balance / 100).toFixed(2)}</p>

        <div className="flex justify-between border-t border-primary-foreground/20 pt-4">
          <div>
            <p className="text-sm opacity-80">Ingresos</p>
            <p className="text-base font-semibold">S/ {(totalIncome / 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">Egresos</p>
            <p className="text-base font-semibold">S/ {(totalExpense / 100).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-lg">Comparación con el mes anterior</CardTitle>
        </CardHeader>
        <CardContent>
          {!comparison.previous || !comparison.delta ? (
            <p className="text-sm text-muted-foreground">No hay datos del mes anterior para comparar todavía.</p>
          ) : (
            <div className="space-y-2" data-testid="period-comparison">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ingresos</span>
                <span className="font-medium text-foreground">{formatDelta(comparison.delta.income)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Egresos</span>
                <span className="font-medium text-foreground">{formatDelta(comparison.delta.expense)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-foreground">Balance</span>
                <span className="text-foreground">{formatDelta(comparison.delta.balance)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-lg">Distribución de gastos por categoría</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay gastos categorizados este mes todavía.</p>
          ) : (
            <div data-testid="category-breakdown-chart" className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `S/ ${Number(Array.isArray(value) ? value[0] : (value ?? 0)).toFixed(2)}`} />
                  <Bar dataKey="spent" fill="var(--color-primary, #6366f1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-lg">Presupuestos (50/30/20)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {distCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay categorías de distribución configuradas todavía.</p>
          ) : (
            budgets.map(cat => {
              const budget = cat.budget;
              const spentByBucket = breakdown.find(b => b.id === cat.id)?.spent ?? 0;

              const progress = budget > 0 ? (spentByBucket / budget) * 100 : 0;
              const status = budgetStatusFor(progress);

              return (
                <div key={cat.id}>
                  <div className="flex justify-between items-baseline text-sm mb-2">
                    <span className="font-medium text-base text-foreground flex items-center gap-2">
                      <span
                        data-testid={`budget-status-${cat.id}`}
                        aria-label={STATUS_LABEL[status]}
                        role="status"
                        className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT_CLASS[status]}`}
                      />
                      {cat.name} ({cat.percentage}%)
                    </span>
                    <span className="text-muted-foreground">S/ {(spentByBucket/100).toFixed(2)} de S/ {(budget/100).toFixed(2)}</span>
                  </div>
                  <Progress
                    value={Math.min(progress, 100)}
                    className={STATUS_PROGRESS_CLASS[status]}
                  />
                  {status === 'over' && <p className="text-sm text-destructive mt-1">¡Presupuesto excedido!</p>}
                  {status === 'warning' && <p className="text-sm text-amber-600 mt-1">Cerca del límite de presupuesto</p>}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-lg">Deudas activas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés deudas activas.</p>
          ) : (
            debts.map(debt => {
              const remaining = debt.amount - debt.settled_amount;
              const directionLabel = debt.direction === 'lent' ? 'Le prestaste a' : 'Te prestó';
              return (
                <div key={debt.id} className="flex justify-between items-center text-sm">
                  <span className="text-foreground">{directionLabel} {debt.counterparty_name}</span>
                  <span className="font-medium text-primary">S/ {(remaining / 100).toFixed(2)}</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
