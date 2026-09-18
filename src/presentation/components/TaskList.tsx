'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { Task } from '../../core/domain/models/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

// ControlPage's "hoy" agenda (FR-008) — same-calendar-day comparison done in
// UTC, consistent with how HabitCompletion/date-only fields are compared
// elsewhere (evaluateHabitStreak.ts), to avoid a local-timezone shift.
function isDueToday(dueDate: Date, today: Date): boolean {
  return dueDate.getUTCFullYear() === today.getUTCFullYear()
    && dueDate.getUTCMonth() === today.getUTCMonth()
    && dueDate.getUTCDate() === today.getUTCDate();
}

export default function TaskList({ userId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const repo = new LocalTaskRepository();
      const today = new Date();
      setTasks((await repo.getAll(userId)).filter(t => isDueToday(t.due_date, today)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleMarkDone = async (id: string) => {
    try {
      const repo = new LocalTaskRepository();
      await repo.markDone(id);
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta tarea?')) return;
    try {
      const repo = new LocalTaskRepository();
      await repo.delete(id);
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  if (tasks.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No tenés tareas pendientes.</p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-slide-up space-y-3">
      {tasks
        .slice()
        .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
        .map(task => (
          <Card key={task.id} className="shadow-warm-sm px-5 py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground">Vence: {new Date(task.due_date).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleMarkDone(task.id)}>Hecha</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)} className="text-destructive hover:bg-destructive/10">
                Borrar
              </Button>
            </div>
          </Card>
        ))}
    </div>
  );
}
