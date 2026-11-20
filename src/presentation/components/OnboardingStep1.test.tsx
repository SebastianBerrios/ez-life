import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingStep1 from './OnboardingStep1';

const saveIncome = vi.fn();

vi.mock('../../infrastructure/repositories/local/LocalOnboardingRepository', () => ({
  LocalOnboardingRepository: vi.fn(function () {
    return { saveIncome };
  }),
}));

describe('OnboardingStep1 (Tus ingresos)', () => {
  beforeEach(() => {
    saveIncome.mockReset().mockResolvedValue(undefined);
  });

  it('keeps Continuar disabled until a valid positive income is entered', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep1 profileId="u1" onComplete={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Tus ingresos' })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Continuar' });
    expect(submit).toBeDisabled();

    const incomeInput = screen.getByLabelText('Ingreso mensual');
    await user.type(incomeInput, '0');
    expect(submit).toBeDisabled();

    await user.clear(incomeInput);
    await user.type(incomeInput, '3000');
    expect(submit).toBeEnabled();
  });

  it('submits income, optional payDay and receivedThisMonth to saveIncome', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingStep1 profileId="u1" onComplete={onComplete} />);

    await user.type(screen.getByLabelText('Ingreso mensual'), '3000');
    await user.type(screen.getByLabelText(/qué día te pagan/i), '28');
    await user.click(screen.getByRole('radio', { name: 'Sí' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(saveIncome).toHaveBeenCalledWith('u1', {
      income: 300000,
      payDay: 28,
      receivedThisMonth: true,
    }));
    expect(onComplete).toHaveBeenCalledWith('u1');
  });

  it('shows a field alert for an invalid payDay without calling saveIncome', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep1 profileId="u1" onComplete={vi.fn()} />);

    await user.type(screen.getByLabelText('Ingreso mensual'), '3000');
    await user.type(screen.getByLabelText(/qué día te pagan/i), '35');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresa un día entre 1 y 31.');
    expect(saveIncome).not.toHaveBeenCalled();
  });
});
