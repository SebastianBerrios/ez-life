'use client';

import React, { useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { Movement, DistributionCategory } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';

interface Props {
  userId: string;
}

export default function Dashboard({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const moveRepo = new LocalMovementRepository();
        const catRepo = new LocalCategoryRepository();
        
        const [start, end] = calculateMonthlyCycle(new Date());
        
        const [movesData, catsData] = await Promise.all([
          moveRepo.getAllByCycle(userId, start, end),
          catRepo.getDistributionCategories(userId)
        ]);
        
        setMovements(movesData);
        setDistCategories(catsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userId]);

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
      <div className="bg-primary rounded-2xl p-6 text-primary-foreground shadow-lg">
        <h2 className="text-sm font-medium opacity-80 mb-1">Balance del Mes</h2>
        <p className="text-4xl font-bold mb-6">S/ {(balance / 100).toFixed(2)}</p>
        
        <div className="flex justify-between border-t border-primary-foreground/20 pt-4">
          <div>
            <p className="text-xs opacity-80">Ingresos</p>
            <p className="text-sm font-semibold">S/ {(totalIncome / 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs opacity-80">Egresos</p>
            <p className="text-sm font-semibold">S/ {(totalExpense / 100).toFixed(2)}</p>
          </div>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Presupuestos (50/30/20)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {distCategories.map(cat => {
            const budget = Math.round(totalIncome * (cat.percentage / 100));
            const spent = movements
              .filter(m => m.type === 'EXPENSE' && m.distribution_category_id === cat.id)
              .reduce((acc, m) => acc + m.amount, 0);
              
            const progress = budget > 0 ? (spent / budget) * 100 : 0;
            const isOver = progress > 100;
            
            return (
              <div key={cat.id}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{cat.name} ({cat.percentage}%)</span>
                  <span className="text-muted-foreground">S/ {(spent/100).toFixed(2)} de S/ {(budget/100).toFixed(2)}</span>
                </div>
                <Progress 
                  value={Math.min(progress, 100)} 
                  className={isOver ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'} 
                />
                {isOver && <p className="text-xs text-destructive mt-1">¡Presupuesto excedido!</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
