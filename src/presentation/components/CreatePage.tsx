'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { Goal, Habit, Task } from '../../core/domain/models/types';
import GoalForm from './GoalForm';
import TaskForm from './TaskForm';
import HabitForm from './HabitForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

// Same chrome as the app's other centered dialogs (MainFlow.tsx) — a create
// or edit form is a focused, modal action, never a bottom sheet.
const DIALOG_CONTENT_CLASS =
  'bg-card max-w-md rounded-2xl border border-border p-5 shadow-xl max-h-[85vh] overflow-y-auto sm:p-6';

/**
 * Create-and-edit surface (FR-005, FR-006) for Goal/Task/Habit — the
 * counterpart to ControlPage.tsx, which is read-only tracking. Each section
 * lists existing items with an "Editar" action (no tracking actions like
 * mark-done/complete here, that belongs to ControlPage/TaskList/HabitList).
 */
export default function CreatePage({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [goalDialog, setGoalDialog] = useState<{ open: boolean; existing?: Goal }>({ open: false });
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; existing?: Task }>({ open: false });
  const [habitDialog, setHabitDialog] = useState<{ open: boolean; existing?: Habit }>({ open: false });

  const load = useCallback(async () => {
    try {
      const [goalsData, tasksData, habitsData] = await Promise.all([
        new LocalGoalRepository().getAll(userId),
        new LocalTaskRepository().getAll(userId),
        new LocalHabitRepository().getAll(userId),
      ]);
      setGoals(goalsData);
      setTasks(tasksData);
      setHabits(habitsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Metas</h2>
          <Button size="sm" onClick={() => setGoalDialog({ open: true })}>+ Nueva meta</Button>
        </div>
        {goals.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted-foreground shadow-warm-sm">No tenés metas todavía.</Card>
        ) : (
          <div className="space-y-2">
            {goals.map(goal => (
              <Card key={goal.id} className="shadow-warm-sm px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{goal.name}</span>
                <Button variant="outline" size="sm" onClick={() => setGoalDialog({ open: true, existing: goal })}>Editar</Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Tareas</h2>
          <Button size="sm" onClick={() => setTaskDialog({ open: true })}>+ Nueva tarea</Button>
        </div>
        {tasks.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted-foreground shadow-warm-sm">No tenés tareas todavía.</Card>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <Card key={task.id} className="shadow-warm-sm px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{task.title}</span>
                <Button variant="outline" size="sm" onClick={() => setTaskDialog({ open: true, existing: task })}>Editar</Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Hábitos</h2>
          <Button size="sm" onClick={() => setHabitDialog({ open: true })}>+ Nuevo hábito</Button>
        </div>
        {habits.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted-foreground shadow-warm-sm">No tenés hábitos todavía.</Card>
        ) : (
          <div className="space-y-2">
            {habits.map(habit => (
              <Card key={habit.id} className="shadow-warm-sm px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{habit.name}</span>
                <Button variant="outline" size="sm" onClick={() => setHabitDialog({ open: true, existing: habit })}>Editar</Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={goalDialog.open} onOpenChange={(open) => !open && setGoalDialog({ open: false })}>
        <DialogContent className={DIALOG_CONTENT_CLASS}>
          <GoalForm
            userId={userId}
            existing={goalDialog.existing}
            onComplete={() => { setGoalDialog({ open: false }); setRefreshKey(k => k + 1); }}
            onCancel={() => setGoalDialog({ open: false })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialog.open} onOpenChange={(open) => !open && setTaskDialog({ open: false })}>
        <DialogContent className={DIALOG_CONTENT_CLASS}>
          <TaskForm
            userId={userId}
            existing={taskDialog.existing}
            onComplete={() => { setTaskDialog({ open: false }); setRefreshKey(k => k + 1); }}
            onCancel={() => setTaskDialog({ open: false })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={habitDialog.open} onOpenChange={(open) => !open && setHabitDialog({ open: false })}>
        <DialogContent className={DIALOG_CONTENT_CLASS}>
          <HabitForm
            userId={userId}
            existing={habitDialog.existing}
            onComplete={() => { setHabitDialog({ open: false }); setRefreshKey(k => k + 1); }}
            onCancel={() => setHabitDialog({ open: false })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
