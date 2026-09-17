'use client';

import React, { useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { Movement, DistributionCategory, Debt } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { calculateSpentByBucket } from '../../core/use-cases/calculateCategoryBreakdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  userId: string;
}

export default function Dashboard({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refDate, setRefDate] = useState(() => new Date());

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const moveRepo = new LocalMovementRepository();
        const catRepo = new LocalCategoryRepository();
        const debtRepo = new LocalDebtRepository();

        const [start, end] = calculateMonthlyCycle(refDate);

        const [movesData, catsData, debtsData] = await Promise.all([
          moveRepo.getAllByCycle(userId, start, end),
          catRepo.getDistributionCategories(userId),
          debtRepo.getAll(userId),
        ]);

        setMovements(movesData);
        setDistCategories(catsData);
        setDebts(debtsData.filter(d => d.settled_amount < d.amount));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userId, refDate]);

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
          <CardTitle className="text-lg">Presupuestos (50/30/20)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {distCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay categorías de distribución configuradas todavía.</p>
          ) : (
            (() => {
              const spentByBucket = calculateSpentByBucket(movements, distCategories);
              return distCategories.map(cat => {
                const budget = Math.round(totalIncome * (cat.percentage / 100));
                const spent = spentByBucket[cat.id] ?? 0;

                const progress = budget > 0 ? (spent / budget) * 100 : 0;
                const isOver = progress > 100;

                return (
                  <div key={cat.id}>
                    <div className="flex justify-between items-baseline text-sm mb-2">
                      <span className="font-medium text-base text-foreground">{cat.name} ({cat.percentage}%)</span>
                      <span className="text-muted-foreground">S/ {(spent/100).toFixed(2)} de S/ {(budget/100).toFixed(2)}</span>
                    </div>
                    <Progress
                      value={Math.min(progress, 100)}
                      className={isOver ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}
                    />
                    {isOver && <p className="text-sm text-destructive mt-1">¡Presupuesto excedido!</p>}
                  </div>
                );
              });
            })()
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
