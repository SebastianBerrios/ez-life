import React, { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ControlPage from './ControlPage';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';

vi.mock('../../infrastructure/repositories/local/LocalHabitRepository');
vi.mock('../../infrastructure/repositories/local/LocalGoalRepository');
vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const todayCode = DAY_CODES[new Date().getUTCDay()];

function mockRepos({ habits = [], goals = [], tasks = [] }: {
  habits?: unknown[]; goals?: unknown[]; tasks?: unknown[];
}) {
  vi.mocked(LocalHabitRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(habits),
      getCompletions: vi.fn().mockResolvedValue([]),
      recordCompletion: vi.fn(),
      delete: vi.fn(),
    } as unknown as InstanceType<typeof LocalHabitRepository>;
  });
  vi.mocked(LocalGoalRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(goals),
      updateProgress: vi.fn(),
      delete: vi.fn(),
    } as unknown as InstanceType<typeof LocalGoalRepository>;
  });
  vi.mocked(LocalTaskRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(tasks),
      getAllIncludingDone: vi.fn().mockResolvedValue(tasks),
      markDone: vi.fn(),
      delete: vi.fn(),
    } as unknown as InstanceType<typeof LocalTaskRepository>;
  });
}

describe('ControlPage', () => {
  it('shows today\'s pending task and habit above, active goal progress below, and no creation control (FR-007, FR-008, FR-009)', async () => {
    mockRepos({
      tasks: [{ id: 't1', user_id: 'u1', title: 'Pagar alquiler', status: 'pending', due_date: new Date(), created_at: new Date(), updated_at: new Date() }],
      habits: [{ id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: [todayCode], created_at: new Date(), updated_at: new Date() }],
      goals: [{ id: 'g1', user_id: 'u1', name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active', created_at: new Date(), updated_at: new Date() }],
    });

    render(<ControlPage userId="u1" />);

    // Each also appears a second time in its dashboard section below (FR-005/006/007).
    expect((await screen.findAllByText(/pagar alquiler/i)).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('Correr')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText(/correr 100km/i)).length).toBeGreaterThanOrEqual(1);

    expect(screen.queryByRole('button', { name: /\+ nuev/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^crear$/i })).not.toBeInTheDocument();
  });

  it('excludes a non-today task and a completed goal, but keeps a non-scheduled habit visible with a marker (FR-004 supersedes the old FR-008 exclusion for habits; FR-009 unchanged for goals)', async () => {
    const otherCode = DAY_CODES[(new Date().getUTCDay() + 1) % 7];
    const notToday = new Date(Date.UTC(2099, 0, 2));
    mockRepos({
      tasks: [{ id: 't1', user_id: 'u1', title: 'Tarea de otro día', status: 'pending', due_date: notToday, created_at: new Date(), updated_at: new Date() }],
      habits: [{ id: 'h1', user_id: 'u1', name: 'Hábito de otro día', schedule_mode: 'fixed_days', fixed_days: [otherCode], created_at: new Date(), updated_at: new Date() }],
      goals: [{ id: 'g1', user_id: 'u1', name: 'Meta ya completada', kind: 'numeric', target_value: 10, current_value: 10, status: 'completed', created_at: new Date(), updated_at: new Date() }],
    });

    render(<ControlPage userId="u1" />);

    const todaySection = within(await screen.findByTestId('today-section'));
    expect(await todaySection.findByText(/no ten[eé]s tareas pendientes/i)).toBeInTheDocument();
    expect(todaySection.queryByText('Tarea de otro día')).not.toBeInTheDocument();
    expect(await todaySection.findByText('Hábito de otro día')).toBeInTheDocument();
    expect(todaySection.getByText(/no corresponde hoy/i)).toBeInTheDocument();

    const activeGoalsSection = within(screen.getByTestId('active-goals-section'));
    expect(activeGoalsSection.queryByText('Meta ya completada')).not.toBeInTheDocument();

    // The tasks/goals dashboards are full overviews (FR-006/FR-007) — they
    // DO show the non-today task and the completed goal, unlike the sections above.
    const tasksDashboard = within(screen.getByTestId('tasks-dashboard-section'));
    expect(await tasksDashboard.findByText('Tarea de otro día')).toBeInTheDocument();
    const goalsDashboard = within(screen.getByTestId('goals-dashboard-section'));
    expect(await goalsDashboard.findByText('Meta ya completada')).toBeInTheDocument();
  });

  it('shows a single unified empty state pointing to "Crear" when there is nothing at all (edge case)', async () => {
    mockRepos({});

    render(<ControlPage userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s metas, tareas ni h[aá]bitos/i)).toBeInTheDocument();
    expect(screen.getByText(/crear/i)).toBeInTheDocument();
  });

  it('forwards habitsRefreshKey/tasksRefreshKey as the `key` of HabitList/TaskList, remounting them to refetch when MainFlow bumps them (FR-003)', async () => {
    const user = userEvent.setup();
    const habitGetAll = vi.fn().mockResolvedValue([]);
    const taskGetAll = vi.fn().mockResolvedValue([]);
    const taskGetAllIncludingDone = vi.fn().mockResolvedValue([]);
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { getAll: habitGetAll, getCompletions: vi.fn().mockResolvedValue([]), recordCompletion: vi.fn(), delete: vi.fn() } as unknown as InstanceType<typeof LocalHabitRepository>;
    });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { getAll: taskGetAll, getAllIncludingDone: taskGetAllIncludingDone, markDone: vi.fn(), delete: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
    });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      // Non-empty on purpose: keeps ControlPage out of its unified "nothing at all" empty
      // state so TaskList/HabitList render their own individual empty messages below.
      return {
        getAll: vi.fn().mockResolvedValue([{ id: 'g1', user_id: 'u1', name: 'Ahorrar', kind: 'numeric', target_value: 10, current_value: 1, status: 'active', created_at: new Date(), updated_at: new Date() }]),
        updateProgress: vi.fn(),
        delete: vi.fn(),
      } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    function Wrapper() {
      const [habitsRefreshKey, setHabitsRefreshKey] = useState(0);
      const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
      return (
        <div>
          <button onClick={() => { setHabitsRefreshKey(k => k + 1); setTasksRefreshKey(k => k + 1); }}>bump</button>
          <ControlPage userId="u1" habitsRefreshKey={habitsRefreshKey} tasksRefreshKey={tasksRefreshKey} />
        </div>
      );
    }

    render(<Wrapper />);
    await screen.findByText(/no ten[eé]s tareas pendientes/i);
    // ControlPage's own checkEmpty() also calls getAll() once (unrelated to
    // the refresh-key wiring under test) — capture the baseline count first.
    const habitCallsBeforeBump = habitGetAll.mock.calls.length;
    const taskCallsBeforeBump = taskGetAll.mock.calls.length;
    const taskIncludingDoneCallsBeforeBump = taskGetAllIncludingDone.mock.calls.length;

    await user.click(screen.getByText('bump'));

    await screen.findByText(/no ten[eé]s tareas pendientes/i);
    // +1 for HabitList (the "Hoy" section) and +1 for HabitDashboard (also
    // keyed by the same refresh key).
    expect(habitGetAll.mock.calls.length).toBe(habitCallsBeforeBump + 2);
    // TaskList (the "Hoy" section) uses `getAll`.
    expect(taskGetAll.mock.calls.length).toBe(taskCallsBeforeBump + 1);
    // TaskDashboard uses `getAllIncludingDone` instead (FR-006).
    expect(taskGetAllIncludingDone.mock.calls.length).toBe(taskIncludingDoneCallsBeforeBump + 1);
  });

  it('forwards goalsControlRefreshKey as the `key` of GoalList/GoalDashboard, remounting them to refetch when MainFlow bumps it (FR-003)', async () => {
    const user = userEvent.setup();
    const goalGetAll = vi.fn().mockResolvedValue([]);
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { getAll: goalGetAll, updateProgress: vi.fn(), delete: vi.fn() } as unknown as InstanceType<typeof LocalGoalRepository>;
    });
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      // Non-empty on purpose: keeps ControlPage out of its unified "nothing at all" empty
      // state so GoalList/GoalDashboard render their own individual empty messages below.
      return {
        getAll: vi.fn().mockResolvedValue([{ id: 'h1', user_id: 'u1', name: 'Meditar', schedule_mode: 'fixed_days', fixed_days: [todayCode], created_at: new Date(), updated_at: new Date() }]),
        getCompletions: vi.fn().mockResolvedValue([]),
        recordCompletion: vi.fn(),
        delete: vi.fn(),
      } as unknown as InstanceType<typeof LocalHabitRepository>;
    });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { getAll: vi.fn().mockResolvedValue([]), markDone: vi.fn(), delete: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    function Wrapper() {
      const [goalsControlRefreshKey, setGoalsControlRefreshKey] = useState(0);
      return (
        <div>
          <button onClick={() => setGoalsControlRefreshKey(k => k + 1)}>bump</button>
          <ControlPage userId="u1" goalsControlRefreshKey={goalsControlRefreshKey} />
        </div>
      );
    }

    render(<Wrapper />);
    const activeGoalsSection = within(await screen.findByTestId('active-goals-section'));
    const goalsDashboardSection = within(await screen.findByTestId('goals-dashboard-section'));
    await activeGoalsSection.findByText(/no ten[eé]s metas registradas/i);
    await goalsDashboardSection.findByText(/no ten[eé]s metas registradas/i);
    const goalCallsBeforeBump = goalGetAll.mock.calls.length;

    await user.click(screen.getByText('bump'));

    await activeGoalsSection.findByText(/no ten[eé]s metas registradas/i);
    // +1 for GoalList ("Metas activas" section) and +1 for GoalDashboard.
    expect(goalGetAll.mock.calls.length).toBe(goalCallsBeforeBump + 2);
  });
});
