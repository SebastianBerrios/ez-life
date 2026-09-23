'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { Task } from '../../core/domain/models/types';
import { calculateTaskCompletionStats } from '../../core/use-cases/calculateTaskCompletionStats';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  userId: string;
}

const STATS_COLOR = { onTime: '#10b981', overdue: '#ef4444', pending: '#f59e0b' } as const;

/**
 * Tasks dashboard (FR-006, extended in 004 with FR-005's on-time vs. overdue
 * chart driven by `calculateTaskCompletionStats`). Uses
 * `ITaskRepository.getAllIncludingDone` instead of `getAll` (which only ever
 * returns pending tasks by design — a done task is archived out of the
 * active list, FR-021 spec 001) so completed tasks are actually reachable
 * here as "Hecha".
 */
export default function TaskDashboard({ userId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const repo = new LocalTaskRepository();
      setTasks(await repo.getAllIncludingDone(userId));
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

  if (tasks.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No tenés tareas registradas.</p>
      </Card>
    );
  }

  const stats = calculateTaskCompletionStats(tasks, new Date());
  // "Por vencer" (not "Pendientes") on purpose — it must stay textually
  // distinct from each task row's own "Pendiente" status label below, so
  // /pendiente/i queries in tests keep matching exactly one thing.
  const chartData = [
    { name: 'A tiempo', count: stats.onTime, fill: STATS_COLOR.onTime },
    { name: 'Vencidas', count: stats.overdue, fill: STATS_COLOR.overdue },
    { name: 'Por vencer', count: stats.pending, fill: STATS_COLOR.pending },
  ];

  return (
    <div className="animate-fade-slide-up space-y-4">
      <Card className="shadow-warm-sm px-4 py-3 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">A tiempo: {stats.onTime}</span>
          <span className="text-muted-foreground">Vencidas: {stats.overdue}</span>
          <span className="text-muted-foreground">Por vencer: {stats.pending}</span>
        </div>
        <div data-testid="task-completion-chart" className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count">
                {chartData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="space-y-2">
        {tasks.map(task => (
          <Card key={task.id} className="shadow-warm-sm px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{task.title}</span>
            <span className="text-sm text-muted-foreground">{task.status === 'done' ? 'Hecha' : 'Pendiente'}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
