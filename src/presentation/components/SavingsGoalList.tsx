'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { SavingsGoal } from '../../core/domain/models/types';
import { Progress } from '@/components/ui/progress';

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
        const currentAmount = allMoves
          .filter(m => m.type === 'EXPENSE' && m.savings_goal_id === goal.id)
          .reduce((acc, m) => acc + m.amount, 0);

        return { ...goal, currentAmount };
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

  if (loading) return <div className="text-center py-4 text-muted-foreground">Cargando...</div>;

  if (goals.length === 0) {
    return (
      <div className="text-center py-8 bg-card rounded-xl shadow-sm border border-border">
        <p className="text-muted-foreground">No tenés metas de ahorro registradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map(goal => {
        const progress = Math.min((goal.currentAmount / goal.target_amount) * 100, 100);
        const isExpired = goal.deadline && new Date(goal.deadline) < new Date() && progress < 100;

        return (
          <div key={goal.id} className="bg-card p-5 rounded-xl shadow-sm border border-border relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-foreground">{goal.name}</h3>
                {goal.deadline && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Límite: {new Date(goal.deadline).toLocaleDateString()}
                    {isExpired && <span className="text-destructive font-bold ml-2">Vencida</span>}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(goal.id)}
                className="text-destructive hover:text-destructive/80 text-sm font-medium"
              >
                Borrar
              </button>
            </div>

            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium">S/ {(goal.currentAmount / 100).toFixed(2)}</span>
                <span className="text-muted-foreground">de S/ {(goal.target_amount / 100).toFixed(2)}</span>
              </div>
              <Progress
                value={progress}
                className={isExpired ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
