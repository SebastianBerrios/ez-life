import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaskDashboard from './TaskDashboard';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';

vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');

function mockTasks(tasks: unknown[]) {
  vi.mocked(LocalTaskRepository).mockImplementation(function () {
    return { getAllIncludingDone: vi.fn().mockResolvedValue(tasks) } as unknown as InstanceType<typeof LocalTaskRepository>;
  });
}

describe('TaskDashboard', () => {
  it('shows every pending task with its status (FR-006)', async () => {
    mockTasks([
      { id: 't1', user_id: 'u1', title: 'Pagar alquiler', status: 'pending', due_date: new Date(), created_at: new Date(), updated_at: new Date() },
    ]);

    render(<TaskDashboard userId="u1" />);

    expect(await screen.findByText('Pagar alquiler')).toBeInTheDocument();
    expect(screen.getByText(/pendiente/i)).toBeInTheDocument();
  });

  it('also shows completed tasks with a "Hecha" status, via getAllIncludingDone (FR-006)', async () => {
    mockTasks([
      { id: 't1', user_id: 'u1', title: 'Pagar alquiler', status: 'pending', due_date: new Date(), created_at: new Date(), updated_at: new Date() },
      { id: 't2', user_id: 'u1', title: 'Renovar seguro', status: 'done', done_at: new Date(), due_date: new Date(), created_at: new Date(), updated_at: new Date() },
    ]);

    render(<TaskDashboard userId="u1" />);

    expect(await screen.findByText('Pagar alquiler')).toBeInTheDocument();
    expect(screen.getByText(/pendiente/i)).toBeInTheDocument();
    expect(screen.getByText('Renovar seguro')).toBeInTheDocument();
    expect(screen.getByText(/hecha/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no tasks', async () => {
    mockTasks([]);

    render(<TaskDashboard userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s tareas registradas/i)).toBeInTheDocument();
  });

  it('renders the on-time vs overdue completion chart (FR-005)', async () => {
    mockTasks([
      { id: 't1', user_id: 'u1', title: 'A', status: 'done', due_date: new Date('2026-09-20'), done_at: new Date('2026-09-19'), created_at: new Date(), updated_at: new Date() },
      { id: 't2', user_id: 'u1', title: 'B', status: 'pending', due_date: new Date('2020-01-01'), created_at: new Date(), updated_at: new Date() },
    ]);

    render(<TaskDashboard userId="u1" />);

    expect(await screen.findByTestId('task-completion-chart')).toBeInTheDocument();
    expect(screen.getByText(/a tiempo:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/vencidas:\s*1/i)).toBeInTheDocument();
  });
});
