import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ControlPage from './ControlPage';
import { db } from '../../infrastructure/db/db';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import type { Goal, Habit, Task } from '../../core/domain/models/types';

const U = 'u1';
const now = new Date();
const dayAt = (offset: number, hour = 12) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour);
const CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const otherDayCode = CODES[(now.getDay() + 1) % 7];
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const habitRepo = () => new LocalHabitRepository();
const taskRepo = () => new LocalTaskRepository();

async function addHabit(patch: Partial<Habit> & { name: string }): Promise<Habit> {
  return habitRepo().save({ id: '', user_id: U, schedule_mode: 'fixed_days', fixed_days: [...EVERY_DAY], ...patch });
}
async function addTask(patch: Partial<Task> & { title: string }): Promise<Task> {
  return taskRepo().save({ id: '', user_id: U, due_date: dayAt(0), status: 'pending', ...patch });
}

async function renderControl(props: Partial<React.ComponentProps<typeof ControlPage>> = {}) {
  const onOpenQuickRecord = vi.fn();
  const onOpenProgress = vi.fn();
  const view = render(<ControlPage userId={U} onOpenQuickRecord={onOpenQuickRecord} onOpenProgress={onOpenProgress} {...props} />);
  await screen.findByTestId('control-header');
  return { ...view, onOpenQuickRecord, onOpenProgress };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('ControlPage: header and Foco de Hoy (spec 014)', () => {
  it('shows honest empty state and calm Foco de Hoy when nothing is scheduled', async () => {
    await renderControl();
    expect(screen.getByRole('heading', { name: 'Control y hábitos' })).toBeInTheDocument();
    expect(screen.getByTestId('score-sentence')).toHaveTextContent('Nada programado para hoy.');
    expect(screen.getByRole('progressbar', { name: 'Puntaje diario' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByTestId('active-streak')).not.toBeInTheDocument();
    expect(screen.getByTestId('today-focus-card')).toHaveTextContent('Todo listo por hoy');
  });

  it('shows daily score, Foco de Hoy with today habits and tasks, and allows one-tap completion', async () => {
    const user = userEvent.setup();
    await addHabit({ name: 'Correr' });
    await addTask({ title: 'Pagar alquiler' });
    await renderControl();

    const focus = screen.getByTestId('today-focus-card');
    expect(within(focus).getByText('Foco de Hoy')).toBeInTheDocument();
    expect(within(focus).getByText('Correr')).toBeInTheDocument();
    expect(within(focus).getByText('Pagar alquiler')).toBeInTheDocument();

    await user.click(within(focus).getByRole('checkbox', { name: 'Completar hábito "Correr"' }));
    await waitFor(() => expect(screen.getByRole('progressbar', { name: 'Puntaje diario' })).toHaveAttribute('aria-valuenow', '50'));
  });

  it('switches between Hábitos, Tareas and Metas via Segmented selector', async () => {
    const user = userEvent.setup();
    await addHabit({ name: 'Meditar' });
    await addTask({ title: 'Llamar al banco' });
    await new LocalGoalRepository().save({ id: '', user_id: U, name: 'Leer 12 libros', kind: 'numeric', target_value: 12, current_value: 3, status: 'active' });
    await renderControl();

    expect(screen.getByTestId('habits-section')).toBeInTheDocument();
    expect(screen.queryByTestId('tasks-section')).toBeNull();
    expect(screen.queryByTestId('goals-section')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Tareas' }));
    expect(screen.getByTestId('tasks-section')).toBeInTheDocument();
    expect(screen.queryByTestId('habits-section')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Metas' }));
    expect(screen.getByTestId('goals-section')).toBeInTheDocument();
    expect(screen.queryByTestId('tasks-section')).toBeNull();
  });

  it('the week strip lists Monday to Sunday with today highlighted', async () => {
    await addHabit({ name: 'Correr' });
    await renderControl();
    const week = screen.getByRole('list', { name: 'Semana actual' });
    const days = within(week).getAllByRole('listitem');
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveAttribute('aria-label', expect.stringMatching(/^lunes /));
    expect(days[6]).toHaveAttribute('aria-label', expect.stringMatching(/^domingo /));
    const today = days.filter(day => day.getAttribute('aria-current') === 'date');
    expect(today).toHaveLength(1);
  });

  it('the active streak is the longest current one and appears only when there is one', async () => {
    const habit = await addHabit({ name: 'Meditar', created_at: dayAt(-3, 9) });
    await db.habits.put({ ...habit, created_at: dayAt(-3, 9) });
    for (const offset of [-3, -2, -1, 0]) await habitRepo().recordCompletion(habit.id, dayAt(offset, 9), false);
    await renderControl();
    expect(await screen.findByTestId('active-streak')).toHaveTextContent('Racha activa: 4 días');
  });
});

describe('ControlPage: Hábitos diarios', () => {
  it('shows each habit with its schedule, status text and 7-day bar; a habit not scheduled today says so', async () => {
    await addHabit({ name: 'Correr' });
    await addHabit({ name: 'Yoga', fixed_days: [otherDayCode] });
    await renderControl();

    const section = await screen.findByTestId('habits-section');
    expect(within(section).getAllByTestId(/^habit-card-/)).toHaveLength(2);
    const correr = within(section).getByText('Correr').closest('li')!;
    expect(within(correr).getByText('Todos los días')).toBeInTheDocument();
    expect(within(correr).getByText('Pendiente hoy')).toBeInTheDocument();
    const yoga = within(section).getByText('Yoga').closest('li')!;
    expect(within(yoga).getByText('No toca hoy')).toBeInTheDocument();
  });

  it('checking a habit records today once, updates the card, score and streak', async () => {
    const user = userEvent.setup();
    const habit = await addHabit({ name: 'Correr', created_at: dayAt(-2, 9) });
    await db.habits.put({ ...habit, created_at: dayAt(-2, 9) });
    for (const offset of [-2, -1]) await habitRepo().recordCompletion(habit.id, dayAt(offset, 9), false);
    await renderControl();

    const check = await screen.findByRole('checkbox', { name: 'Marcar "Correr" como cumplido' });
    await user.click(check);

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Marcar "Correr" como cumplido' })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText('Hoy completado')).toBeInTheDocument();
    expect(screen.getByText('Racha 3 d')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Puntaje diario' })).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('ControlPage: Tareas tab', () => {
  it('quick add creates a medium task due today and shows it in Para hoy', async () => {
    const user = userEvent.setup();
    await renderControl();
    await user.click(screen.getByRole('tab', { name: 'Tareas' }));

    const input = screen.getByLabelText('Añadir tarea rápida');
    await user.type(input, 'Llamar a contabilidad{Enter}');

    expect(await within(screen.getByTestId('tasks-section')).findByText('Llamar a contabilidad')).toBeInTheDocument();
    expect(input).toHaveValue('');
    const [saved] = await db.tasks.toArray();
    expect(saved).toMatchObject({ title: 'Llamar a contabilidad', priority: 'medium', status: 'pending', user_id: U });
  });
});

describe('ControlPage: Metas tab', () => {
  const goalRepo = () => new LocalGoalRepository();
  const addGoal = (patch: Partial<Goal> & { name: string }) =>
    goalRepo().save({ id: '', user_id: U, kind: 'numeric', target_value: 100, current_value: 40, status: 'active', ...patch });

  it('shows active goals and increments numeric goal', async () => {
    const user = userEvent.setup();
    const goal = await addGoal({ name: 'Leer', target_value: 2, current_value: 1 });
    await renderControl();
    await user.click(screen.getByRole('tab', { name: 'Metas' }));

    await user.click(await screen.findByRole('button', { name: 'Sumar 1 a Leer' }));
    await waitFor(() => expect(screen.queryByText('Leer')).not.toBeInTheDocument());
    expect((await db.goals.get(goal.id))?.status).toBe('completed');
  });

  it('shows savings goals and triggers Asignar ahorro', async () => {
    const user = userEvent.setup();
    const goal = await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Viaje a Cusco', target_amount: 500000, deadline: dayAt(60) });
    const { onOpenQuickRecord } = await renderControl();
    await user.click(screen.getByRole('tab', { name: 'Metas' }));

    const card = within(await screen.findByTestId(`savings-goal-card-${goal.id}`));
    await user.click(card.getByRole('button', { name: /asignar ahorro/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('expense');
  });
});

describe('ControlPage: analytics collapsed by default', () => {
  it('keeps AnalyticsSection collapsed by default and mounts charts on expand', async () => {
    const user = userEvent.setup();
    const habit = await addHabit({ name: 'Correr' });
    await habitRepo().recordCompletion(habit.id, dayAt(0, 9), false);
    await addTask({ title: 'Pagar alquiler' });
    await new LocalGoalRepository().save({ id: '', user_id: U, name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active' });
    await renderControl();

    const section = screen.getByTestId('analytics-section');
    const trigger = within(section).getByRole('button', { name: /Analítica/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(`habit-streak-chart-${habit.id}`)).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByTestId(`habit-streak-chart-${habit.id}`)).toBeInTheDocument();
    expect(await screen.findByTestId('task-completion-chart')).toBeInTheDocument();
    expect(within(screen.getByTestId('goals-dashboard-section')).getByText('Correr 100km')).toBeInTheDocument();
  });
});

describe('ControlPage: deep-link focus auto-selects tab', () => {
  it('auto-selects Tareas tab and reveals a focused task', async () => {
    const task = await addTask({ title: 'Renovar seguro', due_date: dayAt(25) });
    await renderControl({ focus: { kind: 'task', id: task.id }, focusNonce: 1 });

    expect(screen.getByRole('tab', { name: 'Tareas' })).toHaveAttribute('aria-selected', 'true');
    const card = await screen.findByTestId(`task-card-${task.id}`);
    await waitFor(() => expect(card).toHaveAttribute('data-reveal', 'true'));
    expect(card).toHaveFocus();
  });

  it('auto-selects Metas tab and reveals a focused goal', async () => {
    const goal = await new LocalGoalRepository().save({ id: '', user_id: U, name: 'Correr 10K', kind: 'numeric', target_value: 10, current_value: 1, status: 'active' });
    await renderControl({ focus: { kind: 'goal', id: goal.id }, focusNonce: 1 });

    expect(screen.getByRole('tab', { name: 'Metas' })).toHaveAttribute('aria-selected', 'true');
    const card = await screen.findByTestId(`goal-card-${goal.id}`);
    await waitFor(() => expect(card).toHaveAttribute('data-reveal', 'true'));
  });
});
