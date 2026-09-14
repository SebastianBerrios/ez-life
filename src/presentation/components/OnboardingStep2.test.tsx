import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import OnboardingStep2 from './OnboardingStep2';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';

vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');

describe('OnboardingStep2', () => {
  it('should prevent submission if total is not 100%', async () => {
    const user = userEvent.setup();
    const mockOnComplete = vi.fn();
    // Mock getDistributionCategories to return empty array (no existing categories)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function() {
      return { getDistributionCategories: vi.fn().mockResolvedValue([]) };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={mockOnComplete} />);

    // Default should be 50, 30, 20 which equals 100.
    const submitBtn = screen.getByRole('button', { name: /guardar distribución/i });
    expect(submitBtn).not.toBeDisabled();

    // Change one to make it != 100
    const basicNeedsInput = screen.getByLabelText(/necesidades básicas/i);
    await user.clear(basicNeedsInput);
    await user.type(basicNeedsInput, '60'); // Total now 110%

    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/debe sumar exactamente 100%/i)).toBeInTheDocument();
  });

  it('should save categories and call onComplete on valid submission', async () => {
    const user = userEvent.setup();
    const mockOnComplete = vi.fn();
    const mockSave = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function() {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionCategory: mockSave,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={mockOnComplete} />);

    const submitBtn = screen.getByRole('button', { name: /guardar distribución/i });
    await user.click(submitBtn);

    expect(mockSave).toHaveBeenCalledTimes(3);
    expect(mockOnComplete).toHaveBeenCalled();
  });
});
