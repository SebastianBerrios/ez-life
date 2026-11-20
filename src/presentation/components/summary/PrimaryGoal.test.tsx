import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PrimaryGoal from './PrimaryGoal';

const NOW = new Date(2026, 10, 10);

describe('PrimaryGoal', () => {
  it('renders a friendly empty state and invokes onCreate when no active goal exists', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<PrimaryGoal goal={null} onCreate={onCreate} />);

    expect(screen.getByTestId('primary-goal-empty')).toBeInTheDocument();
    expect(screen.getByText(/Aún no tienes una meta de ahorro activa/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Crear meta' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders progress, amounts, deadline and invokes onContribute', async () => {
    const user = userEvent.setup();
    const onContribute = vi.fn();

    render(
      <PrimaryGoal
        goal={{
          goal: {
            id: 'g1',
            user_id: 'u1',
            name: 'Viaje a Cusco',
            target_amount: 200000,
            deadline: new Date(2026, 11, 20),
            created_at: NOW,
            updated_at: NOW,
          },
          currentAmountCents: 50000,
          percentage: 25,
          remainingCents: 150000,
        }}
        onContribute={onContribute}
      />,
    );

    expect(screen.getByTestId('primary-goal')).toBeInTheDocument();
    expect(screen.getByText('Viaje a Cusco')).toBeInTheDocument();
    expect(screen.getByText('S/ 500.00 de S/ 2,000.00')).toBeInTheDocument();
    expect(screen.getByText('Faltan S/ 1,500.00')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aportar' }));
    expect(onContribute).toHaveBeenCalledTimes(1);
  });

  it('masks amounts when hidden is true', () => {
    render(
      <PrimaryGoal
        goal={{
          goal: {
            id: 'g1',
            user_id: 'u1',
            name: 'Fondo',
            target_amount: 100000,
            created_at: NOW,
            updated_at: NOW,
          },
          currentAmountCents: 40000,
          percentage: 40,
          remainingCents: 60000,
        }}
        hidden
      />,
    );

    expect(screen.getByText('•••• de ••••')).toBeInTheDocument();
    expect(screen.getByText('Faltan ••••')).toBeInTheDocument();
  });
});
