import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TaskList from './TaskList';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';

vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');

function mockTasks(tasks: unknown[], overrides: { save?: ReturnType<typeof vi.fn> } = {}) {
  vi.mocked(LocalTaskRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(tasks),
      markDone: vi.fn(),
      delete: vi.fn(),
      save: overrides.save ?? vi.fn(),
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

  it('shows a "cancelar recurrencia" action for a recurring task, which sets recurrence_active: false (FR-004)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({});
    mockTasks([
      {
        id: 't1', user_id: 'u1', title: 'Sacar la basura', status: 'pending', due_date: new Date(),
        schedule_mode: 'fixed_days', fixed_days: ['sat'], recurrence_series_id: 'series-1', recurrence_active: true,
        created_at: new Date(), updated_at: new Date(),
      },
    ], { save: mockSave });

    render(<TaskList userId="u1" />);

    const cancelButton = await screen.findByRole('button', { name: /cancelar recurrencia/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', recurrence_active: false }));
    });
  });

  it('never shows a streak or token indicator for a recurring task occurrence (Principio XIII)', async () => {
    mockTasks([
      {
        id: 't1', user_id: 'u1', title: 'Sacar la basura', status: 'pending', due_date: new Date(),
        schedule_mode: 'fixed_days', fixed_days: ['sat'], recurrence_series_id: 'series-1', recurrence_active: true,
        created_at: new Date(), updated_at: new Date(),
      },
    ]);

    render(<TaskList userId="u1" />);

    await screen.findByText('Sacar la basura');
    expect(screen.queryByText(/racha/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });

  it('does NOT show a "cancelar recurrencia" action for a non-recurring task', async () => {
    mockTasks([
      { id: 't1', user_id: 'u1', title: 'Pagar alquiler', status: 'pending', due_date: new Date(), created_at: new Date(), updated_at: new Date() },
    ]);

    render(<TaskList userId="u1" />);

    await screen.findByText('Pagar alquiler');
    expect(screen.queryByRole('button', { name: /cancelar recurrencia/i })).not.toBeInTheDocument();
  });
});
