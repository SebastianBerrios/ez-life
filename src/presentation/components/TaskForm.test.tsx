import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TaskForm from './TaskForm';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';

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
});
