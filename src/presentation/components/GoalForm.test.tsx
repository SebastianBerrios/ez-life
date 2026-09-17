import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GoalForm from './GoalForm';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';

vi.mock('../../infrastructure/repositories/local/LocalGoalRepository');

describe('GoalForm', () => {
  it('creates a numeric goal with a target value', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g1' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr 100km');
    await user.type(screen.getByLabelText(/valor objetivo/i), '100');

    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 0, status: 'active',
      }));
    });
  });

  it('creates a checklist goal with milestones', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g2' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Aprender React');
    await user.click(screen.getByLabelText(/checklist/i));
    await user.type(screen.getByLabelText(/nuevo hito/i), 'Fundamentos');
    await user.click(screen.getByRole('button', { name: /agregar hito/i }));

    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'checklist',
        milestones: [expect.objectContaining({ label: 'Fundamentos', done: false })],
      }));
    });
  });
});
