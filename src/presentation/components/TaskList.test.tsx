import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaskList from './TaskList';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';

vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');

function mockTasks(tasks: unknown[]) {
  vi.mocked(LocalTaskRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(tasks),
      markDone: vi.fn(),
      delete: vi.fn(),
    } as unknown as InstanceType<typeof LocalTaskRepository>;
  });
}

describe('TaskList', () => {
  it('shows a task due today (FR-008)', async () => {
    mockTasks([
      { id: 't1', user_id: 'u1', title: 'Pagar alquiler', status: 'pending', due_date: new Date(), created_at: new Date(), updated_at: new Date() },
    ]);

    render(<TaskList userId="u1" />);

    expect(await screen.findByText('Pagar alquiler')).toBeInTheDocument();
  });

  it('does NOT show a task due on a different day (FR-008)', async () => {
    const tomorrow = new Date(Date.UTC(2099, 0, 2));
    mockTasks([
      { id: 't1', user_id: 'u1', title: 'Tarea futura', status: 'pending', due_date: tomorrow, created_at: new Date(), updated_at: new Date() },
    ]);

    render(<TaskList userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s tareas pendientes/i)).toBeInTheDocument();
    expect(screen.queryByText('Tarea futura')).not.toBeInTheDocument();
  });
});
