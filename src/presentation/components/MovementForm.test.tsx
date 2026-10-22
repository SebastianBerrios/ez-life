import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MovementForm from './MovementForm';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { defaultCashAccountId } from '../../core/use-cases/defaultPaymentAccount';

const accountRows = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('../../infrastructure/repositories/local/LocalPaymentAccountRepository', () => ({
  LocalPaymentAccountRepository: vi.fn(function () { return { getAll: vi.fn(async () => accountRows.list) }; }),
}));
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
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'original', amount: 1525, income_source_id: 'salary', date: new Date(2026, 8, 6, 0, 0) })));
  });
  it('only offers expense categories that already have at least one subcategory (FR-018)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalMovementRepository as any).mockImplementation(function() { return { save: vi.fn() }; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function() {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([{ id: 'cat-id', name: 'Necesidades', percentage: 100, is_default: true, is_savings: false }]),
        getExpenseCategories: vi.fn().mockResolvedValue([
          { id: 'full', distribution_category_id: 'cat-id', name: 'Alimentación' },
          { id: 'empty', distribution_category_id: 'cat-id', name: 'Categoría nueva vacía' },
        ]),
        getSubcategories: vi.fn(async (categoryId: string) => categoryId === 'full' ? [{ id: 'sub-id', category_id: 'full', name: 'Desayuno' }] : []),
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalSavingsGoalRepository as any).mockImplementation(function() { return { getAll: vi.fn().mockResolvedValue([]) }; });

    render(<MovementForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByRole('radio', { name: /Alimentación/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Categoría nueva vacía/i })).not.toBeInTheDocument();
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

    // Default type is EXPENSE (no `type` prop: the form shows its own Gasto/Ingreso switch)

    // The category cards render after dataLoaded=true; each names its bucket, so picking one picks the bucket.
    const catCard = await screen.findByRole('radio', { name: /Alimentación.*Ahorro e Inversión \(20%\)/i });
    await user.click(catCard);
    expect(catCard).toBeChecked();

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

      expect(await screen.findByRole('radiogroup', { name: /Categoría/i })).toBeInTheDocument();

      const adjustmentToggle = screen.getByLabelText(/es un ajuste de balance/i);
      await user.click(adjustmentToggle);

      expect(screen.queryByRole('radiogroup', { name: /Categoría/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: /Alimentación/i })).not.toBeInTheDocument();
    });

    it('blocks saving an adjustment without a description', async () => {
      const user = userEvent.setup();
      const mockSave = mockRepositories();

      render(<MovementForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

      await screen.findByRole('radiogroup', { name: /Categoría/i });
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

      await screen.findByRole('radiogroup', { name: /Categoría/i });
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

  describe('time and payment account (011-cuentas-hora-prioridad)', () => {
    const when = new Date(2026, 8, 5, 19, 45);
    const account = (id: string, name: string, extra: object = {}) => ({ id, user_id: 'A', name, kind: 'cash', opening_balance: 0, created_at: when, updated_at: when, ...extra });

    function mockRepositories(save = vi.fn()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalMovementRepository as any).mockImplementation(function() { return { save }; });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalCategoryRepository as any).mockImplementation(function() {
        return {
          getDistributionCategories: vi.fn().mockResolvedValue([{ id: 'bucket', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false }]),
          getExpenseCategories: vi.fn().mockResolvedValue([{ id: 'cat', distribution_category_id: 'bucket', name: 'Comida' }]),
          getSubcategories: vi.fn().mockResolvedValue([{ id: 'sub', category_id: 'cat', name: 'Almuerzo' }]),
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalSavingsGoalRepository as any).mockImplementation(function() { return { getAll: vi.fn().mockResolvedValue([]) }; });
      return save;
    }

    it('shows the movement time when editing and keeps it on save', async () => {
      accountRows.list = [];
      const save = mockRepositories();
      render(<MovementForm userId="A" onComplete={vi.fn()} onCancel={vi.fn()}
        movement={{ id: 'm1', user_id: 'A', type: 'INCOME', amount: 1200, date: when, income_source_id: 'salary', is_recurring: false, created_at: when, updated_at: when }} />);
      await screen.findByRole('combobox', { name: 'Fuente de ingreso' });
      expect(screen.getByLabelText('Hora')).toHaveValue('19:45');
      fireEvent.submit(screen.getByTestId('movement-form'));
      await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', date: new Date(2026, 8, 5, 19, 45) })));
    });

    it('saves the date combined with the chosen time', async () => {
      accountRows.list = [];
      const save = mockRepositories();
      const user = userEvent.setup();
      render(<MovementForm userId="A" onComplete={vi.fn()} onCancel={vi.fn()} />);
      await screen.findByRole('radiogroup', { name: /Categoría/i });
      fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-16' } });
      fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '08:05' } });
      await user.type(screen.getByLabelText(/monto/i), '10');
      fireEvent.submit(screen.getByTestId('movement-form'));
      await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ date: new Date(2026, 9, 16, 8, 5) })));
    });

    it('defaults the account chips to the Efectivo account of the user and saves its id', async () => {
      const cashId = defaultCashAccountId('A');
      accountRows.list = [account('bank', 'BCP'), account(cashId, 'Efectivo')];
      const save = mockRepositories();
      const user = userEvent.setup();
      render(<MovementForm userId="A" onComplete={vi.fn()} onCancel={vi.fn()} />);
      const cash = await screen.findByRole('radio', { name: 'Efectivo' });
      expect(cash).toBeChecked();
      expect(screen.getByRole('radio', { name: 'BCP' })).not.toBeChecked();
      await user.type(screen.getByLabelText(/monto/i), '10');
      fireEvent.submit(screen.getByTestId('movement-form'));
      await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ account_id: cashId, to_account_id: undefined })));
    });

    it('lets the user pick another account and hides archived ones', async () => {
      accountRows.list = [account('bank', 'BCP'), account('old', 'Vieja', { archived: true })];
      const save = mockRepositories();
      const user = userEvent.setup();
      render(<MovementForm userId="A" onComplete={vi.fn()} onCancel={vi.fn()} />);
      await screen.findByRole('radiogroup', { name: 'Cuenta de pago' });
      expect(screen.queryByRole('radio', { name: 'Vieja' })).not.toBeInTheDocument();
      await user.click(await screen.findByRole('radio', { name: 'BCP' }));
      await user.type(screen.getByLabelText(/monto/i), '10');
      fireEvent.submit(screen.getByTestId('movement-form'));
      await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ account_id: 'bank' })));
    });
  });

  describe('quick record redesign (spec 010)', () => {
    const when = new Date(2026, 9, 16, 15, 30);
    const account = (id: string, name: string) => ({ id, user_id: 'A', name, kind: 'cash', opening_balance: 0, created_at: when, updated_at: when });

    function mockRepositories(save = vi.fn(), opts: { noCategories?: boolean; wantsFirst?: boolean } = {}) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalMovementRepository as any).mockImplementation(function() { return { save }; });
      const buckets = [
        { id: 'needs', name: 'Necesidades Básicas', percentage: 50, is_default: true, is_savings: false },
        { id: 'wants', name: 'Estilo de Vida', percentage: 30, is_default: true, is_savings: false },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalCategoryRepository as any).mockImplementation(function() {
        return {
          getDistributionCategories: vi.fn().mockResolvedValue(opts.wantsFirst ? [...buckets].reverse() : buckets),
          getExpenseCategories: vi.fn().mockResolvedValue(opts.noCategories ? [] : [
            { id: 'food', distribution_category_id: 'needs', name: 'Alimentación' },
            { id: 'fun', distribution_category_id: 'wants', name: 'Entretenimiento' },
          ]),
          getSubcategories: vi.fn(async (id: string) => id === 'food'
            ? [{ id: 'breakfast', category_id: 'food', name: 'Desayuno' }, { id: 'lunch', category_id: 'food', name: 'Almuerzo' }]
            : [{ id: 'cinema', category_id: 'fun', name: 'Cine' }]),
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalSavingsGoalRepository as any).mockImplementation(function() { return { getAll: vi.fn().mockResolvedValue([]) }; });
      return save;
    }

    const renderForm = (props: Partial<React.ComponentProps<typeof MovementForm>> = {}) =>
      render(<MovementForm userId="A" onComplete={vi.fn()} onCancel={vi.fn()} {...props} />);

    it('adds the quick amounts in integer cents and clears them', async () => {
      accountRows.list = [];
      mockRepositories();
      const user = userEvent.setup();
      renderForm({ type: 'EXPENSE' });
      const amount = await screen.findByLabelText('Monto');
      await user.click(screen.getByRole('button', { name: 'Sumar S/ 10' }));
      await user.click(screen.getByRole('button', { name: 'Sumar S/ 20' }));
      await user.click(screen.getByRole('button', { name: 'Sumar S/ 100' }));
      expect(amount).toHaveValue('130.00');
      await user.click(screen.getByRole('button', { name: 'Limpiar monto' }));
      expect(amount).toHaveValue('');
    });

    it('lists the expense categories as cards with their bucket and percentage, first one selected', async () => {
      accountRows.list = [];
      mockRepositories();
      renderForm({ type: 'EXPENSE' });
      expect(await screen.findByRole('radio', { name: /Alimentación.*Necesidades Básicas \(50%\)/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /Entretenimiento.*Estilo de Vida \(30%\)/ })).not.toBeChecked();
    });

    it('orders the cards by bucket size (50/30/20) whatever order the repository returns, and preselects the first', async () => {
      accountRows.list = [];
      mockRepositories(vi.fn(), { wantsFirst: true });
      renderForm({ type: 'EXPENSE' });
      const cards = await screen.findAllByRole('radio', { name: /Necesidades|Estilo de Vida/ });
      expect(cards.map(card => card.closest('label')?.textContent)).toEqual([
        'AlimentaciónNecesidades Básicas (50%)',
        'EntretenimientoEstilo de Vida (30%)',
      ]);
      expect(cards[0]).toBeChecked();
    });

    it('shows subcategory chips for the chosen category and sends the category, bucket and subcategory', async () => {
      accountRows.list = [];
      const save = mockRepositories();
      const user = userEvent.setup();
      renderForm({ type: 'EXPENSE' });
      await user.click(await screen.findByRole('radio', { name: /Entretenimiento/ }));
      expect(screen.queryByRole('button', { name: 'Desayuno' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cine' }));
      expect(screen.getByRole('button', { name: 'Cine' })).toHaveAttribute('aria-pressed', 'true');
      await user.type(screen.getByLabelText('Monto'), '25');
      fireEvent.submit(screen.getByTestId('movement-form'));
      await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EXPENSE', amount: 2500, distribution_category_id: 'wants', expense_category_id: 'fun', expense_subcategory_id: 'cinema',
      })));
    });

    it('keeps the subcategory optional', async () => {
      accountRows.list = [];
      const save = mockRepositories();
      const user = userEvent.setup();
      renderForm({ type: 'EXPENSE' });
      await screen.findByRole('radio', { name: /Alimentación/ });
      await user.type(screen.getByLabelText('Monto'), '9');
      fireEvent.submit(screen.getByTestId('movement-form'));
      await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ expense_category_id: 'food', expense_subcategory_id: undefined })));
    });

    it('explains what is missing instead of saving an expense without a category', async () => {
      accountRows.list = [];
      const save = mockRepositories(vi.fn(), { noCategories: true });
      const user = userEvent.setup();
      renderForm({ type: 'EXPENSE' });
      await screen.findByText(/Todavía no tienes categorías de gasto/);
      await user.type(screen.getByLabelText('Monto'), '9');
      fireEvent.submit(screen.getByTestId('movement-form'));
      expect(await screen.findByText('Selecciona una categoría de gasto.')).toBeInTheDocument();
      expect(save).not.toHaveBeenCalled();
    });

    it('uses the type given by the host and keeps the typed amount and description when it changes', async () => {
      accountRows.list = [];
      const save = mockRepositories();
      const user = userEvent.setup();
      const { rerender } = renderForm({ type: 'EXPENSE' });
      await screen.findByRole('radio', { name: /Alimentación/ });
      expect(screen.getByText('EGRESO')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Gasto' })).not.toBeInTheDocument(); // no own switch when fixed from outside
      await user.type(screen.getByLabelText('Monto'), '42.5');
      await user.type(screen.getByLabelText(/descripción/i), 'Bono');
      rerender(<MovementForm userId="A" type="INCOME" onComplete={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByText('INGRESO')).toBeInTheDocument();
      expect(screen.getByLabelText('Monto')).toHaveValue('42.50');
      expect(screen.getByLabelText(/descripción/i)).toHaveValue('Bono');
      expect(screen.queryByRole('radiogroup', { name: /Categoría/i })).not.toBeInTheDocument();
      await screen.findByRole('combobox', { name: 'Fuente de ingreso' });
      fireEvent.submit(screen.getByTestId('movement-form'));
      await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
        type: 'INCOME', amount: 4250, description: 'Bono', income_source_id: 'salary', expense_category_id: undefined, distribution_category_id: undefined,
      })));
    });

    it('labels the description as optional, and as required for a balance adjustment', async () => {
      accountRows.list = [];
      mockRepositories();
      const user = userEvent.setup();
      renderForm({ type: 'EXPENSE' });
      await screen.findByRole('radiogroup', { name: /Categoría/i });
      expect(screen.getAllByText('Opcional').length).toBeGreaterThan(0);
      expect(screen.queryByText('Requerido')).not.toBeInTheDocument();
      await user.click(screen.getByLabelText(/es un ajuste de balance/i));
      expect(screen.getByText('Requerido')).toBeInTheDocument();
    });

    describe('Guardar y registrar otro', () => {
      it('saves, confirms with a status message, clears amount/description and keeps type, category, account and time', async () => {
        const cashId = defaultCashAccountId('A');
        accountRows.list = [account('bank', 'BCP'), account(cashId, 'Efectivo')];
        const save = mockRepositories();
        const onComplete = vi.fn();
        const onSavedAndNew = vi.fn();
        const user = userEvent.setup();
        renderForm({ type: 'EXPENSE', onComplete, onSavedAndNew });
        await user.click(await screen.findByRole('radio', { name: /Entretenimiento/ }));
        await user.click(screen.getByRole('radio', { name: 'BCP' }));
        fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '08:05' } });
        await user.type(screen.getByLabelText('Monto'), '12');
        await user.type(screen.getByLabelText(/descripción/i), 'Cine con amigos');

        await user.click(screen.getByRole('button', { name: 'Guardar y registrar otro' }));

        await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ amount: 1200, description: 'Cine con amigos', expense_category_id: 'fun', account_id: 'bank' })));
        expect(await screen.findByRole('status')).toHaveTextContent('Registro guardado');
        expect(onSavedAndNew).toHaveBeenCalledTimes(1);
        expect(onComplete).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Monto')).toHaveValue('');
        expect(screen.getByLabelText(/descripción/i)).toHaveValue('');
        expect(screen.getByRole('radio', { name: /Entretenimiento/ })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'BCP' })).toBeChecked();
        expect(screen.getByLabelText('Hora')).toHaveValue('08:05');
        expect(screen.getByLabelText('Monto')).toHaveFocus();
      });

      it('clears the confirmation as soon as the user types again', async () => {
        accountRows.list = [];
        mockRepositories();
        const user = userEvent.setup();
        renderForm({ type: 'EXPENSE', onSavedAndNew: vi.fn() });
        await screen.findByRole('radio', { name: /Alimentación/ });
        await user.type(screen.getByLabelText('Monto'), '5');
        await user.click(screen.getByRole('button', { name: 'Guardar y registrar otro' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Registro guardado');
        await user.type(screen.getByLabelText('Monto'), '1');
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
      });

      it('validates before saving and offers the action only when the host supports it', async () => {
        accountRows.list = [];
        const save = mockRepositories();
        const user = userEvent.setup();
        const { unmount } = renderForm({ type: 'EXPENSE', onSavedAndNew: vi.fn() });
        await screen.findByRole('radio', { name: /Alimentación/ });
        await user.click(screen.getByRole('button', { name: 'Guardar y registrar otro' }));
        expect(await screen.findByText(/Ingresa un monto/)).toBeInTheDocument();
        expect(save).not.toHaveBeenCalled();
        unmount();
        renderForm({ type: 'EXPENSE' });
        await screen.findByRole('radio', { name: /Alimentación/ });
        expect(screen.queryByRole('button', { name: 'Guardar y registrar otro' })).not.toBeInTheDocument();
      });

      it('is hidden when editing and the form offers Cancelar instead', async () => {
        accountRows.list = [];
        mockRepositories();
        const onCancel = vi.fn();
        const user = userEvent.setup();
        renderForm({
          onSavedAndNew: vi.fn(), onCancel,
          movement: { id: 'm1', user_id: 'A', type: 'INCOME', amount: 1200, date: when, income_source_id: 'salary', is_recurring: false, created_at: when, updated_at: when },
        });
        await screen.findByRole('combobox', { name: 'Fuente de ingreso' });
        expect(screen.queryByRole('button', { name: 'Guardar y registrar otro' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Guardar$/ })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onCancel).toHaveBeenCalled();
      });
    });

    describe('shared space toggle', () => {
      const spaces = [{ id: 's1', name: 'Casa' }];

      it('is offered for a new expense when the user has a shared space', async () => {
        accountRows.list = [];
        mockRepositories();
        renderForm({ type: 'EXPENSE', sharedSpaces: spaces, onContinueShared: vi.fn() });
        const toggle = await screen.findByRole('switch', { name: /afecta al espacio compartido/i });
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByText('Divide este registro con tu pareja o conviviente.')).toBeInTheDocument();
      });

      it.each([
        ['without shared spaces', { type: 'EXPENSE' as const, sharedSpaces: [], onContinueShared: vi.fn() }],
        ['for an income', { type: 'INCOME' as const, sharedSpaces: spaces, onContinueShared: vi.fn() }],
      ])('is hidden %s', async (_name, props) => {
        accountRows.list = [];
        mockRepositories();
        renderForm(props);
        await screen.findByLabelText('Monto');
        await screen.findByText('Opciones adicionales');
        expect(screen.queryByRole('switch', { name: /afecta al espacio compartido/i })).not.toBeInTheDocument();
      });

      it('is hidden when editing a movement and for a balance adjustment', async () => {
        accountRows.list = [];
        mockRepositories();
        const user = userEvent.setup();
        const { unmount } = renderForm({
          type: undefined, sharedSpaces: spaces, onContinueShared: vi.fn(),
          movement: { id: 'm1', user_id: 'A', type: 'EXPENSE', amount: 1200, date: when, distribution_category_id: 'needs', expense_category_id: 'food', is_recurring: false, created_at: when, updated_at: when },
        });
        await screen.findByRole('radio', { name: /Alimentación/ });
        expect(screen.queryByRole('switch', { name: /afecta al espacio compartido/i })).not.toBeInTheDocument();
        unmount();
        renderForm({ type: 'EXPENSE', sharedSpaces: spaces, onContinueShared: vi.fn() });
        await screen.findByRole('switch', { name: /afecta al espacio compartido/i });
        await user.click(screen.getByLabelText(/es un ajuste de balance/i));
        expect(screen.queryByRole('switch', { name: /afecta al espacio compartido/i })).not.toBeInTheDocument();
      });

      it('turns the primary action into "Continuar a gasto compartido" and hands the draft over without saving', async () => {
        accountRows.list = [];
        const save = mockRepositories();
        const onContinueShared = vi.fn();
        const onComplete = vi.fn();
        const user = userEvent.setup();
        renderForm({ type: 'EXPENSE', sharedSpaces: spaces, onContinueShared, onComplete, onSavedAndNew: vi.fn() });
        await user.type(await screen.findByLabelText('Monto'), '80.5');
        await user.click(screen.getByRole('switch', { name: /afecta al espacio compartido/i }));
        expect(screen.getByRole('switch', { name: /afecta al espacio compartido/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.queryByRole('button', { name: 'Guardar y registrar otro' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Continuar a gasto compartido' }));
        expect(onContinueShared).toHaveBeenCalledWith({ spaceId: 's1', amount: '80.50' });
        expect(save).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
      });

      it('asks for the space when the user has several', async () => {
        accountRows.list = [];
        mockRepositories();
        const user = userEvent.setup();
        renderForm({ type: 'EXPENSE', sharedSpaces: [...spaces, { id: 's2', name: 'Viaje' }], onContinueShared: vi.fn() });
        await user.click(await screen.findByRole('switch', { name: /afecta al espacio compartido/i }));
        expect(screen.getByRole('combobox', { name: 'Espacio compartido' })).toBeInTheDocument();
      });
    });
  });
});
