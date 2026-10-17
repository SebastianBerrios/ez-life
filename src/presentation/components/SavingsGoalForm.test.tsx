import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SavingsGoalForm from './SavingsGoalForm';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { calendarKey } from '../../core/use-cases/calendar';
import type { SavingsGoal } from '../../core/domain/models/types';

vi.mock('../../infrastructure/repositories/local/LocalSavingsGoalRepository');

function mockRepo(mockSave = vi.fn()) {
  vi.mocked(LocalSavingsGoalRepository).mockImplementation(function () {
    return { save: mockSave } as unknown as InstanceType<typeof LocalSavingsGoalRepository>;
  });
  return mockSave;
}

describe('SavingsGoalForm', () => {
  it('should transform amount to cents and save goal', async () => {
    const user = userEvent.setup();
    const mockSave = mockRepo();
    const mockOnComplete = vi.fn();

    render(<SavingsGoalForm userId="fake-user-id" onComplete={mockOnComplete} onCancel={vi.fn()} />);

    // Enter name
    const nameInput = screen.getByLabelText(/nombre/i);
    await user.type(nameInput, 'Viaje');

    // Enter amount
    const amountInput = screen.getByLabelText(/monto objetivo/i);
    await user.type(amountInput, '1500.50');

    // Submit
    const form = screen.getByTestId('goal-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'fake-user-id',
        name: 'Viaje',
        target_amount: 150050, // 1500.50 * 100
      }));
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('parses the amount with parseMoney: same cents as the old parseFloat formula for every valid amount', async () => {
    const user = userEvent.setup();
    const oldFormula = (value: string) => Math.round(parseFloat(value.replace(/,/g, '')) * 100);
    for (const amount of ['0.01', '1', '10', '12.5', '0.10', '1500.50', '99999.99', '1234567.89', '1,500.50', '10,000']) {
      const mockSave = mockRepo();
      const { unmount } = render(<SavingsGoalForm userId="u" onComplete={vi.fn()} onCancel={vi.fn()} />);
      await user.type(screen.getByLabelText(/nombre/i), 'Meta');
      fireEvent.change(screen.getByLabelText(/monto objetivo/i), { target: { value: amount } });
      fireEvent.submit(screen.getByTestId('goal-form'));
      await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
      expect(mockSave.mock.calls[0][0].target_amount).toBe(oldFormula(amount));
      unmount();
    }
  });

  it('rejects what parseFloat used to accept silently (more than two decimals, several dots) without saving', async () => {
    const user = userEvent.setup();
    const mockSave = mockRepo();
    render(<SavingsGoalForm userId="u" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Meta');
    for (const amount of ['10.123', '1.2.3']) {
      fireEvent.change(screen.getByLabelText(/monto objetivo/i), { target: { value: amount } });
      fireEvent.submit(screen.getByTestId('goal-form'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un monto con hasta dos decimales.');
    }
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('rejects a zero amount', async () => {
    const user = userEvent.setup();
    const mockSave = mockRepo();
    render(<SavingsGoalForm userId="u" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Meta');
    await user.type(screen.getByLabelText(/monto objetivo/i), '0');
    fireEvent.submit(screen.getByTestId('goal-form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('stores the deadline as the picked LOCAL calendar day at noon (not UTC midnight, which is the day before west of UTC)', async () => {
    const user = userEvent.setup();
    const mockSave = mockRepo();
    render(<SavingsGoalForm userId="u" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Meta');
    await user.type(screen.getByLabelText(/monto objetivo/i), '100');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });
    fireEvent.submit(screen.getByTestId('goal-form'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const { deadline } = mockSave.mock.calls[0][0];
    expect(deadline).toEqual(new Date(2026, 11, 31, 12));
    expect(calendarKey(deadline)).toBe('2026-12-31');
  });

  it('omits the deadline when left empty', async () => {
    const user = userEvent.setup();
    const mockSave = mockRepo();
    render(<SavingsGoalForm userId="u" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Meta');
    await user.type(screen.getByLabelText(/monto objetivo/i), '100');
    fireEvent.submit(screen.getByTestId('goal-form'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0].deadline).toBeUndefined();
  });

  describe('edit mode', () => {
    const existing: SavingsGoal = {
      id: 'sg1', user_id: 'u', name: 'Viaje', target_amount: 150050, deadline: new Date(2026, 11, 31, 12),
      created_at: new Date(), updated_at: new Date(),
    };

    it('prefills name, amount (from cents) and deadline, and saves with the same id', async () => {
      const user = userEvent.setup();
      const mockSave = mockRepo();
      render(<SavingsGoalForm userId="u" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByText('Editar Meta de Ahorro')).toBeInTheDocument();
      expect(screen.getByLabelText(/nombre/i)).toHaveValue('Viaje');
      expect(screen.getByLabelText(/monto objetivo/i)).toHaveValue('1500.50');
      expect(screen.getByLabelText(/fecha límite/i)).toHaveValue('2026-12-31');

      await user.clear(screen.getByLabelText(/nombre/i));
      await user.type(screen.getByLabelText(/nombre/i), 'Viaje a Cusco');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sg1', name: 'Viaje a Cusco', target_amount: 150050, deadline: new Date(2026, 11, 31, 12),
      })));
    });

    it('clearing the deadline removes it', async () => {
      const user = userEvent.setup();
      const mockSave = mockRepo();
      render(<SavingsGoalForm userId="u" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '' } });
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(mockSave).toHaveBeenCalled());
      expect(mockSave.mock.calls[0][0].deadline).toBeUndefined();
    });
  });

  it('keeps its own title standalone, hides it when embedded, and offers Cancelar', async () => {
    const user = userEvent.setup();
    mockRepo();
    const onCancel = vi.fn();
    const { unmount } = render(<SavingsGoalForm userId="u" onComplete={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('heading', { name: 'Nueva Meta de Ahorro' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    unmount();
    render(<SavingsGoalForm userId="u" embedded onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Nueva Meta de Ahorro' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear meta' })).toBeInTheDocument();
  });
});
