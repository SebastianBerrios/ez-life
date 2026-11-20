import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingStep3 from './OnboardingStep3';

const mocks = vi.hoisted(() => ({
  saveCards: vi.fn(),
  declareNotApplicable: vi.fn(),
  skipStep: vi.fn(),
}));

vi.mock('../../infrastructure/repositories/local/LocalOnboardingRepository', () => ({
  LocalOnboardingRepository: vi.fn(function () {
    return mocks;
  }),
}));

describe('OnboardingStep3 (¿Tienes tarjetas de crédito?)', () => {
  beforeEach(() => {
    mocks.saveCards.mockReset().mockResolvedValue(undefined);
    mocks.declareNotApplicable.mockReset().mockResolvedValue(undefined);
    mocks.skipStep.mockReset().mockResolvedValue(undefined);
  });

  it('shows live summary and saves valid card data', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingStep3 profileId="u1" onComplete={onComplete} />);

    expect(screen.getByRole('heading', { name: '¿Tienes tarjetas de crédito?' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombre'), 'BBVA');
    await user.type(screen.getByLabelText('Línea de crédito'), '5000');
    const consumed = screen.getByLabelText('Consumido hasta hoy');
    await user.clear(consumed);
    await user.type(consumed, '800');
    await user.type(screen.getByLabelText(/día de cierre/i), '10');
    await user.type(screen.getByLabelText(/día de pago/i), '15');

    expect(screen.getByTestId('card-summary-0')).toHaveTextContent('Usaste S/ 800.00 de S/ 5,000.00 · Pagas el 15');

    await user.click(screen.getByRole('button', { name: 'Guardar tarjetas y continuar' }));

    await waitFor(() => expect(mocks.saveCards).toHaveBeenCalledWith('u1', [
      expect.objectContaining({
        id: expect.any(String),
        name: 'BBVA',
        creditLimitCents: 500000,
        consumedCents: 80000,
        closingDay: 10,
        paymentDay: 15,
      }),
    ]));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('validates required credit limit and consumed <= credit limit with role="alert"', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep3 profileId="u1" onComplete={vi.fn()} />);

    await user.type(screen.getByLabelText('Nombre'), 'BBVA');
    await user.click(screen.getByRole('button', { name: 'Guardar tarjetas y continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La línea de crédito es obligatoria.');

    await user.type(screen.getByLabelText('Línea de crédito'), '1000');
    const consumed = screen.getByLabelText('Consumido hasta hoy');
    await user.clear(consumed);
    await user.type(consumed, '1500');
    await user.click(screen.getByRole('button', { name: 'Guardar tarjetas y continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El consumo no puede superar la línea de crédito.');
    expect(mocks.saveCards).not.toHaveBeenCalled();
  });

  it('routes "No tengo tarjetas" to declareNotApplicable and "Omitir por ahora" to skipStep', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingStep3 profileId="u1" onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: 'No tengo tarjetas' }));
    await waitFor(() => expect(mocks.declareNotApplicable).toHaveBeenCalledWith('u1', 'cards'));

    await user.click(screen.getByRole('button', { name: 'Omitir por ahora' }));
    await waitFor(() => expect(mocks.skipStep).toHaveBeenCalledWith('u1', 3));
    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});
