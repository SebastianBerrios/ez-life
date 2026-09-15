import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SavingsGoalForm from './SavingsGoalForm';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';

vi.mock('../../infrastructure/repositories/local/LocalSavingsGoalRepository');

describe('SavingsGoalForm', () => {
  it('should transform amount to cents and save goal', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn();
    const mockOnComplete = vi.fn();
    vi.mocked(LocalSavingsGoalRepository).mockImplementation(function() { return { save: mockSave } as unknown as InstanceType<typeof LocalSavingsGoalRepository>; });

    render(<SavingsGoalForm userId="fake-user-id" onComplete={mockOnComplete} onCancel={vi.fn()} />);

    // Enter name
    const nameInput = screen.getByLabelText(/nombre/i);
    await user.type(nameInput, 'Viaje');

    // Enter amount
    const amountInput = screen.getByLabelText(/monto objetivo/i);
    await user.type(amountInput, '1500.50');

    // Submit
    const form = screen.getByTestId('goal-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'fake-user-id',
        name: 'Viaje',
        target_amount: 150050, // 1500.50 * 100
      }));
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });
});
