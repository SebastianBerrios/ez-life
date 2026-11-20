import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BalanceHero from './BalanceHero';
import type { MonthBalance } from '../../../core/domain/models/types';

const baseBalance = (overrides: Partial<MonthBalance> = {}): MonthBalance => ({
  opening: 100000,
  entro: 50000,
  salio: 30000,
  ahorraste: 0,
  sacaste: 0,
  ajuste: 0,
  balance: 120000,
  savingsNet: 0,
  cards: [],
  ...overrides,
});

describe('BalanceHero', () => {
  it('renders a positive balance, Entró · Salió, data-tour="balance" and no extra lines when absent', () => {
    render(<BalanceHero balance={baseBalance()} hidden={false} onToggleHidden={vi.fn()} />);

    const hero = screen.getByTestId('balance-hero');
    expect(hero).toHaveAttribute('data-tour', 'balance');
    expect(screen.getByText('Balance del mes')).toBeInTheDocument();
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('S/ 1,200.00');
    expect(screen.getByTestId('balance-flows')).toHaveTextContent('Entró S/ 500.00 · Salió S/ 300.00');
    expect(screen.queryByTestId('balance-extras')).toBeNull();
    expect(screen.queryByTestId('balance-negative-note')).toBeNull();
    expect(screen.queryByText(/capital disponible/i)).toBeNull();
  });

  it('shows negative balance with sign and neutral informative copy (no error tone)', () => {
    render(
      <BalanceHero
        balance={baseBalance({ opening: 20000, entro: 0, salio: 50000, balance: -30000 })}
        hidden={false}
        onToggleHidden={vi.fn()}
      />,
    );

    expect(screen.getByTestId('balance-amount')).toHaveTextContent('-S/ 300.00');
    const note = screen.getByTestId('balance-negative-note');
    expect(note).toHaveTextContent('Gastaste más de lo que tenías este mes');
    expect(note.className).not.toMatch(/destructive|red|danger|expense/);
  });

  it('shows separate lines for ahorraste, sacaste and ajuste only when non-zero', () => {
    render(
      <BalanceHero
        balance={baseBalance({ ahorraste: 20000, sacaste: 30000, ajuste: 4000, balance: 134000, savingsNet: -10000 })}
        hidden={false}
        onToggleHidden={vi.fn()}
      />,
    );

    const extras = screen.getByTestId('balance-extras');
    expect(extras).toHaveTextContent('Ahorraste S/ 200.00');
    expect(extras).toHaveTextContent('Sacaste S/ 300.00 de tus ahorros');
    expect(extras).toHaveTextContent('Ajuste de saldo S/ 40.00');
  });

  it('masks amounts when hidden and invokes onToggleHidden', async () => {
    const user = userEvent.setup();
    const onToggleHidden = vi.fn();
    render(
      <BalanceHero
        balance={baseBalance({ ahorraste: 20000 })}
        hidden
        onToggleHidden={onToggleHidden}
      />,
    );

    expect(screen.getByTestId('balance-amount')).toHaveTextContent('••••');
    expect(screen.getByTestId('balance-flows')).toHaveTextContent('Entró •••• · Salió ••••');
    expect(screen.getByTestId('balance-extras')).toHaveTextContent('Ahorraste ••••');

    await user.click(screen.getByRole('button', { name: 'Mostrar montos' }));
    expect(onToggleHidden).toHaveBeenCalledTimes(1);
  });

  it('renders zero flows for a month with no movements', () => {
    render(
      <BalanceHero
        balance={baseBalance({ opening: 75000, entro: 0, salio: 0, balance: 75000 })}
        hidden={false}
        onToggleHidden={vi.fn()}
      />,
    );

    expect(screen.getByTestId('balance-amount')).toHaveTextContent('S/ 750.00');
    expect(screen.getByTestId('balance-flows')).toHaveTextContent('Entró S/ 0.00 · Salió S/ 0.00');
  });
});
