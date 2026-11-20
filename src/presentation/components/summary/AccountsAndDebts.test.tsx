import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AccountsAndDebts from './AccountsAndDebts';

describe('AccountsAndDebts', () => {
  it('lists debit, cash and savings accounts and shows the friendly empty debts message', () => {
    render(
      <AccountsAndDebts
        accounts={[
          { id: 'cash', name: 'Efectivo', kind: 'cash', balanceCents: 30000 },
          { id: 'debit', name: 'BCP', kind: 'debit', balanceCents: 120000 },
          { id: 'sav', name: 'Ahorros', kind: 'savings', balanceCents: 500000 },
        ]}
        debts={{ cards: [], loans: [], informalDebts: [] }}
      />,
    );

    expect(screen.getByTestId('accounts-and-debts')).toHaveAttribute('data-tour', 'accounts');
    const accountsPanel = screen.getByTestId('summary-accounts');
    expect(within(accountsPanel).getByText('S/ 300.00')).toBeInTheDocument();
    expect(within(accountsPanel).getByText('S/ 1,200.00')).toBeInTheDocument();
    expect(within(accountsPanel).getByText('S/ 5,000.00')).toBeInTheDocument();

    const debtsPanel = screen.getByTestId('summary-debts');
    expect(
      within(debtsPanel).getByText('No tienes tarjetas ni préstamos. Si los tienes, agrégalos para ver cuánto debes.'),
    ).toBeInTheDocument();
  });

  it('renders cards with credit limit, legacy cards without credit limit with action callback, and installment loans', async () => {
    const user = userEvent.setup();
    const onAddCreditLimit = vi.fn();

    render(
      <AccountsAndDebts
        accounts={[{ id: 'debit', name: 'BCP', kind: 'debit', balanceCents: 100000 }]}
        debts={{
          cards: [
            { accountId: 'c1', name: 'BBVA', owed: 80000, previousDebt: 0, creditLimit: 500000, paymentDay: 15 },
            { accountId: 'c2', name: 'Visa Antigua', owed: 80000, previousDebt: 80000, creditLimit: undefined },
          ],
          loans: [
            {
              id: 'l1',
              name: 'Interbank',
              remainingBalanceCents: 250000,
              nextInstallment: { number: 3, total: 12, amountCents: 25000, remaining: 10 },
              paymentDay: 20,
            },
          ],
          informalDebts: [],
        }}
        onAddCreditLimit={onAddCreditLimit}
      />,
    );

    expect(screen.getByText('Usaste S/ 800.00 de S/ 5,000.00 · Pagas el 15')).toBeInTheDocument();
    expect(screen.getByText('Debes S/ 800.00')).toBeInTheDocument();
    expect(screen.getByText('Próxima cuota S/ 250.00 · día 20')).toBeInTheDocument();
    expect(screen.getByText('S/ 2,500.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Agregar línea de crédito' }));
    expect(onAddCreditLimit).toHaveBeenCalledWith('c2');
  });

  it('masks every monetary amount when hidden is true', () => {
    render(
      <AccountsAndDebts
        accounts={[{ id: 'debit', name: 'BCP', kind: 'debit', balanceCents: 120000 }]}
        debts={{
          cards: [{ accountId: 'c1', name: 'BBVA', owed: 80000, previousDebt: 0, creditLimit: 500000, paymentDay: 15 }],
          loans: [
            {
              id: 'l1',
              name: 'Interbank',
              remainingBalanceCents: 250000,
              nextInstallment: { number: 3, total: 12, amountCents: 25000, remaining: 10 },
            },
          ],
          informalDebts: [],
        }}
        hidden
      />,
    );

    expect(screen.queryByText(/1,200\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/800\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/250\.00/)).not.toBeInTheDocument();
    expect(screen.getByText('Usaste •••• de •••• · Pagas el 15')).toBeInTheDocument();
    expect(screen.getByText('Próxima cuota ••••')).toBeInTheDocument();
  });
});
