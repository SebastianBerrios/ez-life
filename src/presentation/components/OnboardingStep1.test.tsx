import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import OnboardingStep1 from './OnboardingStep1';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { uuidv7 } from 'uuidv7';

// Mock the repositories
vi.mock('../../infrastructure/repositories/local/LocalProfileRepository');
vi.mock('../../infrastructure/repositories/local/LocalIncomeSourceRepository');
vi.mock('uuidv7');

describe('OnboardingStep1', () => {
  it('should render form and submit successfully', async () => {
    const user = userEvent.setup();
    const mockSaveProfile = vi.fn();
    const mockSaveIncome = vi.fn();
    const mockOnComplete = vi.fn();

    (LocalProfileRepository as any).mockImplementation(function() { return { save: mockSaveProfile }; });
    (LocalIncomeSourceRepository as any).mockImplementation(function() { return { save: mockSaveIncome }; });
    (uuidv7 as any).mockReturnValue('fake-uuid');

    render(<OnboardingStep1 onComplete={mockOnComplete} />);

    // Check elements exist
    const incomeInput = screen.getByLabelText(/sueldo o ingreso base/i);
    const submitBtn = screen.getByRole('button', { name: /continuar/i });

    // Fill form
    await user.type(incomeInput, '5000.50');

    // Submit
    fireEvent.submit(submitBtn.closest('form')!);

    // Verify
    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith(expect.objectContaining({
        id: 'fake-uuid'
      }));
    });
    
    expect(mockSaveIncome).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Sueldo Base',
      amount: 500050, // Converted to cents
      user_id: 'fake-uuid' // Uses profile ID
    }));

    expect(mockOnComplete).toHaveBeenCalledWith('fake-uuid');
  });
});
