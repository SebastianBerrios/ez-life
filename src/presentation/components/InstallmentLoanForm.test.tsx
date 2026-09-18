import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import InstallmentLoanForm from './InstallmentLoanForm';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';

vi.mock('../../infrastructure/repositories/local/LocalInstallmentLoanRepository');

describe('InstallmentLoanForm', () => {
  it('creates a loan invoking create() with exactly the four entered values, without any transformation (FR-011, FR-012)', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn();
    const mockOnComplete = vi.fn();
    vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
    });

    render(<InstallmentLoanForm userId="fake-user-id" onComplete={mockOnComplete} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/entidad/i), 'BCP');
    await user.type(screen.getByLabelText(/^monto$/i), '2000.00');
    await user.type(screen.getByLabelText(/n° de cuotas/i), '12');
    await user.type(screen.getByLabelText(/monto de cuota/i), '200.00');
    await user.type(screen.getByLabelText(/interés/i), '15');

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'fake-user-id',
        lender_name: 'BCP',
        amount: 200000,
        installment_count: 12,
        installment_amount: 20000,
        interest_rate: 15,
      }));
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('never lets the interest rate reach any calculation — it is passed through untouched (FR-013)', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn();
    vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
    });

    render(<InstallmentLoanForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/entidad/i), 'Caja Arequipa');
    await user.type(screen.getByLabelText(/^monto$/i), '1000.00');
    await user.type(screen.getByLabelText(/n° de cuotas/i), '10');
    await user.type(screen.getByLabelText(/monto de cuota/i), '110.00');
    // interest rate left empty on purpose — it's optional

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ interest_rate: undefined }));
    });
    // No installment_amount/amount value here was derived from interest_rate.
  });

  it('edit mode (existing prop) prefills fields and calls updateTerms instead of create (FR-022)', async () => {
    const user = userEvent.setup();
    const mockUpdateTerms = vi.fn();
    const mockOnComplete = vi.fn();
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
      created_at: new Date(),
      updated_at: new Date(),
    };

    render(<InstallmentLoanForm userId="fake-user-id" existing={existing} onComplete={mockOnComplete} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/entidad/i)).toHaveValue('BCP');
    expect(screen.getByLabelText(/^monto$/i)).toHaveValue('2000.00');

    const amountInput = screen.getByLabelText(/^monto$/i);
    await user.clear(amountInput);
    await user.type(amountInput, '2100.00');

    fireEvent.submit(screen.getByTestId('installment-loan-form'));

    await waitFor(() => {
      expect(mockUpdateTerms).toHaveBeenCalledWith('loan-1', expect.objectContaining({ amount: 210000 }));
    });
    expect(mockOnComplete).toHaveBeenCalled();
  });
});
