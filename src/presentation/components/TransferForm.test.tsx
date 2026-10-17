import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransferForm from './TransferForm';
import { defaultCashAccountId } from '../../core/use-cases/defaultPaymentAccount';

const repos = vi.hoisted(() => ({
  accounts: [] as unknown[],
  saveMovement: vi.fn(),
  saveAccount: vi.fn(),
}));

vi.mock('../../infrastructure/repositories/local/LocalPaymentAccountRepository', () => ({
  LocalPaymentAccountRepository: vi.fn(function () {
    return { getAll: vi.fn(async () => repos.accounts), save: repos.saveAccount };
  }),
}));
vi.mock('../../infrastructure/repositories/local/LocalMovementRepository', () => ({
  LocalMovementRepository: vi.fn(function () { return { save: repos.saveMovement }; }),
}));

const now = new Date(2026, 9, 16, 12, 0);
const account = (id: string, name: string, extra: object = {}) => ({
  id, user_id: 'A', name, kind: 'debit', opening_balance: 0, created_at: now, updated_at: now, ...extra,
});
const cashId = defaultCashAccountId('A');

beforeEach(() => {
  repos.saveMovement.mockReset().mockResolvedValue(undefined);
  repos.saveAccount.mockReset();
  repos.accounts = [account('bank', 'BCP'), account(cashId, 'Efectivo', { kind: 'cash' })];
});

describe('TransferForm', () => {
  it('starts from Efectivo and proposes the other account as destination', async () => {
    render(<TransferForm userId="A" onComplete={vi.fn()} />);
    const from = await screen.findByRole('radiogroup', { name: 'Cuenta de origen' });
    const to = screen.getByRole('radiogroup', { name: 'Cuenta de destino' });
    expect(from.querySelector('input:checked')?.closest('label')).toHaveTextContent('Efectivo');
    expect(to.querySelector('input:checked')?.closest('label')).toHaveTextContent('BCP');
    expect(screen.getByText('TRANSFERENCIA')).toBeInTheDocument();
  });

  it('saves a TRANSFER movement with integer cents, both accounts and no categories', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<TransferForm userId="A" onComplete={onComplete} />);
    await screen.findByRole('radiogroup', { name: 'Cuenta de origen' });
    await user.type(screen.getByLabelText('Monto'), '25.5');
    await user.click(screen.getByRole('button', { name: 'Sumar S/ 10' }));
    await user.type(screen.getByLabelText(/descripción/i), 'Retiro');
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-16' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '18:20' } });
    await user.click(screen.getByRole('button', { name: 'Guardar transferencia' }));

    await waitFor(() => expect(repos.saveMovement).toHaveBeenCalledTimes(1));
    const payload = repos.saveMovement.mock.calls[0][0];
    expect(payload).toEqual({
      id: '',
      user_id: 'A',
      type: 'TRANSFER',
      account_id: cashId,
      to_account_id: 'bank',
      amount: 3550,
      date: new Date(2026, 9, 16, 18, 20),
      description: 'Retiro',
      is_recurring: false,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('requires a valid amount', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<TransferForm userId="A" onComplete={onComplete} />);
    await screen.findByRole('radiogroup', { name: 'Cuenta de origen' });
    await user.click(screen.getByRole('button', { name: 'Guardar transferencia' }));
    expect(await screen.findByText(/Ingresá un monto/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Monto'), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar transferencia' }));
    expect(await screen.findByText('El monto debe ser mayor a 0.')).toBeInTheDocument();
    expect(repos.saveMovement).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('swaps instead of allowing the same account on both sides', async () => {
    const user = userEvent.setup();
    render(<TransferForm userId="A" onComplete={vi.fn()} />);
    const to = await screen.findByRole('radiogroup', { name: 'Cuenta de destino' });
    // destination is BCP, origin Efectivo: choosing Efectivo as destination swaps the pair
    await user.click(screen.getAllByRole('radio', { name: 'Efectivo' })[1]);
    expect(await screen.findByRole('status')).toHaveTextContent('Intercambiamos origen y destino');
    expect(to.querySelector('input:checked')?.closest('label')).toHaveTextContent('Efectivo');
    expect(screen.getByRole('radiogroup', { name: 'Cuenta de origen' }).querySelector('input:checked')?.closest('label')).toHaveTextContent('BCP');
  });

  it('swaps origin and destination with the swap button', async () => {
    const user = userEvent.setup();
    render(<TransferForm userId="A" onComplete={vi.fn()} />);
    await screen.findByRole('radiogroup', { name: 'Cuenta de origen' });
    await user.click(screen.getByRole('button', { name: 'Intercambiar cuentas' }));
    await user.type(screen.getByLabelText('Monto'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar transferencia' }));
    await waitFor(() => expect(repos.saveMovement).toHaveBeenCalledWith(expect.objectContaining({ account_id: 'bank', to_account_id: cashId })));
  });

  it('shows the repository error and keeps the form open', async () => {
    repos.saveMovement.mockRejectedValue(new Error('La cuenta no es válida.'));
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<TransferForm userId="A" onComplete={onComplete} />);
    await screen.findByRole('radiogroup', { name: 'Cuenta de origen' });
    await user.type(screen.getByLabelText('Monto'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar transferencia' }));
    expect(await screen.findByText('La cuenta no es válida.')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  describe('with fewer than two accounts', () => {
    it('explains why and offers to create an account', async () => {
      repos.accounts = [account(cashId, 'Efectivo', { kind: 'cash' })];
      render(<TransferForm userId="A" onComplete={vi.fn()} />);
      expect(await screen.findByText('Necesitás al menos dos cuentas')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
      expect(screen.queryByTestId('transfer-form')).not.toBeInTheDocument();
    });

    it('does not count archived accounts', async () => {
      repos.accounts = [account(cashId, 'Efectivo', { kind: 'cash' }), account('old', 'Vieja', { archived: true })];
      render(<TransferForm userId="A" onComplete={vi.fn()} />);
      expect(await screen.findByText('Necesitás al menos dos cuentas')).toBeInTheDocument();
    });

    it('creates the missing account inline and then shows the transfer form', async () => {
      repos.accounts = [account(cashId, 'Efectivo', { kind: 'cash' })];
      repos.saveAccount.mockImplementation(async () => {
        repos.accounts = [account(cashId, 'Efectivo', { kind: 'cash' }), account('bank', 'BCP')];
        return repos.accounts[1];
      });
      const user = userEvent.setup();
      render(<TransferForm userId="A" onComplete={vi.fn()} />);
      await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
      await user.type(screen.getByLabelText('Nombre de la cuenta'), 'BCP');
      await user.type(screen.getByLabelText('Saldo inicial'), '100.50');
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      await waitFor(() => expect(repos.saveAccount).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'A', name: 'BCP', kind: 'debit', opening_balance: 10050,
      })));
      expect(await screen.findByTestId('transfer-form')).toBeInTheDocument();
    });

    it('can go back from the inline account form', async () => {
      repos.accounts = [account(cashId, 'Efectivo', { kind: 'cash' })];
      const user = userEvent.setup();
      render(<TransferForm userId="A" onComplete={vi.fn()} />);
      await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(await screen.findByText('Necesitás al menos dos cuentas')).toBeInTheDocument();
      expect(repos.saveAccount).not.toHaveBeenCalled();
    });
  });
});
