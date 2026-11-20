import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SharedSpaceBalances from './SharedSpaceBalances';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';

vi.mock('../../infrastructure/repositories/local/LocalSharedMovementRepository');
vi.mock('../hooks/useSharedSpaceRealtime', () => ({ useSharedSpaceRealtime: vi.fn() }));

const stamp = { created_at: new Date(), updated_at: new Date() };

function movement(id: string, createdBy: string, totalCents: number, splits: Array<[string, number]>) {
  return {
    ...stamp,
    id,
    shared_space_id: 'space-1',
    created_by: createdBy,
    type: 'expense' as const,
    total_amount_cents: totalCents,
    split_mode: 'percentage' as const,
    linked_movement_ids: [],
    date: new Date(2026, 9, 15),
    splits: splits.map(([user_id, share_cents]) => ({ user_id, share_cents })),
  };
}

function useMovements(rows: unknown[]) {
  vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
    return { getAllForSpace: vi.fn().mockResolvedValue(rows) } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
  });
}

beforeEach(() => vi.clearAllMocks());

describe('SharedSpaceBalances', () => {
  it('shows "Están al día" when nobody owes anything', async () => {
    useMovements([]);
    render(<SharedSpaceBalances spaceId="space-1" currentUserId="ana" refreshKey={0} />);
    expect(await screen.findByText('Están al día')).toBeInTheDocument();
  });

  it('shows natural balance phrases, net hero, and readable shared movements list', async () => {
    useMovements([movement('m1', 'ana', 10000, [['ana', 5000], ['bob', 5000]])]);
    const memberNames = { ana: 'Ana', bob: 'Bob' };
    const { rerender } = render(
      <SharedSpaceBalances spaceId="space-1" currentUserId="ana" refreshKey={0} memberNames={memberNames} />,
    );

    const hero = await screen.findByTestId('shared-balances-hero');
    expect(within(hero).getByText('Te deben S/ 50.00')).toBeInTheDocument();

    const balancesPanel = screen.getByTestId('shared-balances');
    const row = within(balancesPanel).getByRole('listitem');
    expect(row).toHaveTextContent('Bob te debe S/ 50.00');
    expect(row.querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'income');

    const movementsPanel = screen.getByTestId('shared-movements-list');
    expect(within(movementsPanel).getByText('Pagaste tú · dividido en partes iguales')).toBeInTheDocument();

    // Same data seen by Bob: he owes Ana.
    rerender(
      <SharedSpaceBalances spaceId="space-1" currentUserId="bob" refreshKey={1} memberNames={memberNames} />,
    );
    expect(await screen.findByText('Debes S/ 50.00')).toBeInTheDocument();
    expect(screen.getByText('Le debes S/ 50.00 a Ana')).toBeInTheDocument();
  });

  it('falls back to "Otro miembro" when names are not provided', async () => {
    useMovements([movement('m1', 'ana', 10000, [['ana', 5000], ['bob', 5000]])]);
    render(<SharedSpaceBalances spaceId="space-1" currentUserId="carla" refreshKey={0} />);
    const balancesPanel = await screen.findByTestId('shared-balances');
    const row = within(balancesPanel).getByRole('listitem');
    expect(row).toHaveTextContent('Otro miembro le debe S/ 50.00 a Otro miembro');
    expect(row.querySelector('[data-slot="money-sign"]')).toBeNull();
    expect(row.querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'neutral');
  });
});
