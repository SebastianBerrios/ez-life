import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DebtForm from './DebtForm';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';

vi.mock('../../infrastructure/repositories/local/LocalDebtRepository');

describe('DebtForm', () => {
  it('registers a debt the user lent, with amount transformed to cents', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn();
    const mockOnComplete = vi.fn();
    vi.mocked(LocalDebtRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalDebtRepository>;
    });

    render(<DebtForm userId="fake-user-id" onComplete={mockOnComplete} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Juan');
    await user.type(screen.getByLabelText(/monto/i), '100.00');

    fireEvent.submit(screen.getByTestId('debt-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'fake-user-id',
        counterparty_name: 'Juan',
        direction: 'lent',
        origin: 'manual',
        amount: 10000,
        settled_amount: 0,
      }));
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('registers a debt the user borrowed, with an optional due date and interest rate', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn();
    vi.mocked(LocalDebtRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalDebtRepository>;
    });

    render(<DebtForm userId="fake-user-id" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Ana');
    await user.selectOptions(screen.getByLabelText(/dirección/i), 'borrowed');
    await user.type(screen.getByLabelText(/monto/i), '50.00');
    fireEvent.change(screen.getByLabelText(/vencimiento/i), { target: { value: '2026-12-31' } });
    await user.type(screen.getByLabelText(/interés/i), '5');

    fireEvent.submit(screen.getByTestId('debt-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        direction: 'borrowed',
        amount: 5000,
        due_date: new Date('2026-12-31'),
        interest_rate: 5,
      }));
    });
  });
});
