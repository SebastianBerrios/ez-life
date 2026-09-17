import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SharedSpaceJoin from './SharedSpaceJoin';
import { LocalSharedInviteRepository } from '../../infrastructure/repositories/local/LocalSharedInviteRepository';

vi.mock('../../infrastructure/repositories/local/LocalSharedInviteRepository');

describe('SharedSpaceJoin', () => {
  it('redeems a valid code and completes', async () => {
    const user = userEvent.setup();
    const mockRedeem = vi.fn().mockResolvedValue({ id: 'membership-1', shared_space_id: 'space-1' });
    const mockOnComplete = vi.fn();
    vi.mocked(LocalSharedInviteRepository).mockImplementation(function () {
      return { redeem: mockRedeem } as unknown as InstanceType<typeof LocalSharedInviteRepository>;
    });

    render(<SharedSpaceJoin onComplete={mockOnComplete} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/código/i), 'ABC12345');
    fireEvent.submit(screen.getByTestId('shared-space-join-form'));

    await waitFor(() => expect(mockRedeem).toHaveBeenCalledWith('ABC12345'));
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('shows a clear error for an expired or already-used code, without granting membership', async () => {
    const user = userEvent.setup();
    const mockRedeem = vi.fn().mockRejectedValue(new Error('La invitación no es válida o ya venció.'));
    const mockOnComplete = vi.fn();
    vi.mocked(LocalSharedInviteRepository).mockImplementation(function () {
      return { redeem: mockRedeem } as unknown as InstanceType<typeof LocalSharedInviteRepository>;
    });

    render(<SharedSpaceJoin onComplete={mockOnComplete} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/código/i), 'DEAD0000');
    fireEvent.submit(screen.getByTestId('shared-space-join-form'));

    expect(await screen.findByText(/no es válida o ya venció/i)).toBeInTheDocument();
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  // A third (or Nth) member joining the same space is not a UI-level concern:
  // there is no member-count cap anywhere in the schema or the
  // redeem_shared_invite RPC (FR-008) — this component behaves identically
  // regardless of how many members the space already has.
});
