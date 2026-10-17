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

    await user.click(screen.getByLabelText(/^tipo$/i));
    await user.click(await screen.findByRole('option', { name: /Ingreso/i }));
    await user.type(screen.getByLabelText(/monto total/i), '100.00');
    fireEvent.submit(screen.getByTestId('shared-movement-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        creatorDistributionCategoryId: undefined,
      }));
    });
  });
  it('pre-fills the total amount from `initial` and still submits it as integer cents', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'sm-1' });
    vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
      return { create: mockCreate } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
    });

    render(
      <SharedMovementForm
        spaceId="space-1"
        currentUserId="ana"
        members={members}
        initial={{ amount: '45.90' }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/monto total/i)).toHaveValue('45.90');
    fireEvent.submit(screen.getByTestId('shared-movement-form'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ totalAmountCents: 4590 }));
    });
  });

  it('starts empty when no `initial` is given', () => {
    render(
      <SharedMovementForm spaceId="space-1" currentUserId="ana" members={members} onComplete={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByLabelText(/monto total/i)).toHaveValue('');
  });
});

describe('SharedMovementForm — money is parsed into integer cents with parseMoney', () => {
  const setup = () => {
    const create = vi.fn().mockResolvedValue({ id: 'sm-1' });
    vi.mocked(LocalSharedMovementRepository).mockImplementation(function () {
      return { create } as unknown as InstanceType<typeof LocalSharedMovementRepository>;
    });
    vi.mocked(LocalCategoryRepository).mockImplementation(function () {
      return { getDistributionCategories: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalCategoryRepository>;
    });
    render(<SharedMovementForm spaceId="space-1" currentUserId="ana" members={members} onComplete={vi.fn()} onCancel={vi.fn()} />);
    return create;
  };
  const submit = () => fireEvent.submit(screen.getByTestId('shared-movement-form'));

  it.each(['100', '100.00', '45.9', '0.01', '1234.56', '19.99', '0.1', '8.2', '1.15', '1000000.5', '0.07'])(
    'gives the same cents as the old parseFloat formula for a valid amount (%s)',
    async (amount) => {
      const user = userEvent.setup();
      const create = setup();
      await user.type(screen.getByLabelText(/monto total/i), amount);
      submit();
      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ totalAmountCents: Math.round(parseFloat(amount) * 100) }));
    },
  );

  it.each(['10.123', '1.2.3', '.5', '5.'])('rejects %s instead of silently rounding it', async (amount) => {
    const user = userEvent.setup();
    const create = setup();
    await user.type(screen.getByLabelText(/monto total/i), amount);
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un monto con hasta dos decimales.');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an empty or zero amount with a message', async () => {
    const user = userEvent.setup();
    const create = setup();
    submit();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/monto total/i), '0');
    submit();
    expect(await screen.findByText('El monto debe ser mayor a 0.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('parses fixed-amount shares as cents and sends them when they add up', async () => {
    const user = userEvent.setup();
    const create = setup();
    await user.type(screen.getByLabelText(/monto total/i), '100.00');
    await user.click(screen.getByLabelText(/monto fijo/i));
    const [first, second] = screen.getAllByLabelText(/parte de/i);
    await user.clear(first);
    await user.type(first, '40.10');
    await user.clear(second);
    await user.type(second, '59.90');
    submit();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      splitMode: 'fixed_amount',
      splits: [{ user_id: 'ana', share_cents: 4010 }, { user_id: 'bob', share_cents: 5990 }],
    }));
  });

  it('rejects a fixed-amount share with more than two decimals', async () => {
    const user = userEvent.setup();
    const create = setup();
    await user.type(screen.getByLabelText(/monto total/i), '100.00');
    await user.click(screen.getByLabelText(/monto fijo/i));
    const [first, second] = screen.getAllByLabelText(/parte de/i);
    await user.clear(first);
    await user.type(first, '40.123');
    await user.clear(second);
    await user.type(second, '59.877');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un monto con hasta dos decimales.');
    expect(create).not.toHaveBeenCalled();
  });

  it('labels the shares in percent or soles depending on the split mode', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getAllByLabelText(/parte de .*\(%\)/i)).toHaveLength(2);
    await user.click(screen.getByLabelText(/monto fijo/i));
    expect(screen.getAllByLabelText(/parte de .*\(S\/\)/i)).toHaveLength(2);
    expect(screen.getByRole('radiogroup', { name: '¿Cómo se divide?' })).toBeInTheDocument();
  });
});
