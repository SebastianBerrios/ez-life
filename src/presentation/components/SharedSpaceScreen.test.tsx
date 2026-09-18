import { render, screen } from '@testing-library/react';
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

    expect(await screen.findByText(/todavía no tenés un espacio compartido/i)).toBeInTheDocument();
  });
});
