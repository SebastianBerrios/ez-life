import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingStep2 from './OnboardingStep2';

const saveAccounts = vi.fn();

vi.mock('../../infrastructure/repositories/local/LocalOnboardingRepository', () => ({
  LocalOnboardingRepository: vi.fn(function () {
    return { saveAccounts };
  }),
}));

describe('OnboardingStep2 (¿Dónde tienes tu dinero?)', () => {
  beforeEach(() => {
    saveAccounts.mockReset().mockResolvedValue(undefined);
  });

  it('shows "Solo uso efectivo" only when no bank rows exist, and sends cash + declareNoBanks=true', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingStep2 profileId="u1" onComplete={onComplete} />);

    expect(screen.getByRole('heading', { name: '¿Dónde tienes tu dinero?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Solo uso efectivo' })).toBeInTheDocument();

    const cashInput = screen.getByLabelText('Efectivo');
    await user.clear(cashInput);
    await user.type(cashInput, '100');

    await user.click(screen.getByRole('button', { name: 'Solo uso efectivo' }));

    await waitFor(() => expect(saveAccounts).toHaveBeenCalledWith('u1', {
      cash: 10000,
      banks: [],
      declareNoBanks: true,
    }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('continuing with no banks without pressing "Solo uso efectivo" does not pass declareNoBanks', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep2 profileId="u1" onComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(saveAccounts).toHaveBeenCalledWith('u1', {
      cash: 0,
      banks: [],
    }));
  });

  it('hides "Solo uso efectivo" when adding a bank account and submits banks with stable draft IDs', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep2 profileId="u1" onComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /\+ agregar cuenta/i }));
    expect(screen.queryByRole('button', { name: 'Solo uso efectivo' })).toBeNull();

    await user.type(screen.getByLabelText('Nombre'), 'BCP');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'debit');
    const balInput = screen.getByLabelText('Saldo actual');
    await user.clear(balInput);
    await user.type(balInput, '1500');

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(saveAccounts).toHaveBeenCalledWith('u1', {
      cash: 0,
      banks: [expect.objectContaining({ id: expect.any(String), name: 'BCP', kind: 'debit', balance: 150000 })],
    }));
  });

  it('shows "El saldo no puede ser negativo." as role="alert" for negative cash or bank balance', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep2 profileId="u1" onComplete={vi.fn()} />);

    const cashInput = screen.getByLabelText('Efectivo');
    await user.clear(cashInput);
    await user.type(cashInput, '-50');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El saldo no puede ser negativo.');
    expect(saveAccounts).not.toHaveBeenCalled();
  });
});
