'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { Goal } from '../../core/domain/models/types';
import { calculateGoalProgress } from '../../core/use-cases/calculateGoalProgress';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { onSyncCompleted } from '../../infrastructure/sync/syncEvents';

interface Props {
  userId: string;
}

/**
 * Minimal goals dashboard (FR-007): every goal (including already-completed
 * ones) with its current progress — a full overview, unlike the "Metas activas"
 * panel, which deliberately excludes completed goals.
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

  // Keep the overview in step with checks, edits and sync while the section stays open.
  useEffect(() => onLocalChanges(['goals'], () => { void load(); }), [load]);
  useEffect(() => onSyncCompleted(() => { void load(); }), [load]);

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  if (goals.length === 0) {
    return <p className="rounded-lg border border-dashed border-border-strong p-4 text-body-md text-muted-foreground">No tienes metas registradas.</p>;
  }

  return (
    <ul className="space-y-2">
      {goals.map(goal => {
        const isNumeric = goal.kind === 'numeric';
        const current = isNumeric ? (goal.current_value ?? 0) : (goal.milestones ?? []).filter(m => m.done).length;
        const target = isNumeric ? (goal.target_value ?? 1) : (goal.milestones ?? []).length || 1;
        const progress = calculateGoalProgress(goal);
        const progressPercent = Math.round(progress * 100);

        return (
          <li key={goal.id} className="space-y-2 rounded-lg bg-surface-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 break-words text-body-md font-medium text-foreground">{goal.name}</span>
              <span className="shrink-0 font-mono text-label-mono-sm text-muted-foreground">{current} / {target}</span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={progressPercent} aria-label={`Progreso de ${goal.name}`} className="flex-1" />
              <span className="font-mono text-label-mono-xs text-muted-foreground">{`${progressPercent}%`}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
