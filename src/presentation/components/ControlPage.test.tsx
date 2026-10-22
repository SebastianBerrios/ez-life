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

// Real local repositories on fake-indexeddb: the screen is tested against the same data path the app uses.
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

function setViewport({ desktop = false, wide = false }: { desktop?: boolean; wide?: boolean } = {}) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('1280') ? wide : query.includes('768') ? desktop : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
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
  setViewport();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error jsdom has no matchMedia: restore the default "mobile" environment
  delete window.matchMedia;
});

describe('ControlPage: header ("Centro de mando")', () => {
  it('shows an honest empty state when nothing is scheduled (no score, no streak, no state label)', async () => {
    await renderControl();
    expect(screen.getByRole('heading', { name: 'Control y Metas' })).toBeInTheDocument();
    expect(screen.getByTestId('score-sentence')).toHaveTextContent('Nada programado para hoy.');
    expect(screen.getByRole('progressbar', { name: 'Puntaje diario' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByTestId('active-streak')).not.toBeInTheDocument();
    expect(screen.queryByText(/en ritmo|excelente|atención/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nivel|xp|fuego/i)).not.toBeInTheDocument();
  });

  it('shows the real daily score, "N de M objetivos" and the derived state', async () => {
    await addHabit({ name: 'Correr' });
    await addHabit({ name: 'Leer' });
    await addTask({ title: 'Pagar alquiler' });
    await addTask({ title: 'Ya hecha', status: 'done', done_at: dayAt(0, 8) });
    await renderControl();

    // 1 of 4 done (the finished task).
    expect(await screen.findByText('1 de 4 objetivos de hoy completados')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Puntaje diario' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('Atención')).toBeInTheDocument();
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
    expect(today[0]).toHaveAttribute('aria-label', expect.stringContaining(`${now.getDate()}: 0 de 1 completados`));
  });

  it('the active streak is the longest current one and appears only when there is one', async () => {
    const habit = await addHabit({ name: 'Meditar', created_at: dayAt(-3, 9) });
    await db.habits.put({ ...habit, created_at: dayAt(-3, 9) });
    for (const offset of [-3, -2, -1, 0]) await habitRepo().recordCompletion(habit.id, dayAt(offset, 9), false);
    await renderControl();
    expect(await screen.findByTestId('active-streak')).toHaveTextContent('Racha activa: 4 días');
  });

  it('desktop: three cards (Desempeño semanal, Efectividad diaria with the real %, Carga operativa with real counts)', async () => {
    setViewport({ desktop: true });
    const habit = await addHabit({ name: 'Correr' });
    await addTask({ title: 'Urgente hoy', priority: 'high' });
    await addTask({ title: 'Tarea', priority: 'low' });
    const goalRepo = new LocalGoalRepository();
    await goalRepo.save({ id: '', user_id: U, name: 'Meta A', kind: 'numeric', target_value: 5, current_value: 1, status: 'active' });
    await habitRepo().recordCompletion(habit.id, dayAt(0, 9), false);
    await renderControl();

    expect(await screen.findByLabelText('Desempeño semanal')).toBeInTheDocument();
    const effectiveness = screen.getByLabelText('Efectividad diaria');
    await waitFor(() => expect(within(effectiveness).getByTestId('daily-score')).toHaveTextContent('33%'));
    const load = screen.getByLabelText('Carga operativa');
    const counts = within(load).getAllByRole('definition').map(node => node.textContent);
    expect(counts).toEqual(['1', '1', '1']); // hábitos de hoy, tareas urgentes, metas activas
    expect(screen.queryByText(/capacidad|hrs foco|vs ayer/i)).not.toBeInTheDocument();
  });
});

describe('ControlPage: Hábitos diarios', () => {
  it('shows each habit with its schedule, status text and 7-day bar; a habit not scheduled today says so', async () => {
    await addHabit({ name: 'Correr' });
    await addHabit({ name: 'Yoga', fixed_days: [otherDayCode] });
    await renderControl();

    await screen.findByText('Correr');
    expect(screen.getAllByTestId(/^habit-card-/)).toHaveLength(2);
    const correr = screen.getByText('Correr').closest('li')!;
    expect(within(correr).getByText('Todos los días')).toBeInTheDocument();
    expect(within(correr).getByText('Pendiente hoy')).toBeInTheDocument();
    expect(within(correr).getByRole('img', { name: /últimos 7 días/i })).toBeInTheDocument();
    const yoga = screen.getByText('Yoga').closest('li')!;
    expect(within(yoga).getByText('No toca hoy')).toBeInTheDocument();
  });

  it('checking a habit records today once, updates the card, the score ring and the streak', async () => {
    const user = userEvent.setup();
    const habit = await addHabit({ name: 'Correr', created_at: dayAt(-2, 9) });
    await db.habits.put({ ...habit, created_at: dayAt(-2, 9) });
    for (const offset of [-2, -1]) await habitRepo().recordCompletion(habit.id, dayAt(offset, 9), false);
    await renderControl();

    const check = await screen.findByRole('checkbox', { name: 'Marcar "Correr" como cumplido' });
    expect(check).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Racha 2 d')).toBeInTheDocument(); // through yesterday while open
    await user.click(check);

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Marcar "Correr" como cumplido' })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText('Hoy completado')).toBeInTheDocument();
    expect(screen.getByText('Racha 3 d')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Puntaje diario' })).toHaveAttribute('aria-valuenow', '100');
    expect(await db.habit_completions.where('habit_id').equals(habit.id).count()).toBe(3);
    expect(screen.getByRole('checkbox', { name: 'Marcar "Correr" como cumplido' })).toBeDisabled();
  });

  it('is operable with the keyboard (Space on the check)', async () => {
    const user = userEvent.setup();
    const habit = await addHabit({ name: 'Leer' });
    await renderControl();
    const check = await screen.findByRole('checkbox', { name: 'Marcar "Leer" como cumplido' });
    check.focus();
    await user.keyboard(' ');
    await waitFor(() => expect(check).toHaveAttribute('aria-checked', 'true'));
    expect(await db.habit_completions.where('habit_id').equals(habit.id).count()).toBe(1);
  });

  it('a late-evening completion belongs to its own local day (no UTC shift)', async () => {
    const habit = await addHabit({ name: 'Noche', fixed_days: [CODES[now.getDay()]] });
    await habitRepo().recordCompletion(habit.id, dayAt(0, 23), false);
    await renderControl();
    expect(await screen.findByText('Hoy completado')).toBeInTheDocument();
  });

  it('shows the adherence row only when it can be measured', async () => {
    await renderControl();
    expect(screen.queryByTestId('adherence')).not.toBeInTheDocument();
  });

  it('adherence is the average 30-day rate', async () => {
    const habit = await addHabit({ name: 'Leer', created_at: dayAt(-1, 9) });
    await db.habits.put({ ...habit, created_at: dayAt(-1, 9) });
    await habitRepo().recordCompletion(habit.id, dayAt(-1, 9), false);
    await renderControl();
    // Two scheduled days (yesterday done, today open) -> 50%.
    expect(await screen.findByTestId('adherence')).toHaveTextContent('50%');
  });

  it('empty state with a call to action that opens the habit form', async () => {
    const user = userEvent.setup();
    const { onOpenQuickRecord } = await renderControl();
    await user.click(screen.getByRole('button', { name: /crear tu primer hábito/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('habit', 'habit');
  });

  it('"+ Nuevo" opens the quick-record sheet on the habit form', async () => {
    const user = userEvent.setup();
    await addHabit({ name: 'Correr' });
    const { onOpenQuickRecord } = await renderControl();
    await user.click(within(await screen.findByTestId('habits-section')).getByRole('button', { name: /nuevo/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('habit', 'habit');
  });

  it('delete asks for confirmation and removes the habit', async () => {
    const user = userEvent.setup();
    await addHabit({ name: 'Correr' });
    await renderControl();
    await user.click(await screen.findByRole('button', { name: 'Acciones de Correr' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    expect(window.confirm).toHaveBeenCalledWith('¿Seguro que deseas eliminar este hábito?');
    await waitFor(() => expect(screen.queryByText('Correr')).not.toBeInTheDocument());
  });

  it('cancelling the confirmation keeps the habit', async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValue(false);
    await addHabit({ name: 'Correr' });
    await renderControl();
    await user.click(await screen.findByRole('button', { name: 'Acciones de Correr' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    expect(screen.getByText('Correr')).toBeInTheDocument();
  });
});

describe('ControlPage: Dashboard de tareas', () => {
  it('"Para hoy" lists overdue (flagged) and today tasks; the other tabs hold the week and the done ones', async () => {
    const user = userEvent.setup();
    await addTask({ title: 'Atrasada A', due_date: dayAt(-2), priority: 'high' });
    await addTask({ title: 'De hoy', due_date: dayAt(0) });
    await addTask({ title: 'De mañana', due_date: dayAt(1), priority: 'low' });
    await addTask({ title: 'Terminada', status: 'done', done_at: dayAt(0, 8) });
    await renderControl();

    const today = within(await screen.findByTestId('tasks-section'));
    expect(today.getByText('Atrasada A')).toBeInTheDocument();
    expect(today.getByText('De hoy')).toBeInTheDocument();
    expect(today.queryByText('De mañana')).not.toBeInTheDocument();
    expect(today.getByText(/^Atrasada · /)).toBeInTheDocument();
    expect(today.getByText('Hoy')).toBeInTheDocument();
    expect(today.getByTestId('pending-count')).toHaveTextContent('3 pendientes');

    await user.click(today.getByRole('tab', { name: /esta semana/i }));
    expect(today.getByText('De mañana')).toBeInTheDocument();
    expect(today.getByText('Mañana')).toBeInTheDocument();
    expect(today.queryByText('De hoy')).not.toBeInTheDocument();

    await user.click(today.getByRole('tab', { name: /hechas/i }));
    expect(today.getByText('Terminada')).toBeInTheDocument();
    expect(today.queryByText('De mañana')).not.toBeInTheDocument();
  });

  it('priority drives the left border and the badge; tag and recurrence are shown', async () => {
    const high = await addTask({ title: 'Examen', priority: 'high', tag: 'Maestría / Estudio' });
    await addTask({ title: 'Revisión', priority: 'medium' });
    await addTask({ title: 'Ordenar', priority: 'low' });
    await addTask({ title: 'Basura', schedule_mode: 'fixed_days', fixed_days: ['sat'], recurrence_series_id: 's1', recurrence_active: true });
    await renderControl();

    const examen = await screen.findByTestId(`task-card-${high.id}`);
    expect(examen).toHaveAttribute('data-priority', 'high');
    expect(examen.className).toContain('border-l-expense');
    expect(within(examen).getByText('Alta')).toBeInTheDocument();
    expect(within(examen).getByText('Maestría / Estudio')).toBeInTheDocument();
    expect(screen.getByText('Revisión').closest('li')).toHaveAttribute('data-priority', 'medium');
    expect(within(screen.getByText('Ordenar').closest('li')!).getByText('Baja')).toBeInTheDocument();
    expect(within(screen.getByText('Basura').closest('li')!).getByText('Recurrente')).toBeInTheDocument();
    // Order: high before medium before low.
    const titles = screen.getAllByTestId(/^task-card-/).map(card => card.textContent);
    expect(titles[0]).toContain('Examen');
  });

  it('a task with high priority due today counts as urgent in the header and the section', async () => {
    setViewport({ desktop: true });
    await addTask({ title: 'Examen', priority: 'high' });
    await renderControl();
    expect(await screen.findByText('1 Urgente')).toBeInTheDocument();
  });

  it('marking a task done moves it to "Hechas" and updates the score', async () => {
    const user = userEvent.setup();
    const task = await addTask({ title: 'Pagar alquiler' });
    await renderControl();
    await user.click(await screen.findByRole('checkbox', { name: 'Marcar "Pagar alquiler" como hecha' }));
    await waitFor(() => expect(screen.queryByTestId(`task-card-${task.id}`)).not.toBeInTheDocument());
    expect(screen.getByRole('progressbar', { name: 'Puntaje diario' })).toHaveAttribute('aria-valuenow', '100');
    expect((await db.tasks.get(task.id))?.status).toBe('done');
    await user.click(screen.getByRole('tab', { name: /hechas/i }));
    expect(screen.getByTestId(`task-card-${task.id}`)).toBeInTheDocument();
  });

  it('quick add: Enter creates a medium task due today, clears and keeps the focus, and announces it', async () => {
    const user = userEvent.setup();
    await renderControl();
    const input = screen.getByLabelText('Añadir tarea rápida');
    await user.type(input, '  Llamar a contabilidad {Enter}');

    expect(await screen.findByText('Llamar a contabilidad')).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Tarea añadida');
    const [saved] = await db.tasks.toArray();
    expect(saved).toMatchObject({ title: 'Llamar a contabilidad', priority: 'medium', status: 'pending', user_id: U });
    expect(saved.due_date).toEqual(dayAt(0, 12));

    await user.type(input, 'Segunda{Enter}');
    expect(await screen.findByText('Segunda')).toBeInTheDocument();
    expect(await db.tasks.count()).toBe(2);
  });

  it('quick add rejects an empty or blank title inline and saves nothing', async () => {
    const user = userEvent.setup();
    await renderControl();
    const input = screen.getByLabelText('Añadir tarea rápida');
    await user.type(input, '{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe un título para la tarea.');
    await user.type(input, '   {Enter}');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(await db.tasks.count()).toBe(0);
    await user.type(input, 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('quick add brings the "Para hoy" tab back so the new task is visible', async () => {
    const user = userEvent.setup();
    await addTask({ title: 'Mañana', due_date: dayAt(1) });
    await renderControl();
    await user.click(await screen.findByRole('tab', { name: /esta semana/i }));
    await user.type(screen.getByLabelText('Añadir tarea rápida'), 'Revisar correo{Enter}');
    expect(await screen.findByText('Revisar correo')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /para hoy/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('a recurring task offers "Detener recurrencia" (sets recurrence_active: false); a plain one does not', async () => {
    const user = userEvent.setup();
    const recurring = await addTask({ title: 'Sacar la basura', schedule_mode: 'fixed_days', fixed_days: ['sat'], recurrence_series_id: 's1', recurrence_active: true });
    await addTask({ title: 'Pagar alquiler' });
    await renderControl();

    await user.click(await screen.findByRole('button', { name: 'Acciones de Pagar alquiler' }));
    expect(await screen.findByRole('menuitem', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /detener recurrencia/i })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Acciones de Sacar la basura' }));
    await user.click(await screen.findByRole('menuitem', { name: /detener recurrencia/i }));
    await waitFor(async () => expect((await db.tasks.get(recurring.id))?.recurrence_active).toBe(false));
    expect(within(screen.getByTestId('tasks-section')).queryByText(/racha|token/i)).not.toBeInTheDocument(); // Principio XIII: no streaks on tasks
  });

  it('deleting a task asks for confirmation', async () => {
    const user = userEvent.setup();
    await addTask({ title: 'Pagar alquiler' });
    await renderControl();
    await user.click(await screen.findByRole('button', { name: 'Acciones de Pagar alquiler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    expect(window.confirm).toHaveBeenCalledWith('¿Seguro que deseas eliminar esta tarea?');
    await waitFor(() => expect(screen.queryByText('Pagar alquiler')).not.toBeInTheDocument());
  });

  it('empty windows explain themselves; "Nueva tarea" opens the full task form', async () => {
    const user = userEvent.setup();
    const { onOpenQuickRecord } = await renderControl();
    expect(screen.getByText(/no tienes tareas para hoy/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /esta semana/i }));
    expect(screen.getByText(/no hay tareas para el resto de la semana/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /hechas/i }));
    expect(screen.getByText(/todavía no completaste/i)).toBeInTheDocument();
    await user.click(within(screen.getByTestId('tasks-section')).getByRole('button', { name: /tarea/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('habit', 'task');
  });

  it('a task due later than this week is still reachable from "Esta semana" under "Más adelante"', async () => {
    const user = userEvent.setup();
    await addTask({ title: 'Lejana', due_date: dayAt(30) });
    await renderControl();
    await user.click(await screen.findByRole('tab', { name: /esta semana/i }));
    expect(screen.getByText('Más adelante')).toBeInTheDocument();
    expect(screen.getByText('Lejana')).toBeInTheDocument();
  });
});

describe('ControlPage: Metas activas', () => {
  const goalRepo = () => new LocalGoalRepository();
  const addGoal = (patch: Partial<Goal> & { name: string }) =>
    goalRepo().save({ id: '', user_id: U, kind: 'numeric', target_value: 100, current_value: 40, status: 'active', ...patch });

  it('shows active goals only, with percent and details', async () => {
    await addGoal({ name: 'Correr 100km' });
    await addGoal({ name: 'Meta vieja', target_value: 10, current_value: 10, status: 'completed' });
    await renderControl();
    const section = within(await screen.findByTestId('goals-section'));
    expect(section.getByText('Correr 100km')).toBeInTheDocument();
    expect(section.getByText('40%')).toBeInTheDocument();
    expect(section.getByText('40 / 100')).toBeInTheDocument();
    expect(section.queryByText('Meta vieja')).not.toBeInTheDocument();
    expect(section.getByText('1 activa')).toBeInTheDocument();
  });

  it('+1 raises a numeric goal; completing it removes it from the active list', async () => {
    const user = userEvent.setup();
    const goal = await addGoal({ name: 'Leer', target_value: 2, current_value: 1 });
    await renderControl();
    await user.click(await screen.findByRole('button', { name: 'Sumar 1 a Leer' }));
    await waitFor(() => expect(screen.queryByText('Leer')).not.toBeInTheDocument());
    expect((await db.goals.get(goal.id))?.status).toBe('completed');
  });

  it('toggling a milestone updates the checklist progress', async () => {
    const user = userEvent.setup();
    await addGoal({
      name: 'Mudanza', kind: 'checklist', target_value: undefined, current_value: undefined,
      milestones: [{ id: 'm1', label: 'Empacar', done: false }, { id: 'm2', label: 'Contratar flete', done: false }],
    });
    await renderControl();
    expect(await screen.findByText('0 / 2 hitos')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Empacar' }));
    expect(await screen.findByText('1 / 2 hitos')).toBeInTheDocument();
    expect(screen.getByTestId(/^goal-percent-/)).toHaveTextContent('50%');
  });

  it('savings goals show accumulated/objective, percent, deadline and status; "Asignar ahorro" opens the expense tab', async () => {
    const user = userEvent.setup();
    const created = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 9);
    const goal = await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Viaje a Cusco', target_amount: 500000, deadline: dayAt(60) });
    await db.savings_goals.put({ ...goal, created_at: created });
    // Written straight to the store: the repository demands a savings bucket this test does not need.
    await db.movements.put({
      id: 'm-save', user_id: U, type: 'EXPENSE', amount: 125000, date: dayAt(-1), savings_goal_id: goal.id, is_recurring: false,
      created_at: new Date(), updated_at: new Date(),
    });
    const { onOpenQuickRecord } = await renderControl();

    const card = within(await screen.findByTestId(`savings-goal-card-${goal.id}`));
    expect(card.getByText('S/ 1,250.00')).toBeInTheDocument();
    expect(card.getByText('S/ 5,000.00')).toBeInTheDocument();
    expect(card.getByText('25%')).toBeInTheDocument();
    expect(card.getByText(/^Cierre: /)).toBeInTheDocument();
    expect(card.getByText('En objetivo')).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: /asignar ahorro/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('expense');
  });

  it('a savings goal behind its schedule says so; one without deadline shows no status', async () => {
    const created = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 50, 9);
    const late = await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Atrasada', target_amount: 100000, deadline: dayAt(10) });
    await db.savings_goals.put({ ...late, created_at: created });
    await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Libre', target_amount: 100000 });
    await renderControl();
    const lateCard = within(await screen.findByTestId(`savings-goal-card-${late.id}`));
    expect(lateCard.getByText('Atrasada', { selector: '[data-slot="badge"]' })).toBeInTheDocument();
    const free = within(screen.getByText('Libre').closest('li')!);
    expect(free.queryByText(/en objetivo|atrasada|completada/i)).not.toBeInTheDocument();
  });

  it('empty state with a call to action, and "Nueva meta" opens the goal form', async () => {
    const user = userEvent.setup();
    const { onOpenQuickRecord } = await renderControl();
    await user.click(screen.getByRole('button', { name: /crear tu primera meta/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('goal', 'goal');
    onOpenQuickRecord.mockClear();
    await user.click(within(screen.getByTestId('goals-section')).getByRole('button', { name: /nueva meta/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('goal', 'goal');
  });

  it('deleting a savings goal asks for confirmation', async () => {
    const user = userEvent.setup();
    await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Viaje', target_amount: 100000 });
    await renderControl();
    await user.click(await screen.findByRole('button', { name: 'Acciones de Viaje' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    expect(window.confirm).toHaveBeenCalledWith('¿Seguro que deseas eliminar esta meta?');
    await waitFor(() => expect(screen.queryByText('Viaje')).not.toBeInTheDocument());
  });
});

describe('ControlPage: editing through the sheet', () => {
  it('edits a habit: prefilled form, saves, the card updates and the sheet closes', async () => {
    const user = userEvent.setup();
    const habit = await addHabit({ name: 'Correr', fixed_days: ['mon', 'wed'] });
    await renderControl();
    await user.click(await screen.findByRole('button', { name: 'Acciones de Correr' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Editar hábito' });
    expect(within(dialog).getByLabelText(/nombre/i)).toHaveValue('Correr');
    expect(within(dialog).getByLabelText('Lunes')).toBeChecked();
    await user.clear(within(dialog).getByLabelText(/nombre/i));
    await user.type(within(dialog).getByLabelText(/nombre/i), 'Correr y estirar');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Correr y estirar')).toBeInTheDocument();
    expect((await db.habits.get(habit.id))?.name).toBe('Correr y estirar');
  });

  it('edits a task (priority and title) and the card follows', async () => {
    const user = userEvent.setup();
    const task = await addTask({ title: 'Pagar alquiler', priority: 'low' });
    await renderControl();
    await user.click(await screen.findByRole('button', { name: 'Acciones de Pagar alquiler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Editar tarea' });
    expect(within(dialog).getByLabelText(/título/i)).toHaveValue('Pagar alquiler');
    expect(within(dialog).getByRole('tab', { name: 'Baja' })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(dialog).getByRole('tab', { name: 'Alta' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByTestId(`task-card-${task.id}`)).toHaveAttribute('data-priority', 'high'));
    expect((await db.tasks.get(task.id))?.priority).toBe('high');
  });

  it('edits a goal and a savings goal (prefilled amount in the savings form)', async () => {
    const user = userEvent.setup();
    const goal = await new LocalGoalRepository().save({ id: '', user_id: U, name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active' });
    const savings = await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Viaje', target_amount: 150050 });
    await renderControl();

    await user.click(await screen.findByRole('button', { name: 'Acciones de Correr 100km' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    let dialog = await screen.findByRole('dialog', { name: 'Editar meta' });
    expect(within(dialog).getByLabelText(/valor objetivo/i)).toHaveValue('100');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Acciones de Viaje' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    dialog = await screen.findByRole('dialog', { name: 'Editar meta de ahorro' });
    expect(within(dialog).getByLabelText(/monto objetivo/i)).toHaveValue('1500.50');
    await user.clear(within(dialog).getByLabelText(/monto objetivo/i));
    await user.type(within(dialog).getByLabelText(/monto objetivo/i), '2000');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(async () => expect((await db.savings_goals.get(savings.id))?.target_amount).toBe(200000));
    expect((await db.goals.get(goal.id))?.target_value).toBe(100);
  });
});

describe('ControlPage: analytics and progress', () => {
  it('the analytics section is closed by default and mounts its dashboards when opened', async () => {
    const user = userEvent.setup();
    const habit = await addHabit({ name: 'Correr' });
    await habitRepo().recordCompletion(habit.id, dayAt(0, 9), false);
    await addTask({ title: 'Pagar alquiler' });
    await new LocalGoalRepository().save({ id: '', user_id: U, name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active' });
    await renderControl();

    const section = screen.getByTestId('analytics-section');
    expect(section).not.toHaveAttribute('open');
    expect(screen.queryByTestId(`habit-streak-chart-${habit.id}`)).not.toBeInTheDocument();

    await user.click(within(section).getByText('Analítica'));
    expect(await screen.findByTestId(`habit-streak-chart-${habit.id}`)).toBeInTheDocument();
    expect(await screen.findByTestId('task-completion-chart')).toBeInTheDocument();
    expect(within(screen.getByTestId('goals-dashboard-section')).getByText('Correr 100km')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Mi Progreso (compact) appears only with gamification on and opens the progress route', async () => {
    const user = userEvent.setup();
    await db.profiles.put({ id: U, gamification_enabled: true, created_at: new Date(), updated_at: new Date() });
    const { onOpenProgress } = await renderControl();
    await user.click(await screen.findByRole('button', { name: /mi progreso\s*0 de 6 logros/i }));
    expect(onOpenProgress).toHaveBeenCalled();
  });

  it('Mi Progreso is hidden when gamification is off', async () => {
    await db.profiles.put({ id: U, gamification_enabled: false, created_at: new Date(), updated_at: new Date() });
    await renderControl();
    expect(screen.queryByRole('button', { name: /mi progreso/i })).not.toBeInTheDocument();
  });

  it('wide screens use two columns (habits and goals left, tasks right)', async () => {
    setViewport({ desktop: true, wide: true });
    await addHabit({ name: 'Correr' });
    await renderControl();
    const habits = screen.getByTestId('habits-section');
    const tasks = screen.getByTestId('tasks-section');
    expect(habits.parentElement).not.toBe(tasks.parentElement);
  });
});

describe('ControlPage: reveal an item requested from ⌘K (focus)', () => {
  it('scrolls to, highlights and focuses a habit card, then reports it handled', async () => {
    const onFocusHandled = vi.fn();
    const habit = await addHabit({ name: 'Meditar' });
    await renderControl({ focus: { kind: 'habit', id: habit.id }, focusNonce: 1, onFocusHandled });

    const card = await screen.findByTestId(`habit-card-${habit.id}`);
    await waitFor(() => expect(card).toHaveAttribute('data-reveal', 'true'));
    expect(card).toHaveFocus();
    await waitFor(() => expect(onFocusHandled).toHaveBeenCalledTimes(1));
  });

  it('switches the task window to the one that holds the task', async () => {
    const task = await addTask({ title: 'Renovar seguro', due_date: dayAt(25) });
    await renderControl({ focus: { kind: 'task', id: task.id }, focusNonce: 1 });

    const card = await screen.findByTestId(`task-card-${task.id}`);
    expect(screen.getByRole('tab', { name: /Esta semana/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(card).toHaveAttribute('data-reveal', 'true'));
    expect(card).toHaveFocus();
  });

  it('opens the "Hechas" window for a finished task', async () => {
    const task = await addTask({ title: 'Ya hecha', status: 'done', done_at: dayAt(0, 8) });
    await renderControl({ focus: { kind: 'task', id: task.id }, focusNonce: 1 });

    const card = await screen.findByTestId(`task-card-${task.id}`);
    expect(screen.getByRole('tab', { name: /Hechas/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(card).toHaveAttribute('data-reveal', 'true'));
  });

  it('reveals goals and savings goals', async () => {
    const goal = await new LocalGoalRepository().save({ id: '', user_id: U, name: 'Correr 10K', kind: 'numeric', target_value: 10, current_value: 1, status: 'active' });
    const savings = await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Viaje a Cusco', target_amount: 500000 });

    const first = await renderControl({ focus: { kind: 'goal', id: goal.id }, focusNonce: 1 });
    await waitFor(() => expect(screen.getByTestId(`goal-card-${goal.id}`)).toHaveAttribute('data-reveal', 'true'));
    first.unmount();

    await renderControl({ focus: { kind: 'savings-goal', id: savings.id }, focusNonce: 1 });
    await waitFor(() => expect(screen.getByTestId(`savings-goal-card-${savings.id}`)).toHaveAttribute('data-reveal', 'true'));
    expect(screen.getByTestId(`savings-goal-card-${savings.id}`)).toHaveFocus();
  });

  it('reports handled even when the item no longer exists', async () => {
    const onFocusHandled = vi.fn();
    await addHabit({ name: 'Meditar' });
    await renderControl({ focus: { kind: 'habit', id: 'borrado' }, focusNonce: 1, onFocusHandled });
    await waitFor(() => expect(onFocusHandled).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(document.querySelector('[data-reveal]')).toBeNull();
  });

  it('does not touch anything without a focus request', async () => {
    const habit = await addHabit({ name: 'Meditar' });
    await renderControl();
    expect(screen.getByTestId(`habit-card-${habit.id}`)).not.toHaveAttribute('data-reveal');
  });
});
