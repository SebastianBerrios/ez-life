'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import TaskList from './TaskList';
import HabitList from './HabitList';
import GoalList from './GoalList';
import HabitDashboard from './HabitDashboard';
import TaskDashboard from './TaskDashboard';
import GoalDashboard from './GoalDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
  refreshKey?: number;
  /** FR-003: bumped by MainFlow when a habit/task is saved from the 'create' route — remounts the matching list here to refetch immediately. */
  habitsRefreshKey?: number;
  tasksRefreshKey?: number;
  /** FR-003: bumped by MainFlow when a Goal is saved from the 'create' route — remounts GoalList/GoalDashboard here. Not the same as `goalsRefreshKey` in MainFlow.tsx, which belongs to the unrelated SavingsGoal route. */
  goalsControlRefreshKey?: number;
}

/**
 * Read-only tracking surface (FR-007): today's pending Tasks/Habits on top
 * (FR-008), active Goal progress below (FR-009). No creation control lives
 * here — that's CreatePage.tsx's job. Reuses TaskList/HabitList/GoalList as-is
 * for their existing tracking actions (mark done, complete, delete); this
 * component only decides the single unified empty state across all three,
 * since each of those already renders its own empty message individually.
 */
export default function ControlPage({ userId, refreshKey, habitsRefreshKey, tasksRefreshKey, goalsControlRefreshKey }: Props) {
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
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <Card className="animate-fade-slide-up py-10 text-center shadow-none">
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">Todavía no tenés metas, tareas ni hábitos.</p>
          <p className="text-sm text-muted-foreground">Andá a &quot;Crear&quot; para agregar el primero.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4" data-testid="today-section">
        <h2 className="text-xl font-bold text-foreground">Hoy</h2>
        <TaskList key={`tasks-${tasksRefreshKey}`} userId={userId} />
        <HabitList key={`habits-${habitsRefreshKey}`} userId={userId} />
      </div>

      <div className="space-y-4" data-testid="active-goals-section">
        <h2 className="text-xl font-bold text-foreground">Metas activas</h2>
        <GoalList key={`goals-${goalsControlRefreshKey}`} userId={userId} />
      </div>

      {/* FR-005/FR-006/FR-007: minimal dashboard overview — full lists (including
          not-scheduled-today habits, any-due-date tasks, and completed goals),
          independent of the "hoy"/"activas" sections above. */}
      <div className="space-y-4" data-testid="habits-dashboard-section">
        <h2 className="text-xl font-bold text-foreground">Dashboard de hábitos</h2>
        <HabitDashboard key={`habits-dashboard-${habitsRefreshKey}`} userId={userId} />
      </div>

      <div className="space-y-4" data-testid="tasks-dashboard-section">
        <h2 className="text-xl font-bold text-foreground">Dashboard de tareas</h2>
        <TaskDashboard key={`tasks-dashboard-${tasksRefreshKey}`} userId={userId} />
      </div>

      <div className="space-y-4" data-testid="goals-dashboard-section">
        <h2 className="text-xl font-bold text-foreground">Dashboard de metas</h2>
        <GoalDashboard key={`goals-dashboard-${goalsControlRefreshKey}`} userId={userId} />
      </div>
    </div>
  );
}
