import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SharedSpaceScreen from './SharedSpaceScreen';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalMembershipRepository } from '../../infrastructure/repositories/local/LocalMembershipRepository';

vi.mock('../../infrastructure/repositories/local/LocalSharedSpaceRepository');
vi.mock('../../infrastructure/repositories/local/LocalMembershipRepository');
vi.mock('./SharedSpaceBalances', () => ({
  default: ({ spaceId }: { spaceId: string }) => <div data-testid={`balances-${spaceId}`} />,
}));
vi.mock('./SharedSpaceSettings', () => ({
  default: () => <div data-testid="settings" />,
}));

describe('SharedSpaceScreen', () => {
  it('shows a read-only frozen balance for a space the user left, alongside their active spaces (FR-016)', async () => {
    const now = new Date();
    const activeSpace = {
      id: 'space-active', name: 'Casa actual', permission_mode: 'strict' as const, status: 'active' as const,
      created_by: 'u1', created_at: now, updated_at: now,
    };
    const leftSpace = {
      id: 'space-left', name: 'Ex casa', permission_mode: 'strict' as const, status: 'active' as const,
      created_by: 'u1', created_at: now, updated_at: now,
    };

    vi.mocked(LocalSharedSpaceRepository).mockImplementation(function () {
      return {
        getAllForUser: vi.fn().mockResolvedValue([activeSpace]),
        getLeftForUser: vi.fn().mockResolvedValue([leftSpace]),
      } as unknown as InstanceType<typeof LocalSharedSpaceRepository>;
    });
    vi.mocked(LocalMembershipRepository).mockImplementation(function () {
      return { getMembers: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalMembershipRepository>;
    });

    render(
      <SharedSpaceScreen
        userId="u1"
        onCreate={vi.fn()}
        onJoin={vi.fn()}
        onAddMovement={vi.fn()}
        refreshKey={0}
      />
    );

    expect(await screen.findByText('Casa actual')).toBeInTheDocument();
    expect(await screen.findByText('Ex casa')).toBeInTheDocument();
    expect(screen.getByText(/espacios que abandonaste/i)).toBeInTheDocument();
    expect(screen.getByTestId('balances-space-active')).toBeInTheDocument();
    expect(screen.getByTestId('balances-space-left')).toBeInTheDocument();
    // Read-only: no settings/leave affordance rendered for a space already left.
    expect(screen.getAllByTestId('settings')).toHaveLength(1);
  });

  it('shows the empty-state CTA only when there are no active AND no left spaces', async () => {
    vi.mocked(LocalSharedSpaceRepository).mockImplementation(function () {
      return {
        getAllForUser: vi.fn().mockResolvedValue([]),
        getLeftForUser: vi.fn().mockResolvedValue([]),
      } as unknown as InstanceType<typeof LocalSharedSpaceRepository>;
    });
    vi.mocked(LocalMembershipRepository).mockImplementation(function () {
      return { getMembers: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalMembershipRepository>;
    });

    render(
      <SharedSpaceScreen
        userId="u1"
        onCreate={vi.fn()}
        onJoin={vi.fn()}
        onAddMovement={vi.fn()}
        refreshKey={0}
      />
    );

    expect(await screen.findByText(/todavía no tienes un espacio compartido/i)).toBeInTheDocument();
    expect(screen.getByTestId('shared-space-empty')).toBeInTheDocument();
  });

  it('wires the empty-state buttons and the per-space "+ Movimiento" action', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onJoin = vi.fn();
    const onAddMovement = vi.fn();
    const now = new Date();
    const space = { id: 'space-1', name: 'Casa', permission_mode: 'strict' as const, status: 'active' as const, created_by: 'u1', created_at: now, updated_at: now };
    const members = [{ id: 'm1', shared_space_id: 'space-1', user_id: 'u1', joined_at: now, created_at: now, updated_at: now }];

    vi.mocked(LocalSharedSpaceRepository).mockImplementation(function () {
      return { getAllForUser: vi.fn().mockResolvedValue([]), getLeftForUser: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalSharedSpaceRepository>;
    });
    vi.mocked(LocalMembershipRepository).mockImplementation(function () {
      return { getMembers: vi.fn().mockResolvedValue(members) } as unknown as InstanceType<typeof LocalMembershipRepository>;
    });
    const empty = render(<SharedSpaceScreen userId="u1" onCreate={onCreate} onJoin={onJoin} onAddMovement={onAddMovement} refreshKey={0} />);
    await user.click(await screen.findByRole('button', { name: 'Crear espacio' }));
    await user.click(screen.getByRole('button', { name: 'Unirme con código' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledTimes(1);
    empty.unmount();

    vi.mocked(LocalSharedSpaceRepository).mockImplementation(function () {
      return { getAllForUser: vi.fn().mockResolvedValue([space]), getLeftForUser: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalSharedSpaceRepository>;
    });
    render(<SharedSpaceScreen userId="u1" onCreate={onCreate} onJoin={onJoin} onAddMovement={onAddMovement} refreshKey={0} />);
    await user.click(await screen.findByRole('button', { name: '+ Movimiento' }));
    expect(onAddMovement).toHaveBeenCalledWith('space-1', members);
    await user.click(screen.getByRole('button', { name: 'Unirme a otro espacio' }));
    expect(onJoin).toHaveBeenCalledTimes(2);
  });
});
