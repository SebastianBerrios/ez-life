'use client';

import React, { useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { Movement, DistributionCategory, ExpenseCategory, ExpenseSubcategory } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { calculateCategoryBreakdown } from '../../core/use-cases/calculateCategoryBreakdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  userId: string;
}

export default function AnalysisScreen({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ExpenseSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refDate, setRefDate] = useState(() => new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const moveRepo = new LocalMovementRepository();
        const catRepo = new LocalCategoryRepository();

        const [start, end] = calculateMonthlyCycle(refDate);

        const [movesData, buckets, expCats] = await Promise.all([
          moveRepo.getAllByCycle(userId, start, end),
          catRepo.getDistributionCategories(userId),
          catRepo.getExpenseCategories(userId),
        ]);

        const subsPerCategory = await Promise.all(expCats.map(c => catRepo.getSubcategories(c.id)));

        setMovements(movesData);
        setDistCategories(buckets);
        setExpenseCategories(expCats);
        setSubcategories(subsPerCategory.flat());
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

  const toggleCategory = (categoryId: string) => {
    setExpanded(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const breakdown = calculateCategoryBreakdown(movements, distCategories, expenseCategories, subcategories);
  const hasAnyCategory = breakdown.some(b => b.categories.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={goToPreviousMonth} aria-label="Mes anterior" className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-foreground capitalize">{cycleLabel}</span>
        <button type="button" onClick={goToNextMonth} aria-label="Mes siguiente" className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {!hasAnyCategory ? (
        <div className="text-center py-8 bg-card rounded-xl shadow-sm border border-border">
          <p className="text-muted-foreground">No hay categorías de gasto configuradas todavía.</p>
        </div>
      ) : (
        breakdown.map(bucket => (
          <Card key={bucket.id}>
            <CardHeader>
              <CardTitle className="text-base flex justify-between items-center">
                <span>{bucket.name} <span className="text-muted-foreground font-normal text-sm">({bucket.percentage}%)</span></span>
                <span className="text-base font-semibold">S/ {(bucket.spent / 100).toFixed(2)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bucket.categories.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin categorías de gasto en este bucket.</p>
              )}
              {bucket.categories.map(cat => (
                <div key={cat.id} className="border border-border rounded-xl p-3">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full min-h-11 flex items-center justify-between text-base"
                  >
                    <span className="font-medium text-foreground">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">S/ {(cat.spent / 100).toFixed(2)}</span>
                      {expanded[cat.id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {expanded[cat.id] && (
                    <ul className="mt-2 pl-3 space-y-1.5">
                      {cat.subcategories.map(sub => (
                        <li key={sub.id} className="flex justify-between text-sm text-muted-foreground">
                          <span>• {sub.name}</span>
                          <span>S/ {(sub.spent / 100).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
