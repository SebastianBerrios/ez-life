import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { useLocalQuery } from './useLocalQuery';
import type { Goal, Habit, HabitCompletion, Movement, SavingsGoal, Task } from '../../core/domain/models/types';
import { buildControlView, type ControlRawData, type ControlView } from '../../core/use-cases/buildControlView';
import { buildQuickTask, type QuickTaskResult } from '../../core/use-cases/buildQuickTask';
import { calendarKey } from '../../core/use-cases/calendar';

const WATCHED_TABLES = ['habits', 'habit_completions', 'tasks', 'goals', 'savings_goals', 'movements'];

/** How often the screen checks whether the local day rolled over while it stayed open. */
const DAY_ROLLOVER_CHECK_MS = 60_000;

interface Raw extends ControlRawData {
  loadedAt: Date;
}

const EMPTY: Raw = { habits: [], completionsByHabit: {}, tasks: [], goals: [], savingsGoals: [], movements: [], loadedAt: new Date() };

/** One failing source must not blank the whole screen: log it and fall back to an empty value. */
async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

async function loadRaw(userId: string): Promise<Raw> {
  const habitRepo = new LocalHabitRepository();
  const [habits, tasks, goals, savingsGoals, movements] = await Promise.all([
    safe(() => habitRepo.getAll(userId), [] as Habit[]),
    safe(() => new LocalTaskRepository().getAllIncludingDone(userId), [] as Task[]),
    safe(() => new LocalGoalRepository().getAll(userId), [] as Goal[]),
    safe(() => new LocalSavingsGoalRepository().getAll(userId), [] as SavingsGoal[]),
    safe(() => new LocalMovementRepository().getAll(userId), [] as Movement[]),
  ]);
  const completions = await safe(
    async () => Promise.all(habits.map(async habit => [habit.id, await habitRepo.getCompletions(habit.id)] as const)),
    [] as (readonly [string, HabitCompletion[]])[],
  );
  return { habits, tasks, goals, savingsGoals, movements, completionsByHabit: Object.fromEntries(completions), loadedAt: new Date() };
}

export interface ControlData {
  loading: boolean;
  view: ControlView;
  /** Marks today's completion of a habit (appends one; a day already done is left alone). */
  completeHabit: (habitId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  /** "Añadir tarea rápida": validates, saves a task due today. Resolves with the validation result. */
  addQuickTask: (title: string) => Promise<QuickTaskResult>;
  stopTaskRecurrence: (task: Task) => Promise<void>;
  incrementGoal: (goal: Goal) => Promise<void>;
  toggleMilestone: (goal: Goal, milestoneId: string, done: boolean) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  /** Rejects with the repository error so the caller can show it. */
  deleteSavingsGoal: (id: string) => Promise<void>;
}

/**
 * Everything the Control screen needs, read from the local (Dexie) repositories so it works offline.
 * Refreshes when a sync cycle ends, when any watched table changes locally and when the local day
 * rolls over. Reloads after the first one are silent. The components only render `view`.
 */
export function useControlData(userId: string): ControlData {
  const load = useCallback(() => loadRaw(userId), [userId]);
  const { data: raw, loading, reload } = useLocalQuery({ load, initial: EMPTY, tables: WATCHED_TABLES });
  const view = useMemo(() => buildControlView(raw, raw.loadedAt), [raw]);

  // A tab left open past midnight must not keep showing yesterday as "today".
  const shownDay = useRef(calendarKey(raw.loadedAt));
  shownDay.current = calendarKey(raw.loadedAt);
  useEffect(() => {
    const timer = setInterval(() => {
      if (calendarKey(new Date()) !== shownDay.current) void reload();
    }, DAY_ROLLOVER_CHECK_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const inFlight = useRef(new Set<string>());
  const runOnce = useCallback(async <T,>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current.has(key)) return undefined;
    inFlight.current.add(key);
    try {
      const result = await action();
      await reload();
      return result;
    } catch (error) {
      console.error(error);
      return undefined;
    } finally {
      inFlight.current.delete(key);
    }
  }, [reload]);

  const completeHabit = useCallback(async (habitId: string) => {
    await runOnce(`habit:${habitId}`, async () => {
      // Re-read from the store so a second tap (or another tab) can never append a second completion today.
      const existing = await new LocalHabitRepository().getCompletions(habitId);
      const today = calendarKey(new Date());
      if (existing.some(completion => calendarKey(completion.date) === today)) return;
      await new LocalHabitRepository().recordCompletion(habitId, new Date(), false);
    });
  }, [runOnce]);

  const completeTask = useCallback(
    async (taskId: string) => { await runOnce(`task:${taskId}`, () => new LocalTaskRepository().markDone(taskId)); },
    [runOnce],
  );

  const addQuickTask = useCallback(async (title: string): Promise<QuickTaskResult> => {
    const built = buildQuickTask(title, userId, new Date());
    if (!built.ok) return built;
    await new LocalTaskRepository().save(built.task);
    await reload();
    return built;
  }, [userId, reload]);

  // FR-004: stops generating future occurrences from this series; the occurrence itself and every one
  // already generated stay unchanged. A recurring Task never has streak/token state (Principio XIII).
  const stopTaskRecurrence = useCallback(
    async (task: Task) => { await runOnce(`stop:${task.id}`, () => new LocalTaskRepository().save({ ...task, recurrence_active: false })); },
    [runOnce],
  );

  const incrementGoal = useCallback(
    async (goal: Goal) => { await runOnce(`goal:${goal.id}`, () => new LocalGoalRepository().updateProgress(goal.id, { currentValue: (goal.current_value ?? 0) + 1 })); },
    [runOnce],
  );

  const toggleMilestone = useCallback(
    async (goal: Goal, milestoneId: string, done: boolean) => {
      await runOnce(`goal:${goal.id}`, () => new LocalGoalRepository().updateProgress(goal.id, { milestoneId, done }));
    },
    [runOnce],
  );

  const deleteHabit = useCallback(async (id: string) => { await runOnce(`del-habit:${id}`, () => new LocalHabitRepository().delete(id)); }, [runOnce]);
  const deleteTask = useCallback(async (id: string) => { await runOnce(`del-task:${id}`, () => new LocalTaskRepository().delete(id)); }, [runOnce]);
  const deleteGoal = useCallback(async (id: string) => { await runOnce(`del-goal:${id}`, () => new LocalGoalRepository().delete(id)); }, [runOnce]);
  const deleteSavingsGoal = useCallback(async (id: string) => {
    await new LocalSavingsGoalRepository().delete(id);
    await reload();
  }, [reload]);

  return {
    loading, view, completeHabit, completeTask, addQuickTask, stopTaskRecurrence, incrementGoal, toggleMilestone,
    deleteHabit, deleteTask, deleteGoal, deleteSavingsGoal,
  };
}
