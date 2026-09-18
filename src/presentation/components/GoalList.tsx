'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { Goal } from '../../core/domain/models/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

export default function GoalList({ userId }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    try {
      const repo = new LocalGoalRepository();
      // ControlPage shows "Metas activas" (FR-009) — a completed goal has
      // nothing left to track here.
      setGoals((await repo.getAll(userId)).filter(g => g.status !== 'completed'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleIncrement = async (goal: Goal) => {
    try {
      const repo = new LocalGoalRepository();
      await repo.updateProgress(goal.id, { currentValue: (goal.current_value ?? 0) + 1 });
      await loadGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMilestone = async (goal: Goal, milestoneId: string, done: boolean) => {
    try {
      const repo = new LocalGoalRepository();
      await repo.updateProgress(goal.id, { milestoneId, done });
      await loadGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta meta?')) return;
    try {
      const repo = new LocalGoalRepository();
      await repo.delete(id);
      await loadGoals();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (goals.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No tenés metas registradas.</p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-slide-up space-y-4">
      {goals.map(goal => (
        <Card key={goal.id} className="shadow-warm-sm px-5 py-4">
          <div className="flex items-start justify-between">
            <h3 className="font-heading font-bold text-foreground">{goal.name}</h3>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(goal.id)} className="text-destructive hover:bg-destructive/10">
              Borrar
            </Button>
          </div>

          {goal.kind === 'numeric' && (
            <div className="mt-3 space-y-2">
              <Progress value={Math.min(((goal.current_value ?? 0) / (goal.target_value ?? 1)) * 100, 100)} />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {goal.current_value ?? 0} / {goal.target_value}
                </span>
                {goal.status !== 'completed' && (
                  <Button size="sm" onClick={() => handleIncrement(goal)}>+1</Button>
                )}
              </div>
            </div>
          )}

          {goal.kind === 'checklist' && (
            <ul className="mt-3 space-y-1">
              {(goal.milestones ?? []).map(m => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={m.done}
                    onChange={(e) => handleToggleMilestone(goal, m.id, e.target.checked)}
                  />
                  <span className={m.done ? 'line-through text-muted-foreground' : ''}>{m.label}</span>
                </li>
              ))}
            </ul>
          )}

          {goal.status === 'completed' && (
            <p className="mt-3 text-sm text-primary font-medium">¡Completada! 🎉</p>
          )}
        </Card>
      ))}
    </div>
  );
}
