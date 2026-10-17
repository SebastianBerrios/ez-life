'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { Habit, HabitCompletion } from '../../core/domain/models/types';
import { currentHabitStreak } from '../../core/use-cases/buildHabitStreak';
import { calculateHabitCompletionRate } from '../../core/use-cases/calculateHabitCompletionRate';
import { calculateHabitStreakHistory } from '../../core/use-cases/evaluateHabitStreak';
import { addDays, startOfDay } from '../../core/use-cases/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { onSyncCompleted } from '../../infrastructure/sync/syncEvents';
import { cn } from '@/lib/utils';
import { useChartColors } from '../hooks/useChartColors';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  userId: string;
}

interface HabitWithStreak extends Habit {
  streak: number;
  completionRate: number;
  completions: HabitCompletion[];
}

// Streak-history range selector (FR-010) — 30 days is the default window.
const RANGE_OPTIONS = [7, 30, 90] as const;
const DEFAULT_RANGE_DAYS = 30;

/**
 * Habits dashboard (FR-005, extended in 004 with FR-004's streak-evolution
 * chart): every habit with its current streak plus a day-by-day history
 * chart driven by `calculateHabitStreakHistory` — a full overview, unlike
 * the "Hábitos diarios" panel, which only shows today-relevant state.
 */
export default function HabitDashboard({ userId }: Props) {
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState<number>(DEFAULT_RANGE_DAYS);
  const colors = useChartColors();

  const load = useCallback(async () => {
    try {
      const repo = new LocalHabitRepository();
      const allHabits = await repo.getAll(userId);
      const today = new Date();

      const withStreak = await Promise.all(allHabits.map(async (habit): Promise<HabitWithStreak> => {
        const completions = await repo.getCompletions(habit.id);

        const { streak } = currentHabitStreak(habit, completions, today);
        const completionRate = calculateHabitCompletionRate(habit, completions, today);
        return { ...habit, streak, completionRate, completions };
      }));

      setHabits(withStreak);
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
  useEffect(() => onLocalChanges(['habits', 'habit_completions'], () => { void load(); }), [load]);
  useEffect(() => onSyncCompleted(() => { void load(); }), [load]);

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  if (habits.length === 0) {
    return <p className="rounded-lg border border-dashed border-border-strong p-4 text-body-md text-muted-foreground">No tenés hábitos registrados.</p>;
  }

  const today = new Date();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {RANGE_OPTIONS.map(days => (
          <button
            key={days}
            type="button"
            aria-pressed={rangeDays === days}
            onClick={() => setRangeDays(days)}
            className={cn(
              'min-h-11 rounded-lg border px-3 font-mono text-label-mono-sm outline-none transition-colors focus-visible:shadow-focus',
              rangeDays === days ? 'border-border-strong bg-surface-2 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {days} días
          </button>
        ))}
      </div>

      {habits.map(habit => {
        const from = addDays(startOfDay(today), -(rangeDays - 1));
        const history = calculateHabitStreakHistory(habit, habit.completions, { from, to: today });
        const chartData = history.map(point => ({
          date: point.date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
          value: point.completed ? 1 : 0,
        }));

        return (
          <div key={habit.id} className="space-y-3 rounded-lg bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body-lg font-medium text-foreground">{habit.name}</span>
              <span className="font-mono text-label-mono-sm text-muted-foreground">Racha: {habit.streak}</span>
            </div>
            <p className="font-mono text-label-mono-xs text-muted-foreground">{habit.completionRate}% de cumplimiento (últimos 30 días)</p>
            {chartData.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">Sin historial suficiente para graficar todavía.</p>
            ) : (
              <div data-testid={`habit-streak-chart-${habit.id}`} className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.mutedForeground }} axisLine={{ stroke: colors.border }} tickLine={{ stroke: colors.border }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 1]} ticks={[0, 1]} tick={{ fontSize: 10, fill: colors.mutedForeground }} axisLine={{ stroke: colors.border }} tickLine={{ stroke: colors.border }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.foreground }} />
                    <Line type="stepAfter" dataKey="value" stroke={colors.primary} dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
