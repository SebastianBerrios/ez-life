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

    vi.mocked(LocalProfileRepository).mockImplementation(function() { return { save: mockSaveProfile } as unknown as InstanceType<typeof LocalProfileRepository>; });
    vi.mocked(LocalIncomeSourceRepository).mockImplementation(function() { return { save: mockSaveIncome } as unknown as InstanceType<typeof LocalIncomeSourceRepository>; });
    // uuidv7 is only used for the income row's own id, never for the user id —
    // regression guard for the bug where this component minted its own random
    // user id instead of using the authenticated session's real id.
    vi.mocked(uuidv7).mockReturnValue('fake-income-row-id');

    render(<OnboardingStep1 profileId="real-session-id" onComplete={mockOnComplete} />);

    // Check elements exist
    const incomeInput = screen.getByLabelText(/sueldo o ingreso base/i);
    const submitBtn = screen.getByRole('button', { name: /continuar/i });

    // Fill form
    await user.type(incomeInput, '5000.50');

    // Submit
    fireEvent.submit(submitBtn.closest('form')!);

    // Verify: the real session profileId is used, never a freshly minted uuid.
    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith(expect.objectContaining({
        id: 'real-session-id'
      }));
    });

    expect(mockSaveIncome).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Sueldo Base',
      amount: 500050, // Converted to cents
      user_id: 'real-session-id' // Uses the real session profile id, not a generated one
    }));

    expect(mockOnComplete).toHaveBeenCalledWith('real-session-id');
  });
});
