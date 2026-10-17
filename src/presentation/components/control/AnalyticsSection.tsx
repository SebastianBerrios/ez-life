'use client';

import React, { useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import HabitDashboard from '../HabitDashboard';
import TaskDashboard from '../TaskDashboard';
import GoalDashboard from '../GoalDashboard';

/**
 * "Analítica": the full dashboards of habits (streak history chart), tasks (on-time vs overdue
 * chart) and goals (spec 003/004), folded away by default. The content mounts only while open, so
 * the charts never measure a hidden container.
 */
export default function AnalyticsSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      data-testid="analytics-section"
      open={open}
      onToggle={event => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className="group rounded-lg border border-border bg-card"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-3 outline-none focus-visible:shadow-focus [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-surface-2 text-primary">
            <BarChart3 className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-headline-md text-foreground">Analítica</span>
            <span className="block text-body-sm text-muted-foreground">Historial de rachas, cumplimiento de tareas y progreso de metas</span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>

      {open && (
        <div className="space-y-6 px-5 pb-5">
          <section className="space-y-3" data-testid="habits-dashboard-section" aria-labelledby="analytics-habits-title">
            <h3 id="analytics-habits-title" className="font-mono text-label-mono-sm uppercase text-muted-foreground">Dashboard de hábitos</h3>
            <HabitDashboard userId={userId} />
          </section>
          <section className="space-y-3" data-testid="tasks-dashboard-section" aria-labelledby="analytics-tasks-title">
            <h3 id="analytics-tasks-title" className="font-mono text-label-mono-sm uppercase text-muted-foreground">Estadísticas de tareas</h3>
            <TaskDashboard userId={userId} />
          </section>
          <section className="space-y-3" data-testid="goals-dashboard-section" aria-labelledby="analytics-goals-title">
            <h3 id="analytics-goals-title" className="font-mono text-label-mono-sm uppercase text-muted-foreground">Dashboard de metas</h3>
            <GoalDashboard userId={userId} />
          </section>
        </div>
      )}
    </details>
  );
}
