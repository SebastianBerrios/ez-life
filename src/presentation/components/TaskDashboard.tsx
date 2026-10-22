'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { Task } from '../../core/domain/models/types';
import { calculateTaskCompletionStats } from '../../core/use-cases/calculateTaskCompletionStats';
import { Skeleton } from '@/components/ui/skeleton';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { onSyncCompleted } from '../../infrastructure/sync/syncEvents';
import { useChartColors } from '../hooks/useChartColors';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  userId: string;
}

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
  const colors = useChartColors();

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

  // Keep the overview in step with checks, edits and sync while the section stays open.
  useEffect(() => onLocalChanges(['tasks'], () => { void load(); }), [load]);
  useEffect(() => onSyncCompleted(() => { void load(); }), [load]);

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  if (tasks.length === 0) {
    return <p className="rounded-lg border border-dashed border-border-strong p-4 text-body-md text-muted-foreground">No tienes tareas registradas.</p>;
  }

  const stats = calculateTaskCompletionStats(tasks, new Date());
  // "Por vencer" (not "Pendientes") on purpose — it must stay textually
  // distinct from each task row's own "Pendiente" status label below, so
  // /pendiente/i queries in tests keep matching exactly one thing.
  const chartData = [
    { name: 'A tiempo', count: stats.onTime, fill: colors.primary },
    { name: 'Vencidas', count: stats.overdue, fill: colors.expense },
    { name: 'Por vencer', count: stats.pending, fill: colors.warning },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-lg bg-surface-2 p-4">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-label-mono-sm text-muted-foreground">
          <span>A tiempo: {stats.onTime}</span>
          <span>Vencidas: {stats.overdue}</span>
          <span>Por vencer: {stats.pending}</span>
        </div>
        <div data-testid="task-completion-chart" className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: colors.mutedForeground }} axisLine={{ stroke: colors.border }} tickLine={{ stroke: colors.border }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: colors.mutedForeground }} axisLine={{ stroke: colors.border }} tickLine={{ stroke: colors.border }} />
              <Tooltip
                cursor={{ fill: colors.muted, opacity: 0.4 }}
                contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.foreground }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ul className="space-y-2">
        {tasks.map(task => (
          <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
            <span className="min-w-0 break-words text-body-md font-medium text-foreground">{task.title}</span>
            <span className="shrink-0 font-mono text-label-mono-xs text-muted-foreground">{task.status === 'done' ? 'Hecha' : 'Pendiente'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
