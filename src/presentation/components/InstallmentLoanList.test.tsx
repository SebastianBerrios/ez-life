import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import InstallmentLoanList from './InstallmentLoanList';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { DomainError } from '../../core/domain/errors/DomainError';

vi.mock('../../infrastructure/repositories/local/LocalInstallmentLoanRepository');

const activeLoan = {
  id: 'loan-1',
  user_id: 'fake-user-id',
  lender_name: 'BCP',
  amount: 200000,
  installment_count: 12,
  remaining_installments: 10,
  installment_amount: 20000,
  interest_rate: 15,
  status: 'active' as const,
  created_at: new Date('2026-09-01'),
  updated_at: new Date('2026-09-01'),
};

function mockRepo(overrides: Partial<InstanceType<typeof LocalInstallmentLoanRepository>> = {}) {
  vi.mocked(LocalInstallmentLoanRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue([activeLoan]),
      getPayments: vi.fn().mockResolvedValue([]),
      recordInstallmentPayment: vi.fn(),
      recordPrincipalPayment: vi.fn(),
      delete: vi.fn(),
      ...overrides,
    } as unknown as InstanceType<typeof LocalInstallmentLoanRepository>;
  });
}

describe('InstallmentLoanList', () => {
  it('lists an installment loan with its lender and remaining balance', async () => {
    mockRepo();
    render(<InstallmentLoanList userId="fake-user-id" />);

    expect(await screen.findByText(/BCP/i)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument(); // remaining installments visible somewhere
  });

  it('shows "Pagado/Saldado" for a settled loan and keeps it in the list (FR-025)', async () => {
    mockRepo({ getAll: vi.fn().mockResolvedValue([{ ...activeLoan, remaining_installments: 0, status: 'settled' }]) } as never);
    render(<InstallmentLoanList userId="fake-user-id" />);

    expect(await screen.findByText(/BCP/i)).toBeInTheDocument();
    expect(screen.getByText(/pagado.*saldado/i)).toBeInTheDocument();
  });

  it('asks reduce plazo vs. reduce cuota when registering a principal payment, and lets the user type the resulting value (FR-016, FR-017)', async () => {
    const user = userEvent.setup();
    const mockRecordPrincipalPayment = vi.fn();
    mockRepo({ recordPrincipalPayment: mockRecordPrincipalPayment } as never);

    render(<InstallmentLoanList userId="fake-user-id" />);
    await screen.findByText(/BCP/i);

    await user.click(screen.getByRole('button', { name: /abono a capital/i }));
    await user.type(screen.getByLabelText(/monto del abono/i), '1000.00');

    const adjustmentSelect = screen.getByLabelText(/reduce/i);
    await user.click(adjustmentSelect);
    await user.click(await screen.findByRole('option', { name: /plazo/i }));

    await user.type(screen.getByLabelText(/nuevo número de cuotas/i), '7');
    await user.click(screen.getByRole('button', { name: /confirmar abono/i }));

    await waitFor(() => {
      expect(mockRecordPrincipalPayment).toHaveBeenCalledWith(
        'loan-1',
        100000,
        expect.any(Date),
        { type: 'reduce_term', newRemainingInstallments: 7 }
      );
    });
  });

  it('shows an error and does not apply the change when paying more installments than remain (FR-021)', async () => {
    const user = userEvent.setup();
    const mockRecordInstallmentPayment = vi.fn().mockRejectedValue(new DomainError('No podés pagar más cuotas de las que quedan pendientes.'));
    mockRepo({ recordInstallmentPayment: mockRecordInstallmentPayment } as never);

    render(<InstallmentLoanList userId="fake-user-id" />);
    await screen.findByText(/BCP/i);

    await user.type(screen.getByLabelText(/cuotas a pagar/i), '99');
    await user.click(screen.getByRole('button', { name: /pagar cuota/i }));

    expect(await screen.findByText(/no podés pagar más cuotas/i)).toBeInTheDocument();
  });
});
