import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { db } from '../../infrastructure/db/db';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { useControlData } from './useControlData';

const U = 'u1';
const now = new Date();
const dayAt = (offset: number, hour = 12) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour);
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

beforeEach(async () => { await db.delete(); await db.open(); });

async function loaded() {
  const hook = renderHook(() => useControlData(U));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useControlData', () => {
  it('starts empty and honest, then follows local commits without remounting', async () => {
    const { result } = await loaded();
    expect(result.current.view.score.hasData).toBe(false);
    expect(result.current.view.habits).toEqual([]);

    await act(async () => {
      await new LocalHabitRepository().save({ id: '', user_id: U, name: 'Correr', schedule_mode: 'fixed_days', fixed_days: [...EVERY_DAY] });
    });
    await waitFor(() => expect(result.current.view.habits.map(card => card.habit.name)).toEqual(['Correr']));
    expect(result.current.view.score).toMatchObject({ done: 0, scheduled: 1, pct: 0 });
  });

  it('applies remote records (sync) too', async () => {
    const { result } = await loaded();
    await act(async () => {
      await db.applyRemoteRecords('tasks', [{
        id: 't-remote', user_id: U, title: 'Desde otro dispositivo', due_date: dayAt(0), status: 'pending',
        created_at: new Date(), updated_at: new Date(Date.now() + 1000),
      }]);
    });
    await waitFor(() => expect(result.current.view.tasks.today.map(item => item.task.title)).toEqual(['Desde otro dispositivo']));
  });

  it('completeHabit records today once even when called twice at the same time', async () => {
    const habit = await new LocalHabitRepository().save({ id: '', user_id: U, name: 'Leer', schedule_mode: 'fixed_days', fixed_days: [...EVERY_DAY] });
    const { result } = await loaded();
    await act(async () => { await Promise.all([result.current.completeHabit(habit.id), result.current.completeHabit(habit.id)]); });
    expect(await db.habit_completions.where('habit_id').equals(habit.id).count()).toBe(1);
    await act(async () => { await result.current.completeHabit(habit.id); });
    expect(await db.habit_completions.where('habit_id').equals(habit.id).count()).toBe(1);
    await waitFor(() => expect(result.current.view.habits[0].doneToday).toBe(true));
  });

  it('addQuickTask validates, saves a medium task due today and reloads', async () => {
    const { result } = await loaded();
    let rejected: Awaited<ReturnType<typeof result.current.addQuickTask>> | undefined;
    await act(async () => { rejected = await result.current.addQuickTask('   '); });
    expect(rejected).toEqual({ ok: false, error: 'Escribí un título para la tarea.' });
    expect(await db.tasks.count()).toBe(0);

    await act(async () => { await result.current.addQuickTask(' Llamar al banco '); });
    const [task] = await db.tasks.toArray();
    expect(task).toMatchObject({ title: 'Llamar al banco', priority: 'medium', status: 'pending' });
    expect(task.due_date).toEqual(dayAt(0, 12));
    await waitFor(() => expect(result.current.view.tasks.today).toHaveLength(1));
  });

  it('completes, stops the recurrence of and deletes tasks', async () => {
    const repo = new LocalTaskRepository();
    const recurring = await repo.save({ id: '', user_id: U, title: 'Basura', due_date: dayAt(0), status: 'pending', schedule_mode: 'fixed_days', fixed_days: ['sat'], recurrence_series_id: 's', recurrence_active: true });
    const plain = await repo.save({ id: '', user_id: U, title: 'Alquiler', due_date: dayAt(0), status: 'pending' });
    const { result } = await loaded();
    await act(async () => { await result.current.stopTaskRecurrence(recurring); });
    expect((await db.tasks.get(recurring.id))?.recurrence_active).toBe(false);
    await act(async () => { await result.current.completeTask(plain.id); });
    expect((await db.tasks.get(plain.id))?.status).toBe('done');
    await waitFor(() => expect(result.current.view.tasks.done.map(task => task.id)).toEqual([plain.id]));
    await act(async () => { await result.current.deleteTask(recurring.id); });
    await waitFor(() => expect(result.current.view.tasks.today).toEqual([]));
  });

  it('goal actions: +1 on a numeric goal and milestone toggles', async () => {
    const goalRepo = new LocalGoalRepository();
    const numeric = await goalRepo.save({ id: '', user_id: U, name: 'Leer', kind: 'numeric', target_value: 3, current_value: 1, status: 'active' });
    const checklist = await goalRepo.save({ id: '', user_id: U, name: 'Mudanza', kind: 'checklist', milestones: [{ id: 'm1', label: 'A', done: false }, { id: 'm2', label: 'B', done: false }], status: 'active' });
    const { result } = await loaded();
    await act(async () => { await result.current.incrementGoal(numeric); });
    await waitFor(() => expect(result.current.view.goals.find(card => card.goal.id === numeric.id)?.percent).toBe(67));
    await act(async () => { await result.current.toggleMilestone(checklist, 'm1', true); });
    await waitFor(() => expect(result.current.view.goals.find(card => card.goal.id === checklist.id)?.percent).toBe(50));
  });

  it('deleteSavingsGoal removes it from the view', async () => {
    const goal = await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Viaje', target_amount: 100000 });
    const { result } = await loaded();
    expect(result.current.view.savingsGoals).toHaveLength(1);
    await act(async () => { await result.current.deleteSavingsGoal(goal.id); });
    await waitFor(() => expect(result.current.view.savingsGoals).toEqual([]));
  });

  it('only reads the data of its own user', async () => {
    await new LocalHabitRepository().save({ id: '', user_id: 'someone-else', name: 'Ajeno', schedule_mode: 'fixed_days', fixed_days: [...EVERY_DAY] });
    const { result } = await loaded();
    expect(result.current.view.habits).toEqual([]);
  });
});
