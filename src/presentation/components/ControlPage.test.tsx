import { render, screen } from '@testing-library/react';
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

    expect(await screen.findByText(/pagar alquiler/i)).toBeInTheDocument();
    expect(await screen.findByText('Correr')).toBeInTheDocument();
    expect(await screen.findByText(/correr 100km/i)).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /\+ nuev/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^crear$/i })).not.toBeInTheDocument();
  });

  it('excludes a non-today task, a non-scheduled habit, and a completed goal (FR-008, FR-009)', async () => {
    const otherCode = DAY_CODES[(new Date().getUTCDay() + 1) % 7];
    const notToday = new Date(Date.UTC(2099, 0, 2));
    mockRepos({
      tasks: [{ id: 't1', user_id: 'u1', title: 'Tarea de otro día', status: 'pending', due_date: notToday, created_at: new Date(), updated_at: new Date() }],
      habits: [{ id: 'h1', user_id: 'u1', name: 'Hábito de otro día', schedule_mode: 'fixed_days', fixed_days: [otherCode], created_at: new Date(), updated_at: new Date() }],
      goals: [{ id: 'g1', user_id: 'u1', name: 'Meta ya completada', kind: 'numeric', target_value: 10, current_value: 10, status: 'completed', created_at: new Date(), updated_at: new Date() }],
    });

    render(<ControlPage userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s tareas pendientes/i)).toBeInTheDocument();
    expect(screen.queryByText('Tarea de otro día')).not.toBeInTheDocument();
    expect(screen.queryByText('Hábito de otro día')).not.toBeInTheDocument();
    expect(screen.queryByText('Meta ya completada')).not.toBeInTheDocument();
  });

  it('shows a single unified empty state pointing to "Crear" when there is nothing at all (edge case)', async () => {
    mockRepos({});

    render(<ControlPage userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s metas, tareas ni h[aá]bitos/i)).toBeInTheDocument();
    expect(screen.getByText(/crear/i)).toBeInTheDocument();
  });
});
