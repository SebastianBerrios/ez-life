import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import DebtList from './DebtList';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { DomainError } from '../../core/domain/errors/DomainError';

vi.mock('../../infrastructure/repositories/local/LocalDebtRepository');

const lentDebt = {
  id: 'debt-1',
  user_id: 'u1',
  counterparty_name: 'Juan',
  direction: 'lent' as const,
  origin: 'manual' as const,
  amount: 10000,
  settled_amount: 2500,
  created_at: new Date('2026-09-01'),
  updated_at: new Date('2026-09-01'),
};

const recordSettlement = vi.fn();
const remove = vi.fn();

function mockRepo(debts: unknown[] = [lentDebt]) {
  vi.mocked(LocalDebtRepository).mockImplementation(function () {
    return { getAll: vi.fn().mockResolvedValue(debts), recordSettlement, delete: remove } as unknown as InstanceType<typeof LocalDebtRepository>;
  });
}

beforeEach(() => {
  recordSettlement.mockReset().mockResolvedValue(undefined);
  remove.mockReset().mockResolvedValue(undefined);
});

describe('DebtList', () => {
  it('lists a debt with the counterparty, the pending balance and its status', async () => {
    mockRepo();
    render(<DebtList userId="u1" />);

    const card = await screen.findByTestId('debt-debt-1');
    expect(within(card).getByText(/Le prestaste a Juan/)).toBeInTheDocument();
    expect(within(card).getByText('Pendiente')).toBeInTheDocument();
    expect(within(card).getByText('75.00')).toBeInTheDocument(); // 100.00 - 25.00
    expect(within(card).getByText('100.00')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar', { name: 'Devuelto de Juan' })).toHaveAttribute('aria-valuenow', '25');
  });

  it('labels a borrowed debt and shows a settled one as "Saldado" without payment controls', async () => {
    mockRepo([{ ...lentDebt, direction: 'borrowed', settled_amount: 10000 }]);
    render(<DebtList userId="u1" />);

    expect(await screen.findByText(/Te prestó Juan/)).toBeInTheDocument();
    expect(screen.getByText('Saldado ✓')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar devolución' })).toBeNull();
  });

  it('shows the empty message when there are no debts', async () => {
    mockRepo([]);
    render(<DebtList userId="u1" />);
    expect(await screen.findByText('No tenés préstamos registrados.')).toBeInTheDocument();
  });

  it('registers a repayment parsed to integer cents (parseMoney) and clears the input', async () => {
    const user = userEvent.setup();
    mockRepo();
    render(<DebtList userId="u1" />);
    const input = await screen.findByLabelText('Monto de la devolución');

    await user.type(input, '25.5');
    await user.click(screen.getByRole('button', { name: 'Registrar devolución' }));

    await waitFor(() => expect(recordSettlement).toHaveBeenCalledWith('debt-1', 2550));
    expect(input).toHaveValue('');
  });

  it.each([['', 'empty'], ['1.2.3', 'two decimal points'], ['10.123', 'three decimals']])(
    'rejects an invalid repayment (%s: %s) with a message and never calls the repository',
    async (value) => {
      const user = userEvent.setup();
      mockRepo();
      render(<DebtList userId="u1" />);
      const input = await screen.findByLabelText('Monto de la devolución');

      if (value) await user.type(input, value);
      await user.click(screen.getByRole('button', { name: 'Registrar devolución' }));

      expect(await screen.findByText(/hasta dos decimales/i)).toBeInTheDocument();
      expect(recordSettlement).not.toHaveBeenCalled();
    },
  );

  it('shows the domain error when the repository rejects the repayment', async () => {
    const user = userEvent.setup();
    recordSettlement.mockRejectedValue(new DomainError('La devolución supera lo pendiente.'));
    mockRepo();
    render(<DebtList userId="u1" />);

    await user.type(await screen.findByLabelText('Monto de la devolución'), '500');
    await user.click(screen.getByRole('button', { name: 'Registrar devolución' }));

    expect(await screen.findByText('La devolución supera lo pendiente.')).toBeInTheDocument();
  });

  it('marks the debt as settled for the exact remaining amount', async () => {
    const user = userEvent.setup();
    mockRepo();
    render(<DebtList userId="u1" />);

    await user.click(await screen.findByRole('button', { name: 'Marcar como saldado' }));

    await waitFor(() => expect(recordSettlement).toHaveBeenCalledWith('debt-1', 7500));
  });

  it('deletes after confirmation only', async () => {
    const user = userEvent.setup();
    mockRepo();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<DebtList userId="u1" />);

    await user.click(await screen.findByRole('button', { name: 'Borrar' }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('debt-1'));
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
