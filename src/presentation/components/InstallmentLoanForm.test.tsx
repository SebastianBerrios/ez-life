import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import InstallmentLoanForm from './InstallmentLoanForm';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';

vi.mock('../../infrastructure/repositories/local/LocalInstallmentLoanRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');

function mockCategories() {
  vi.mocked(LocalCategoryRepository).mockImplementation(function () {
    return {
      getDistributionCategories: vi.fn().mockResolvedValue([
        { id: 'bucket-1', user_id: 'fake-user-id', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false, created_at: new Date(), updated_at: new Date() },
        { id: 'bucket-2', user_id: 'fake-user-id', name: 'Deseos', percentage: 30, is_default: true, is_savings: false, created_at: new Date(), updated_at: new Date() },
      ]),
    } as unknown as InstanceType<typeof LocalCategoryRepository>;
  });
}

describe('InstallmentLoanForm', () => {
  it('creates a loan invoking create() with exactly the four entered values, without any transformation (FR-011, FR-012)', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn();
    const mockOnComplete = vi.fn();
    mockCategories();
    vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
    });

    render(<InstallmentLoanForm userId="fake-user-id" onComplete={mockOnComplete} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/entidad/i), 'BCP');
    await user.type(screen.getByLabelText(/^monto$/i), '2000.00');
    await user.type(screen.getByLabelText(/n° de cuotas/i), '12');
    await user.type(screen.getByLabelText(/monto de cuota/i), '200.00');
    await user.type(screen.getByLabelText(/interés/i), '15');

    const catSelect = await screen.findByLabelText(/categoría/i);
    await user.click(catSelect);
    await user.click(await screen.findByRole('option', { name: /necesidades/i }));

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'fake-user-id',
        lender_name: 'BCP',
        amount: 200000,
        installment_count: 12,
        installment_amount: 20000,
        interest_rate: 15,
        distribution_category_id: 'bucket-1',
      }));
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('requires a distribution category to be selected before creating a loan (FR-010/FR-011 — a Movement needs a real bucket)', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn();
    mockCategories();
    vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
    });

    render(<InstallmentLoanForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/entidad/i), 'BCP');
    await user.type(screen.getByLabelText(/^monto$/i), '2000.00');
    await user.type(screen.getByLabelText(/n° de cuotas/i), '12');
    await user.type(screen.getByLabelText(/monto de cuota/i), '200.00');
    await screen.findByLabelText(/categoría/i);
    // Category deliberately left unselected.

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    expect(await screen.findByText(/elige.*categoría/i)).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([['amount', '10.123', '200.00'], ['installment amount', '2000.00', '1.2.3']])(
    'rejects an invalid %s with a message and never creates the loan (parseMoney)',
    async (_label, amount, installmentAmount) => {
      const user = userEvent.setup();
      const mockCreate = vi.fn();
      mockCategories();
      vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
        return { create: mockCreate } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
      });

      render(<InstallmentLoanForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/entidad/i), 'BCP');
      await user.type(screen.getByLabelText(/^monto$/i), amount);
      await user.type(screen.getByLabelText(/n° de cuotas/i), '12');
      await user.type(screen.getByLabelText(/monto de cuota/i), installmentAmount);
      await user.click(await screen.findByLabelText(/categoría/i));
      await user.click(await screen.findByRole('option', { name: /necesidades/i }));
      fireEvent.submit(screen.getByTestId('installment-loan-form'));

      expect(await screen.findByText(/hasta dos decimales/i)).toBeInTheDocument();
      expect(mockCreate).not.toHaveBeenCalled();
    },
  );

  it('never lets the interest rate reach any calculation — it is passed through untouched (FR-013)', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn();
    mockCategories();
    vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
    });

    render(<InstallmentLoanForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/entidad/i), 'Caja Arequipa');
    await user.type(screen.getByLabelText(/^monto$/i), '1000.00');
    await user.type(screen.getByLabelText(/n° de cuotas/i), '10');
    await user.type(screen.getByLabelText(/monto de cuota/i), '110.00');
    // interest rate left empty on purpose — it's optional

    const catSelect = await screen.findByLabelText(/categoría/i);
    await user.click(catSelect);
    await user.click(await screen.findByRole('option', { name: /necesidades/i }));

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ interest_rate: undefined }));
    });
    // No installment_amount/amount value here was derived from interest_rate.
  });

  it('edit mode (existing prop) prefills fields (including its category) and calls updateTerms instead of create (FR-022)', async () => {
    const user = userEvent.setup();
    const mockUpdateTerms = vi.fn();
    const mockOnComplete = vi.fn();
    mockCategories();
    vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
      return { updateTerms: mockUpdateTerms } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
    });

    const existing = {
      id: 'loan-1',
      user_id: 'fake-user-id',
      lender_name: 'BCP',
      amount: 200000,
      installment_count: 12,
      remaining_installments: 10,
      installment_amount: 20000,
      interest_rate: 15,
      status: 'active' as const,
      distribution_category_id: 'bucket-1',
      created_at: new Date(),
      updated_at: new Date(),
    };

    render(<InstallmentLoanForm userId="fake-user-id" existing={existing} onComplete={mockOnComplete} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/entidad/i)).toHaveValue('BCP');
    expect(screen.getByLabelText(/^monto$/i)).toHaveValue('2000.00');
    expect(await screen.findByText(/necesidades/i)).toBeInTheDocument(); // pre-filled category

    const amountInput = screen.getByLabelText(/^monto$/i);
    await user.clear(amountInput);
    await user.type(amountInput, '2100.00');

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    await waitFor(() => {
      expect(mockUpdateTerms).toHaveBeenCalledWith('loan-1', expect.objectContaining({ amount: 210000, distributionCategoryId: 'bucket-1' }));
    });
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('lets an existing loan missing its category select one and save it via updateTerms — the gate InstallmentLoanList relies on before accepting a new payment (FR-010/FR-011)', async () => {
    const user = userEvent.setup();
    const mockUpdateTerms = vi.fn();
    mockCategories();
    vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
      return { updateTerms: mockUpdateTerms } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
    });

    const existing = {
      id: 'loan-1',
      user_id: 'fake-user-id',
      lender_name: 'BCP',
      amount: 200000,
      installment_count: 12,
      remaining_installments: 10,
      installment_amount: 20000,
      status: 'active' as const,
      // distribution_category_id deliberately absent — a pre-existing loan from before this fix.
      created_at: new Date(),
      updated_at: new Date(),
    };

    render(<InstallmentLoanForm userId="fake-user-id" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);

    const catSelect = await screen.findByLabelText(/categoría/i);
    await user.click(catSelect);
    await user.click(await screen.findByRole('option', { name: /necesidades/i }));

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    await waitFor(() => {
      expect(mockUpdateTerms).toHaveBeenCalledWith('loan-1', expect.objectContaining({ distributionCategoryId: 'bucket-1' }));
    });
  });
});
