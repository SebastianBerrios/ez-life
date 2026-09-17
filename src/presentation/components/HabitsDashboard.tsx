'use client';

import React, { useEffect, useState } from 'react';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { Goal, Habit, Task } from '../../core/domain/models/types';
import { buildFixedDaysLog, evaluateFixedDaysStreak, evaluateFrequencyStreak } from '../../core/use-cases/evaluateHabitStreak';
import { calculateHabitCompletionRate } from '../../core/use-cases/calculateHabitCompletionRate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

interface HabitSummary {
  habit: Habit;
  streak: number;
  completionRate: number;
}

/**
 * Separate from the financial Dashboard on purpose (FR-026) — "revisar la
 * plata" and "revisar la disciplina personal" are different mental modes;
 * mixing them into one screen would just add noise to both.
 */
export default function HabitsDashboard({ userId }: Props) {
  const [habitSummaries, setHabitSummaries] = useState<HabitSummary[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const habitRepo = new LocalHabitRepository();
        const goalRepo = new LocalGoalRepository();
        const taskRepo = new LocalTaskRepository();
        const today = new Date();

        const [habits, goalsData, tasksData] = await Promise.all([
          habitRepo.getAll(userId),
          goalRepo.getAll(userId),
          taskRepo.getAll(userId),
        ]);

        const summaries = await Promise.all(habits.map(async (habit): Promise<HabitSummary> => {
          const completions = await habitRepo.getCompletions(habit.id);
          const completionRate = calculateHabitCompletionRate(habit, completions, today);

          if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
            const log = buildFixedDaysLog(habit.fixed_days, completions, habit.created_at, today);
            return { habit, streak: evaluateFixedDaysStreak(log).streak, completionRate };
          }

          const target = habit.frequency_target ?? 1;
          const { streak } = evaluateFrequencyStreak([{ completions: completions.length, target, tokenUsed: false }]);
          return { habit, streak, completionRate };
        }));

        setHabitSummaries(summaries);
        setGoals(goalsData.filter(g => g.status === 'active'));
        setTasks(tasksData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-lg">Hábitos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {habitSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés hábitos registrados todavía.</p>
          ) : (
            habitSummaries.map(({ habit, streak, completionRate }) => (
              <div key={habit.id} className="space-y-1">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="font-medium text-foreground">{habit.name}</span>
                  <span className="text-muted-foreground">Racha: {streak}</span>
                </div>
                <Progress value={completionRate} />
                <p className="text-xs text-muted-foreground">{completionRate}% de cumplimiento (últimos 30 días)</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-lg">Metas activas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés metas activas.</p>
          ) : (
            goals.map(goal => (
              <div key={goal.id} className="text-sm">
                <span className="font-medium text-foreground">{goal.name}</span>
                {goal.kind === 'numeric' && (
                  <span className="text-muted-foreground"> — {goal.current_value ?? 0}/{goal.target_value}</span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-lg">Tareas próximas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés tareas pendientes.</p>
          ) : (
            tasks
              .slice()
              .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
              .slice(0, 5)
              .map(task => (
                <div key={task.id} className="flex justify-between text-sm">
                  <span className="text-foreground">{task.title}</span>
                  <span className="text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
