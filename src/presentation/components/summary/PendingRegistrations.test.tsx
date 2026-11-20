import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { PendingRegistration } from '../../../core/domain/models/types';
import PendingRegistrations from './PendingRegistrations';

function makeItem(overrides: Partial<PendingRegistration> & { key: string; title: string; day: number }): PendingRegistration {
  return {
    kind: 'recurrence',
    refId: overrides.key,
    amount: 8000,
    overdue: false,
    ...overrides,
  };
}

describe('PendingRegistrations', () => {
  it('shows the empty message when there are no pending items', () => {
    render(<PendingRegistrations items={[]} onRegister={vi.fn()} onSkip={vi.fn()} />);

    const section = screen.getByTestId('pending-registrations');
    expect(within(section).getByText('Por registrar')).toBeInTheDocument();
    expect(within(section).getByText('No tienes nada pendiente este mes.')).toBeInTheDocument();
  });

  it('orders overdue items first then by day, highlights overdue neutrally, and invokes Registrar / Omitir callbacks', async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn();
    const onSkip = vi.fn();

    const later = makeItem({ key: 'recurrence:r2:2026-11', title: 'Internet', amount: 12000, day: 12, overdue: false });
    const overdue = makeItem({ key: 'recurrence:r1:2026-11', title: 'Gimnasio', amount: 8000, day: 5, overdue: true });
    const todayItem = makeItem({ key: 'income:i1:2026-11', kind: 'income', title: 'Sueldo', amount: 300000, day: 10, overdue: false });

    render(
      <PendingRegistrations
        items={[later, todayItem, overdue]}
        onRegister={onRegister}
        onSkip={onSkip}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('data-overdue', 'true');
    expect(rows[0]).toHaveTextContent('Gimnasio · S/ 80.00 · día 5');
    expect(rows[1]).toHaveAttribute('data-overdue', 'false');
    expect(rows[1]).toHaveTextContent('Sueldo · S/ 3,000.00 · día 10');
    expect(rows[2]).toHaveTextContent('Internet · S/ 120.00 · día 12');

    // No expand button when there are exactly 3 items
    expect(screen.queryByRole('button', { name: /Ver todos/i })).not.toBeInTheDocument();

    await user.click(within(rows[0]).getByRole('button', { name: 'Registrar' }));
    expect(onRegister).toHaveBeenCalledWith(overdue);

    await user.click(within(rows[1]).getByRole('button', { name: 'Omitir este mes' }));
    expect(onSkip).toHaveBeenCalledWith(todayItem);
  });

  it('shows first 3 items and expands in place when clicking "Ver todos (4)"', async () => {
    const user = userEvent.setup();
    const items = [
      makeItem({ key: 'recurrence:1:2026-11', title: 'Gimnasio', day: 5, overdue: true }),
      makeItem({ key: 'recurrence:2:2026-11', title: 'Internet', day: 10, overdue: false }),
      makeItem({ key: 'recurrence:3:2026-11', title: 'Agua', day: 12, overdue: false }),
      makeItem({ key: 'recurrence:4:2026-11', title: 'Luz', day: 15, overdue: false }),
    ];

    render(<PendingRegistrations items={items} onRegister={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    const expandBtn = screen.getByRole('button', { name: 'Ver todos (4)' });
    await user.click(expandBtn);

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Luz · S/ 80.00 · día 15')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver todos (4)' })).not.toBeInTheDocument();
  });

  it('masks amounts when hidden is true', () => {
    const item = makeItem({ key: 'recurrence:1:2026-11', title: 'Gimnasio', amount: 8000, day: 5 });
    render(<PendingRegistrations items={[item]} hidden onRegister={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByText('Gimnasio · •••• · día 5')).toBeInTheDocument();
    expect(screen.queryByText(/80\.00/)).not.toBeInTheDocument();
  });
});
