'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { Goal } from '../../core/domain/models/types';
import { calculateGoalProgress } from '../../core/use-cases/calculateGoalProgress';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

/**
 * Minimal goals dashboard (FR-007): every goal (including already-completed
 * ones) with its current progress — a full overview, unlike GoalList (used
 * in ControlPage's "Metas activas"), which deliberately excludes completed
 * goals.
 */
export default function GoalDashboard({ userId }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const repo = new LocalGoalRepository();
      setGoals(await repo.getAll(userId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="animate-fade-slide-up space-y-2">
      {goals.map(goal => {
        const isNumeric = goal.kind === 'numeric';
        const current = isNumeric ? (goal.current_value ?? 0) : (goal.milestones ?? []).filter(m => m.done).length;
        const target = isNumeric ? (goal.target_value ?? 1) : (goal.milestones ?? []).length || 1;
        const progress = calculateGoalProgress(goal);
        const progressPercent = Math.round(progress * 100);

        return (
          <Card key={goal.id} className="shadow-warm-sm px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{goal.name}</span>
              <span className="text-sm text-muted-foreground">{current} / {target}</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={progressPercent} className="flex-1" />
              <span className="text-xs font-medium text-muted-foreground">{`${progressPercent}%`}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
