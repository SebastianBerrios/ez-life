'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import HabitDashboard from '../HabitDashboard';
import TaskDashboard from '../TaskDashboard';
import GoalDashboard from '../GoalDashboard';

/**
 * "Analítica": full dashboards of habits, tasks and goals, collapsed by default inside
 * `CollapsibleSection` so heavy charts mount only when expanded.
 */
export default function AnalyticsSection({ userId }: { userId: string }) {
  return (
    <CollapsibleSection
      variant="panel"
      defaultOpen={false}
      testId="analytics-section"
      icon={<BarChart3 className="size-4" />}
      title="Analítica"
      subtitle="Historial de rachas, cumplimiento de tareas y progreso de metas"
    >
      <div className="space-y-6 pt-2">
        <section className="space-y-3" data-testid="habits-dashboard-section" aria-labelledby="analytics-habits-title">
          <h3 id="analytics-habits-title" className="text-sm font-medium text-muted-foreground">Dashboard de hábitos</h3>
          <HabitDashboard userId={userId} />
        </section>
        <section className="space-y-3" data-testid="tasks-dashboard-section" aria-labelledby="analytics-tasks-title">
          <h3 id="analytics-tasks-title" className="text-sm font-medium text-muted-foreground">Estadísticas de tareas</h3>
          <TaskDashboard userId={userId} />
        </section>
        <section className="space-y-3" data-testid="goals-dashboard-section" aria-labelledby="analytics-goals-title">
          <h3 id="analytics-goals-title" className="text-sm font-medium text-muted-foreground">Dashboard de metas</h3>
          <GoalDashboard userId={userId} />
        </section>
      </div>
    </CollapsibleSection>
  );
}
