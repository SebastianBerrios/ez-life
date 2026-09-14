import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MovementForm from './MovementForm';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';

vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');
vi.mock('../../infrastructure/repositories/local/LocalSavingsGoalRepository');

describe('MovementForm', () => {
  it('should transform amount to cents and save movement', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn();
    const mockOnComplete = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalMovementRepository as any).mockImplementation(function() { return { save: mockSave }; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function() {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([{ id: 'cat-id', name: 'Ahorro e Inversión', percentage: 20, is_default: true }])
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalSavingsGoalRepository as any).mockImplementation(function() {
      return {
        getAll: vi.fn().mockResolvedValue([{ id: 'goal-id', name: 'Viaje' }])
      };
    });

    render(<MovementForm userId="fake-user-id" onComplete={mockOnComplete} onCancel={vi.fn()} />);

    // Default type is EXPENSE — the tab button with "Gasto" should be present
    // No need to change type since default is already EXPENSE

    // Wait for the category select to be available (rendered after dataLoaded=true)
    const catSelect = await screen.findByLabelText(/Categoría/i);
    expect(catSelect).toBeInTheDocument();
    await user.click(catSelect);
    const catOption = await screen.findByRole('option', { name: /Ahorro e Inversión/i });
    await user.click(catOption);

    // Enter amount
    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, '150.50');

    // Enter description
    const descInput = screen.getByLabelText(/descripción/i);
    await user.type(descInput, 'Cena familiar');

    // Select Savings Goal (shown because category name includes 'ahorro')
    const goalSelect = await screen.findByLabelText(/Meta de Ahorro/i);
    await user.click(goalSelect);
    const goalOption = await screen.findByRole('option', { name: /Viaje/i });
    await user.click(goalOption);

    // Submit
    const form = screen.getByTestId('movement-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'fake-user-id',
        type: 'EXPENSE',
        amount: 15050, // 150.50 * 100
        description: 'Cena familiar',
        distribution_category_id: 'cat-id',
        savings_goal_id: 'goal-id',
        is_recurring: false
      }));
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });
});
