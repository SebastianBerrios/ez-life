import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import OnboardingStep1 from './OnboardingStep1';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';

// Mock the repositories
vi.mock('../../infrastructure/repositories/local/LocalOnboardingRepository');

describe('OnboardingStep1', () => {
  it('should render form and submit successfully', async () => {
    const user = userEvent.setup();
    const mockSaveIncome = vi.fn();
    const mockOnComplete = vi.fn();

    vi.mocked(LocalOnboardingRepository).mockImplementation(function() { return { saveIncome: mockSaveIncome } as unknown as LocalOnboardingRepository; });
    // uuidv7 is only used for the income row's own id, never for the user id —
    // regression guard for the bug where this component minted its own random
    // user id instead of using the authenticated session's real id.

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
      expect(mockSaveIncome).toHaveBeenCalledWith('real-session-id', 500050);
    });


    expect(mockOnComplete).toHaveBeenCalledWith('real-session-id');
  });
});
