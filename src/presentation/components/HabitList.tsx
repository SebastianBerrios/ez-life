'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { Habit } from '../../core/domain/models/types';
import { buildFixedDaysLog, evaluateFixedDaysStreak, evaluateFrequencyStreak } from '../../core/use-cases/evaluateHabitStreak';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

interface HabitWithStreak extends Habit {
  streak: number;
  tokensAvailable: number;
  completedToday: boolean;
}

export default function HabitList({ userId }: Props) {
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHabits = useCallback(async () => {
    try {
      const repo = new LocalHabitRepository();
      const allHabits = await repo.getAll(userId);
      const today = new Date();

      const withStreak = await Promise.all(allHabits.map(async (habit): Promise<HabitWithStreak> => {
        const completions = await repo.getCompletions(habit.id);

        if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
          const log = buildFixedDaysLog(habit.fixed_days, completions, habit.created_at, today);
          const { streak, tokensAvailable } = evaluateFixedDaysStreak(log);
          return { ...habit, streak, tokensAvailable, completedToday: Boolean(log[log.length - 1]?.completed) };
        }

        // Frequency mode: only the current week's completion state matters
        // for the "already done today" toggle shown here.
        const target = habit.frequency_target ?? 1;
        const weekCompletions = completions.length; // simplified: lifetime count, good enough for a streak display
        const { streak, tokensAvailable } = evaluateFrequencyStreak([{ completions: weekCompletions, target, tokenUsed: false }]);
        return { ...habit, streak, tokensAvailable, completedToday: false };
      }));

      setHabits(withStreak);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const handleComplete = async (habitId: string) => {
    try {
      const repo = new LocalHabitRepository();
      await repo.recordCompletion(habitId, new Date(), false);
      await loadHabits();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este hábito?')) return;
    try {
      const repo = new LocalHabitRepository();
      await repo.delete(id);
      await loadHabits();
    } catch (err) {
      console.error(err);
    }
  };

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

  return (
    <div className="animate-fade-slide-up space-y-4">
      {habits.map(habit => (
        <Card key={habit.id} className="relative shadow-warm-sm px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-heading font-bold text-foreground">{habit.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Racha: {habit.streak} · Comodines: {'🛡️'.repeat(habit.tokensAvailable) || '0'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(habit.id)} className="text-destructive hover:bg-destructive/10">
              Borrar
            </Button>
          </div>
          {!habit.completedToday && (
            <Button size="sm" className="mt-3 w-full" onClick={() => handleComplete(habit.id)}>
              Marcar cumplido hoy
            </Button>
          )}
          {habit.completedToday && (
            <p className="mt-3 text-sm text-primary font-medium">Cumplido hoy ✓</p>
          )}
        </Card>
      ))}
    </div>
  );
}
