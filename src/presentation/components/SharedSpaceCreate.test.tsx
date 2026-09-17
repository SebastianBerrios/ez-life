import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SharedSpaceCreate from './SharedSpaceCreate';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalSharedInviteRepository } from '../../infrastructure/repositories/local/LocalSharedInviteRepository';

vi.mock('../../infrastructure/repositories/local/LocalSharedSpaceRepository');
vi.mock('../../infrastructure/repositories/local/LocalSharedInviteRepository');

describe('SharedSpaceCreate', () => {
  it('creates a space and generates an invite code to display', async () => {
    const user = userEvent.setup();
    const mockCreateSpace = vi.fn().mockResolvedValue({ id: 'space-1', name: 'Casa' });
    const mockCreateInvite = vi.fn().mockResolvedValue({ code: 'ABC12345' });

    vi.mocked(LocalSharedSpaceRepository).mockImplementation(function () {
      return { create: mockCreateSpace } as unknown as InstanceType<typeof LocalSharedSpaceRepository>;
    });
    vi.mocked(LocalSharedInviteRepository).mockImplementation(function () {
      return { create: mockCreateInvite } as unknown as InstanceType<typeof LocalSharedInviteRepository>;
    });

    render(<SharedSpaceCreate onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Casa');
    fireEvent.submit(screen.getByTestId('shared-space-create-form'));

    await waitFor(() => {
      expect(mockCreateSpace).toHaveBeenCalledWith('Casa');
      expect(mockCreateInvite).toHaveBeenCalledWith('space-1');
    });

    expect(await screen.findByText('ABC12345')).toBeInTheDocument();
  });
});
