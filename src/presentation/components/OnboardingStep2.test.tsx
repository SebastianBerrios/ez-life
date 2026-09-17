import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import OnboardingStep2 from './OnboardingStep2';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';

vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');
vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const echoSave = () => vi.fn().mockImplementation((data: any) => Promise.resolve({ ...data, created_at: new Date(), updated_at: new Date() }));

describe('OnboardingStep2', () => {
  it('seeds the 3 default buckets on first load and enables submit at 100%', async () => {
    const mockSave = echoSave();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionCategory: mockSave,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const submitBtn = await screen.findByRole('button', { name: /guardar distribución/i });
    expect(mockSave).toHaveBeenCalledTimes(3);
    expect(submitBtn).not.toBeDisabled();
    expect(screen.getByText(/total: 100%/i)).toBeInTheDocument();
  });

  it('disables submit when the total is not 100%', async () => {
    const user = userEvent.setup();
    const mockSave = echoSave();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionCategory: mockSave,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const submitBtn = await screen.findByRole('button', { name: /guardar distribución/i });
    expect(submitBtn).not.toBeDisabled();

    const firstPercentInput = (await screen.findAllByLabelText(/porcentaje de la categoría/i))[0];
    await user.clear(firstPercentInput);
    await user.type(firstPercentInput, '60');

    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/debe sumar exactamente 100%/i)).toBeInTheDocument();
  });

  it('saves all buckets and calls onComplete on valid submission', async () => {
    const user = userEvent.setup();
    const mockOnComplete = vi.fn();
    const mockSave = echoSave();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionCategory: mockSave,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={mockOnComplete} />);

    const submitBtn = await screen.findByRole('button', { name: /guardar distribución/i });
    mockSave.mockClear(); // ignore the 3 seed calls from mount, count only the submit calls

    await user.click(submitBtn);

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(3));
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('blocks deleting the last remaining bucket', async () => {
    const user = userEvent.setup();
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'only-bucket', user_id: 'fake-id', name: 'Único', percentage: 100, is_default: true, is_savings: false },
        ]),
        saveDistributionCategory: echoSave(),
        countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(0),
        deleteDistributionCategory: mockDelete,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const deleteBtn = await screen.findByRole('button', { name: /eliminar categoría/i });
    await user.click(deleteBtn);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/necesitás al menos una categoría/i)).toBeInTheDocument();
  });

  it('blocks deleting a bucket that still has expense categories attached', async () => {
    const user = userEvent.setup();
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'b1', user_id: 'fake-id', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false },
          { id: 'b2', user_id: 'fake-id', name: 'Gustos', percentage: 50, is_default: true, is_savings: false },
        ]),
        saveDistributionCategory: echoSave(),
        countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(2),
        deleteDistributionCategory: mockDelete,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const deleteButtons = await screen.findAllByRole('button', { name: /eliminar categoría/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(mockDelete).not.toHaveBeenCalled());
    expect(screen.getByText(/2 categorías de gasto asociadas/i)).toBeInTheDocument();
  });

  it('blocks deleting a bucket that has movements associated, even with no expense categories attached', async () => {
    const user = userEvent.setup();
    const mockDeleteCategory = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'b1', user_id: 'fake-id', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false },
          { id: 'b2', user_id: 'fake-id', name: 'Ahorro', percentage: 50, is_default: true, is_savings: true },
        ]),
        saveDistributionCategory: echoSave(),
        countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(0),
        deleteDistributionCategory: mockDeleteCategory,
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalMovementRepository as any).mockImplementation(function () {
      return {
        countByDistributionCategory: vi.fn().mockResolvedValue(3),
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const deleteButtons = await screen.findAllByRole('button', { name: /eliminar categoría/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(mockDeleteCategory).not.toHaveBeenCalled());
    expect(screen.getByText(/3 movimientos asociados/i)).toBeInTheDocument();
  });

  it('marking a different bucket as savings unmarks the previous one', async () => {
    const user = userEvent.setup();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionCategory: echoSave(),
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    // Default seed order: Necesidades, Gustos, Ahorro (index 2 starts as savings)
    const savingsToggles = await screen.findAllByRole('radio', { name: /marcar categoría/i });
    expect(savingsToggles[2]).toBeChecked();
    expect(savingsToggles[0]).not.toBeChecked();

    await user.click(savingsToggles[0]);

    expect(savingsToggles[0]).toBeChecked();
    expect(savingsToggles[2]).not.toBeChecked();
  });

  it('cannot leave zero savings buckets by re-clicking the already-active toggle', async () => {
    const user = userEvent.setup();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionCategory: echoSave(),
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const savingsToggles = await screen.findAllByRole('radio', { name: /marcar categoría/i });
    expect(savingsToggles[2]).toBeChecked();

    await user.click(savingsToggles[2]);

    const checkedCount = savingsToggles.filter(
      (toggle) => (toggle as HTMLInputElement).checked
    ).length;
    expect(checkedCount).toBe(1);
    expect(savingsToggles[2]).toBeChecked();
  });
});
