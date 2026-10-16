import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MovementForm from './MovementForm';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
vi.mock('../../infrastructure/repositories/local/LocalIncomeSourceRepository', () => ({
  LocalIncomeSourceRepository: vi.fn(function () { return { getAll: vi.fn().mockResolvedValue([{ id: 'salary', name: 'Sueldo' }]) }; }),
}));

vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');
vi.mock('../../infrastructure/repositories/local/LocalSavingsGoalRepository');

describe('MovementForm', () => {
  it('edits the original movement ID and preserves the selected date and income source', async () => {
    const user = userEvent.setup(); const save = vi.fn();
    vi.mocked(LocalMovementRepository).mockImplementation(function () { return { save } as unknown as LocalMovementRepository; });
    vi.mocked(LocalCategoryRepository).mockImplementation(function () { return { getDistributionCategories: async () => [], getExpenseCategories: async () => [] } as unknown as LocalCategoryRepository; });
    vi.mocked(LocalSavingsGoalRepository).mockImplementation(function () { return { getAll: async () => [] } as unknown as LocalSavingsGoalRepository; });
    render(<MovementForm userId="A" onComplete={vi.fn()} onCancel={vi.fn()} movement={{ id: 'original', user_id: 'A', type: 'INCOME', amount: 1200, date: new Date(2026, 8, 5), income_source_id: 'salary', is_recurring: false, created_at: new Date(), updated_at: new Date() }} />);
    await screen.findByRole('combobox', { name: 'Fuente de ingreso' });
    await user.clear(screen.getByLabelText('Monto')); await user.type(screen.getByLabelText('Monto'), '15.25');
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-09-06' } });
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'original', amount: 1525, income_source_id: 'salary', date: new Date(2026, 8, 6, 12) })));
  });
  it('should transform amount to cents and save movement', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn();
    const mockOnComplete = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalMovementRepository as any).mockImplementation(function() { return { save: mockSave }; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function() {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([{ id: 'cat-id', name: 'Ahorro e Inversión', percentage: 20, is_default: true, is_savings: true }]),
        getExpenseCategories: vi.fn().mockResolvedValue([{ id: 'exp-cat-id', distribution_category_id: 'cat-id', name: 'Alimentación' }]),
        getSubcategories: vi.fn().mockResolvedValue([{ id: 'sub-id', category_id: 'exp-cat-id', name: 'Desayuno' }])
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
    const catSelect = await screen.findByLabelText(/Categoría \(50\/30\/20\)/i);
    expect(catSelect).toBeInTheDocument();
    await user.click(catSelect);
    const catOption = await screen.findByRole('option', { name: /Ahorro e Inversión/i });
    await user.click(catOption);

    // Enter amount
    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, '150.50');

    const disclosure = screen.getByText('Opciones adicionales').closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    await user.click(screen.getByText('Opciones adicionales'));
    expect(disclosure).toHaveAttribute('open');

    // Enter description
    const descInput = screen.getByLabelText(/descripción/i);
    await user.type(descInput, 'Cena familiar');

    // Select Savings Goal (shown because the selected bucket has is_savings: true)
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

  describe('balance adjustment mode (006-ajuste-de-balance-mensual)', () => {
    function mockRepositories(mockSave = vi.fn()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalMovementRepository as any).mockImplementation(function() { return { save: mockSave }; });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalCategoryRepository as any).mockImplementation(function() {
        return {
          getDistributionCategories: vi.fn().mockResolvedValue([{ id: 'cat-id', name: 'Ahorro e Inversión', percentage: 20, is_default: true, is_savings: true }]),
          getExpenseCategories: vi.fn().mockResolvedValue([{ id: 'exp-cat-id', distribution_category_id: 'cat-id', name: 'Alimentación' }]),
          getSubcategories: vi.fn().mockResolvedValue([{ id: 'sub-id', category_id: 'exp-cat-id', name: 'Desayuno' }])
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalSavingsGoalRepository as any).mockImplementation(function() {
        return { getAll: vi.fn().mockResolvedValue([]) };
      });
      return mockSave;
    }

    it('hides category/subcategory selectors once adjustment mode is activated', async () => {
      const user = userEvent.setup();
      mockRepositories();

      render(<MovementForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

      expect(await screen.findByLabelText(/Categoría \(50\/30\/20\)/i)).toBeInTheDocument();

      const adjustmentToggle = screen.getByLabelText(/es un ajuste de balance/i);
      await user.click(adjustmentToggle);

      expect(screen.queryByLabelText(/Categoría \(50\/30\/20\)/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Categoría de gasto/i)).not.toBeInTheDocument();
    });

    it('blocks saving an adjustment without a description', async () => {
      const user = userEvent.setup();
      const mockSave = mockRepositories();

      render(<MovementForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

      await screen.findByLabelText(/Categoría \(50\/30\/20\)/i);
      const adjustmentToggle = screen.getByLabelText(/es un ajuste de balance/i);
      await user.click(adjustmentToggle);

      const amountInput = screen.getByLabelText(/monto/i);
      await user.type(amountInput, '100');

      const form = screen.getByTestId('movement-form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/requiere un motivo/i)).toBeInTheDocument();
      });
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('saves an adjustment with a description and no category fields', async () => {
      const user = userEvent.setup();
      const mockSave = mockRepositories();

      render(<MovementForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

      await screen.findByLabelText(/Categoría \(50\/30\/20\)/i);
      const adjustmentToggle = screen.getByLabelText(/es un ajuste de balance/i);
      await user.click(adjustmentToggle);

      const amountInput = screen.getByLabelText(/monto/i);
      await user.type(amountInput, '100');

      const descInput = screen.getByLabelText(/motivo del ajuste/i);
      await user.type(descInput, 'Regalo inesperado');

      const form = screen.getByTestId('movement-form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
          is_adjustment: true,
          description: 'Regalo inesperado',
          distribution_category_id: undefined,
          expense_category_id: undefined,
          expense_subcategory_id: undefined,
        }));
      });
    });
  });
});
