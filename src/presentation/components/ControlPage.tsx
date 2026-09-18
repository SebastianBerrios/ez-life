'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import TaskList from './TaskList';
import HabitList from './HabitList';
import GoalList from './GoalList';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
  refreshKey?: number;
}

/**
 * Read-only tracking surface (FR-007): today's pending Tasks/Habits on top
 * (FR-008), active Goal progress below (FR-009). No creation control lives
 * here — that's CreatePage.tsx's job. Reuses TaskList/HabitList/GoalList as-is
 * for their existing tracking actions (mark done, complete, delete); this
 * component only decides the single unified empty state across all three,
 * since each of those already renders its own empty message individually.
 */
export default function ControlPage({ userId, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  const checkEmpty = useCallback(async () => {
    try {
      const [goals, tasks, habits] = await Promise.all([
        new LocalGoalRepository().getAll(userId),
        new LocalTaskRepository().getAll(userId),
        new LocalHabitRepository().getAll(userId),
      ]);
      setIsEmpty(goals.length === 0 && tasks.length === 0 && habits.length === 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkEmpty();
  }, [checkEmpty, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <Card className="animate-fade-slide-up py-10 text-center shadow-warm-sm">
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">Todavía no tenés metas, tareas ni hábitos.</p>
          <p className="text-sm text-muted-foreground">Andá a &quot;Crear&quot; para agregar el primero.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Hoy</h2>
        <TaskList userId={userId} />
        <HabitList userId={userId} />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Metas activas</h2>
        <GoalList userId={userId} />
      </div>
    </div>
  );
}
