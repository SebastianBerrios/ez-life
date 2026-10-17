import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentAccountSettings from './PaymentAccountSettings';

const repos = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  movements: [] as Array<Record<string, unknown>>,
  save: vi.fn(),
  archive: vi.fn(),
}));

vi.mock('../../infrastructure/repositories/local/LocalPaymentAccountRepository', () => ({
  LocalPaymentAccountRepository: vi.fn(function () {
    return { getAll: vi.fn(async () => repos.accounts), save: repos.save, archive: repos.archive };
  }),
}));
vi.mock('../../infrastructure/repositories/local/LocalMovementRepository', () => ({
  LocalMovementRepository: vi.fn(function () { return { getAll: vi.fn(async () => repos.movements) }; }),
}));

const now = new Date(2026, 9, 16, 12, 0);
const account = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, user_id: 'A', name, kind: 'debit', opening_balance: 0, created_at: now, updated_at: now, ...extra,
});
const movement = (extra: Record<string, unknown>) => ({
  id: Math.random().toString(36), user_id: 'A', amount: 0, date: now, is_recurring: false, created_at: now, updated_at: now, ...extra,
});

beforeEach(() => {
  repos.save.mockReset().mockResolvedValue(undefined);
  repos.archive.mockReset().mockResolvedValue(undefined);
  repos.accounts = [
    account('cash', 'Efectivo', { kind: 'cash', opening_balance: 5000 }),
    account('bank', 'BCP', { kind: 'debit', opening_balance: 10000 }),
    account('old', 'Vieja', { archived: true }),
  ];
  repos.movements = [
    movement({ type: 'INCOME', account_id: 'bank', amount: 20000 }),
    movement({ type: 'EXPENSE', account_id: 'bank', amount: 3000 }),
    movement({ type: 'TRANSFER', account_id: 'bank', to_account_id: 'cash', amount: 5000 }),
  ];
});

describe('PaymentAccountSettings', () => {
  it('lists the non-archived accounts with kind and current balance (opening + movements, transfers included)', async () => {
    render(<PaymentAccountSettings userId="A" />);
    expect(await screen.findByText('BCP')).toBeInTheDocument();
    expect(screen.queryByText('Vieja')).not.toBeInTheDocument();
    expect(screen.getByText('Débito')).toBeInTheDocument();
    expect(screen.getAllByText('Efectivo').length).toBeGreaterThan(0);
    // BCP: 100 + 200 - 30 - 50 = 220.00 ; Efectivo: 50 + 50 = 100.00
    expect(screen.getByLabelText('Saldo de BCP')).toHaveTextContent(/S\/\s*220\.00/);
    expect(screen.getByLabelText('Saldo de Efectivo')).toHaveTextContent(/S\/\s*100\.00/);
  });

  it('explains that an account with movements is archived, not deleted', async () => {
    render(<PaymentAccountSettings userId="A" />);
    await screen.findByText('BCP');
    expect(screen.getByText(/3 movimientos · se archiva, no se elimina/)).toBeInTheDocument(); // BCP
    expect(screen.getByText(/1 movimiento · se archiva, no se elimina/)).toBeInTheDocument(); // Efectivo
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it('creates an account with its opening balance in integer cents', async () => {
    const user = userEvent.setup();
    render(<PaymentAccountSettings userId="A" />);
    await user.click(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    await user.type(screen.getByLabelText('Nombre de la cuenta'), 'Interbank');
    await user.type(screen.getByLabelText('Saldo inicial'), '1,250.75');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(repos.save).toHaveBeenCalledWith(expect.objectContaining({
      id: '', user_id: 'A', name: 'Interbank', kind: 'debit', opening_balance: 125075,
    })));
    await waitFor(() => expect(screen.queryByTestId('payment-account-form')).not.toBeInTheDocument());
  });

  it('rejects an empty name and a malformed balance without saving', async () => {
    const user = userEvent.setup();
    render(<PaymentAccountSettings userId="A" />);
    await user.click(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('El nombre de la cuenta es obligatorio.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre de la cuenta'), 'X');
    await user.type(screen.getByLabelText('Saldo inicial'), '1.234');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/hasta dos decimales/)).toBeInTheDocument();
    expect(repos.save).not.toHaveBeenCalled();
  });

  it('only lets a credit account start with a negative balance', async () => {
    const user = userEvent.setup();
    render(<PaymentAccountSettings userId="A" />);
    await user.click(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    await user.type(screen.getByLabelText('Nombre de la cuenta'), 'Visa');
    await user.type(screen.getByLabelText('Saldo inicial'), '-300');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/Solo una cuenta de crédito/)).toBeInTheDocument();
    expect(repos.save).not.toHaveBeenCalled();

    await user.click(screen.getByRole('combobox', { name: 'Tipo' }));
    await user.click(await screen.findByRole('option', { name: 'Crédito' }));
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(repos.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Visa', kind: 'credit', opening_balance: -30000 })));
  });

  it('renames an account and edits its opening balance, keeping id and kind', async () => {
    const user = userEvent.setup();
    render(<PaymentAccountSettings userId="A" />);
    await user.click(await screen.findByRole('button', { name: 'Editar BCP' }));
    const name = screen.getByLabelText('Nombre de la cuenta');
    const balance = screen.getByLabelText('Saldo inicial');
    expect(name).toHaveValue('BCP');
    expect(balance).toHaveValue('100.00');
    await user.clear(name);
    await user.type(name, 'BCP Sueldo');
    await user.clear(balance);
    await user.type(balance, '150');
    await user.click(screen.getByRole('button', { name: 'Guardar cuenta' }));
    await waitFor(() => expect(repos.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'bank', user_id: 'A', name: 'BCP Sueldo', kind: 'debit', opening_balance: 15000,
    })));
  });

  it('archives only after confirming, and can cancel', async () => {
    const user = userEvent.setup();
    render(<PaymentAccountSettings userId="A" />);
    await user.click(await screen.findByRole('button', { name: 'Archivar BCP' }));
    const confirm = screen.getByRole('group', { name: 'Confirmar archivar BCP' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(repos.archive).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Archivar BCP' }));
    await user.click(within(screen.getByRole('group', { name: 'Confirmar archivar BCP' })).getByRole('button', { name: 'Sí, archivar' }));
    await waitFor(() => expect(repos.archive).toHaveBeenCalledWith('bank'));
  });

  it('keeps the last active account: it cannot be archived', async () => {
    repos.accounts = [account('cash', 'Efectivo', { kind: 'cash' })];
    repos.movements = [];
    render(<PaymentAccountSettings userId="A" />);
    expect(await screen.findByRole('button', { name: 'Archivar Efectivo' })).toBeDisabled();
  });
});
