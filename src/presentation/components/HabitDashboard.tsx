'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { Habit, HabitCompletion } from '../../core/domain/models/types';
import { buildFixedDaysLog, evaluateFixedDaysStreak, evaluateFrequencyStreak, calculateHabitStreakHistory } from '../../core/use-cases/evaluateHabitStreak';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  userId: string;
}

interface HabitWithStreak extends Habit {
  streak: number;
  completions: HabitCompletion[];
}

// Streak-history range selector (FR-010) — 30 days is the default window.
const RANGE_OPTIONS = [7, 30, 90] as const;
const DEFAULT_RANGE_DAYS = 30;

/**
 * Habits dashboard (FR-005, extended in 004 with FR-004's streak-evolution
 * chart): every habit with its current streak plus a day-by-day history
 * chart driven by `calculateHabitStreakHistory` — a full overview, unlike
 * HabitList's "hoy" agenda, which only shows today-relevant state alongside
 * a not-today marker.
 */
export default function HabitDashboard({ userId }: Props) {
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState<number>(DEFAULT_RANGE_DAYS);

  const load = useCallback(async () => {
    try {
      const repo = new LocalHabitRepository();
      const allHabits = await repo.getAll(userId);
      const today = new Date();

      const withStreak = await Promise.all(allHabits.map(async (habit): Promise<HabitWithStreak> => {
        const completions = await repo.getCompletions(habit.id);

        if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
          const log = buildFixedDaysLog(habit.fixed_days, completions, habit.created_at, today);
          const { streak } = evaluateFixedDaysStreak(log);
          return { ...habit, streak, completions };
        }

        const target = habit.frequency_target ?? 1;
        const { streak } = evaluateFrequencyStreak([{ completions: completions.length, target, tokenUsed: false }]);
        return { ...habit, streak, completions };
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

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (habits.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No tenés hábitos registrados.</p>
      </Card>
    );
  }

  const today = new Date();

  return (
    <div className="animate-fade-slide-up space-y-4">
      <div className="flex items-center justify-end gap-2">
        {RANGE_OPTIONS.map(days => (
          <button
            key={days}
            type="button"
            aria-pressed={rangeDays === days}
            onClick={() => setRangeDays(days)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              rangeDays === days ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {days} días
          </button>
        ))}
      </div>

      {habits.map(habit => {
        const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (rangeDays - 1));
        const history = calculateHabitStreakHistory(habit, habit.completions, { from, to: today });
        const chartData = history.map(point => ({
          date: point.date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
          value: point.completed ? 1 : 0,
        }));

        return (
          <Card key={habit.id} className="shadow-warm-sm px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{habit.name}</span>
              <span className="text-sm text-muted-foreground">Racha: {habit.streak}</span>
            </div>
            {chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin historial suficiente para graficar todavía.</p>
            ) : (
              <div data-testid={`habit-streak-chart-${habit.id}`} className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 1]} ticks={[0, 1]} tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="stepAfter" dataKey="value" stroke="var(--color-primary, #6366f1)" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
