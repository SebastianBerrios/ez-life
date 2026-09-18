import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TaskForm from './TaskForm';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import type { Task } from '../../core/domain/models/types';

vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');

describe('TaskForm', () => {
  it('creates a task with a due date', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't1' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/título/i), 'Pagar el alquiler');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', title: 'Pagar el alquiler', status: 'pending',
        due_date: new Date('2026-12-31'),
      }));
    });
  });

  it('prefills fields from `existing` and calls save() with its id, preserving status (FR-006)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't1' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    const existing: Task = {
      id: 't1', user_id: 'user-1', title: 'Pagar el alquiler', due_date: new Date('2026-12-31'),
      status: 'done', done_at: new Date('2026-12-30'),
      created_at: new Date(), updated_at: new Date(),
    };

    render(<TaskForm userId="user-1" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/editar tarea/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveValue('Pagar el alquiler');
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/título/i));
    await user.type(screen.getByLabelText(/título/i), 'Pagar el alquiler (retitulada)');

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        id: 't1', title: 'Pagar el alquiler (retitulada)', status: 'done', done_at: existing.done_at,
      }));
    });
  });
});
