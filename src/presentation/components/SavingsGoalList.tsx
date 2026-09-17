'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { SavingsGoal } from '../../core/domain/models/types';
import { calculateSavingsGoalProgress } from '../../core/use-cases/calculateSavingsGoalProgress';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

interface GoalWithProgress extends SavingsGoal {
  currentAmount: number;
}

export default function SavingsGoalList({ userId }: Props) {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    try {
      const goalRepo = new LocalSavingsGoalRepository();
      const moveRepo = new LocalMovementRepository();

      const [allGoals, allMoves] = await Promise.all([
        goalRepo.getAll(userId),
        moveRepo.getAll(userId) // we need all time movements for goals, not just current cycle
      ]);

      const goalsWithProgress = allGoals.map(goal => {
        const { currentAmountCents } = calculateSavingsGoalProgress(goal, allMoves);
        return { ...goal, currentAmount: currentAmountCents };
      });

      setGoals(goalsWithProgress);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta meta?')) return;
    try {
      const repo = new LocalSavingsGoalRepository();
      await repo.delete(id);
      await loadGoals();
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No tenés metas de ahorro registradas.</p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-slide-up space-y-4">
      {goals.map(goal => {
        const progress = Math.min((goal.currentAmount / goal.target_amount) * 100, 100);
        const isExpired = goal.deadline && new Date(goal.deadline) < new Date() && progress < 100;

        return (
          <Card key={goal.id} className="relative shadow-warm-sm">
            <div className="flex items-start justify-between px-5">
              <div>
                <h3 className="font-heading font-bold text-foreground">{goal.name}</h3>
                {goal.deadline && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Límite: {new Date(goal.deadline).toLocaleDateString()}
                    {isExpired && <span className="text-destructive font-bold ml-2">Vencida</span>}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(goal.id)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Borrar
              </Button>
            </div>

            <div className="mt-4 space-y-1 px-5">
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium">S/ {(goal.currentAmount / 100).toFixed(2)}</span>
                <span className="text-muted-foreground">de S/ {(goal.target_amount / 100).toFixed(2)}</span>
              </div>
              <Progress
                value={progress}
                className={isExpired ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
