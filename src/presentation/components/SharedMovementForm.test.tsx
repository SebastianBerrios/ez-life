import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SharedMovementForm from './SharedMovementForm';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';

vi.mock('../../infrastructure/repositories/local/LocalSharedMovementRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');

const members = [
  { id: 'm1', shared_space_id: 'space-1', user_id: 'ana', joined_at: new Date(), created_at: new Date(), updated_at: new Date() },
  { id: 'm2', shared_space_id: 'space-1', user_id: 'bob', joined_at: new Date(), created_at: new Date(), updated_at: new Date() },
];

describe('SharedMovementForm', () => {
  beforeEach(() => {
    vi.mocked(LocalCategoryRepository).mockImplementation(function () {
      return { getDistributionCategories: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalCategoryRepository>;
    });
  });

  it('submits an even percentage split across all members', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn().mockResolvedValue({ id: 'sm-1' });
    vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
    });

    render(
      <SharedMovementForm
        spaceId="space-1"
        currentUserId="ana"
        members={members}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/monto total/i), '100.00');
    fireEvent.submit(screen.getByTestId('shared-movement-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        sharedSpaceId: 'space-1',
        type: 'expense',
        totalAmountCents: 10000,
        splitMode: 'percentage',
        splits: [
          { user_id: 'ana', share_cents: 5000 },
          { user_id: 'bob', share_cents: 5000 },
        ],
      }));
    });
  });

  it('shows an error and does not submit when a fixed split does not add up to the total', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn();
    vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
    });

    render(
      <SharedMovementForm
        spaceId="space-1"
        currentUserId="ana"
        members={members}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/monto total/i), '100.00');
    await user.click(screen.getByLabelText(/monto fijo/i));

    const fixedInputs = screen.getAllByLabelText(/parte de/i);
    await user.clear(fixedInputs[0]);
    await user.type(fixedInputs[0], '40.00');
    await user.clear(fixedInputs[1]);
    await user.type(fixedInputs[1], '40.00');

    fireEvent.submit(screen.getByTestId('shared-movement-form'));

    expect(await screen.findByText(/no coincide con el total/i)).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('passes the creator-selected bucket as creatorDistributionCategoryId for their own share (FR-012)', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn().mockResolvedValue({ id: 'sm-1' });
    vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
    });
    vi.mocked(LocalCategoryRepository).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'bucket-1', user_id: 'ana', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false, created_at: new Date(), updated_at: new Date() },
        ]),
      } as unknown as InstanceType<typeof LocalCategoryRepository>;
    });

    render(
      <SharedMovementForm
        spaceId="space-1"
        currentUserId="ana"
        members={members}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await screen.findByText('Necesidades');
    await user.type(screen.getByLabelText(/monto total/i), '100.00');
    fireEvent.submit(screen.getByTestId('shared-movement-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        creatorDistributionCategoryId: 'bucket-1',
      }));
    });
  });

  it('does not send a creatorDistributionCategoryId for an income movement', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.fn().mockResolvedValue({ id: 'sm-1' });
    vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
    });
    vi.mocked(LocalCategoryRepository).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'bucket-1', user_id: 'ana', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false, created_at: new Date(), updated_at: new Date() },
        ]),
      } as unknown as InstanceType<typeof LocalCategoryRepository>;
    });

    render(
      <SharedMovementForm
        spaceId="space-1"
        currentUserId="ana"
        members={members}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText(/^tipo$/i), 'income');
    await user.type(screen.getByLabelText(/monto total/i), '100.00');
    fireEvent.submit(screen.getByTestId('shared-movement-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        creatorDistributionCategoryId: undefined,
      }));
    });
  });
});
