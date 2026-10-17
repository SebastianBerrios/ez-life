import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SharedSpaceBalances from './SharedSpaceBalances';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';

vi.mock('../../infrastructure/repositories/local/LocalSharedMovementRepository');
vi.mock('../hooks/useSharedSpaceRealtime', () => ({ useSharedSpaceRealtime: vi.fn() }));

const stamp = { created_at: new Date(), updated_at: new Date() };

function movement(id: string, createdBy: string, total: number, splits: Array<[string, number]>) {
  return {
    ...stamp, id, shared_space_id: 'space-1', created_by: createdBy, type: 'expense', total_amount: total, split_mode: 'fixed_amount',
    date: new Date(), splits: splits.map(([user_id, share_cents]) => ({ user_id, share_cents })),
  };
}

function useMovements(rows: unknown[]) {
  vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
    return { getAllForSpace: vi.fn().mockResolvedValue(rows) } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
  });
}

beforeEach(() => vi.clearAllMocks());

describe('SharedSpaceBalances', () => {
  it('says there is nothing pending when nobody owes anything', async () => {
    useMovements([]);
    render(<SharedSpaceBalances spaceId="space-1" currentUserId="ana" refreshKey={0} />);
    expect(await screen.findByText('No hay saldos pendientes en este espacio.')).toBeInTheDocument();
  });

  it('shows who owes whom with the amount formatted from cents, colored from the signed-in user point of view', async () => {
    // Ana paid S/ 100.00 split 50/50: Bob owes Ana S/ 50.00.
    useMovements([movement('m1', 'ana', 10000, [['ana', 5000], ['bob', 5000]])]);
    const { rerender } = render(<SharedSpaceBalances spaceId="space-1" currentUserId="ana" refreshKey={0} />);

    const list = await screen.findByRole('list');
    const row = within(list).getByRole('listitem');
    expect(row).toHaveTextContent('bob le debe a vos');
    expect(row).toHaveTextContent(/S\/\s?50\.00/);
    expect(row.querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'income');

    // Same data seen by Bob: he owes.
    rerender(<SharedSpaceBalances spaceId="space-1" currentUserId="bob" refreshKey={1} />);
    expect(await screen.findByText('Vos le debe a ana')).toBeInTheDocument();
    expect(screen.getByRole('listitem').querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'expense');
  });

  it('never shows a sign on the debt amount', async () => {
    useMovements([movement('m1', 'ana', 10000, [['ana', 5000], ['bob', 5000]])]);
    render(<SharedSpaceBalances spaceId="space-1" currentUserId="carla" refreshKey={0} />);
    const row = await screen.findByRole('listitem');
    expect(row).toHaveTextContent('bob le debe a ana');
    expect(row.querySelector('[data-slot="money-sign"]')).toBeNull();
    expect(row.querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'neutral');
  });
});
