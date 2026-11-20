import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingStep4 from './OnboardingStep4';

const mocks = vi.hoisted(() => ({
  saveLoans: vi.fn(),
  declareNotApplicable: vi.fn(),
  skipStep: vi.fn(),
}));

vi.mock('../../infrastructure/repositories/local/LocalOnboardingRepository', () => ({
  LocalOnboardingRepository: vi.fn(function () {
    return mocks;
  }),
}));

describe('OnboardingStep4 (¿Tienes préstamos?)', () => {
  beforeEach(() => {
    mocks.saveLoans.mockReset().mockResolvedValue(undefined);
    mocks.declareNotApplicable.mockReset().mockResolvedValue(undefined);
    mocks.skipStep.mockReset().mockResolvedValue(undefined);
  });

  it('saves an installment loan with alreadyPaid and paymentDay', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingStep4 profileId="u1" onComplete={onComplete} />);

    expect(screen.getByRole('heading', { name: '¿Tienes préstamos?' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Entidad o persona'), 'BCP');
    await user.type(screen.getByLabelText('Monto'), '12000');
    await user.type(screen.getByLabelText('Cuota'), '1000');
    await user.type(screen.getByLabelText('Cuotas totales'), '12');
    const paid = screen.getByLabelText('Cuotas ya pagadas');
    await user.clear(paid);
    await user.type(paid, '6');
    await user.type(screen.getByLabelText('Día de pago'), '5');

    await user.click(screen.getByRole('button', { name: 'Guardar préstamos y continuar' }));

    await waitFor(() => expect(mocks.saveLoans).toHaveBeenCalledWith('u1', [
      expect.objectContaining({
        id: expect.any(String),
        lenderName: 'BCP',
        hasInstallments: true,
        amountCents: 1200000,
        installmentAmountCents: 100000,
        installmentCount: 12,
        alreadyPaid: 6,
        paymentDay: 5,
      }),
    ]));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('switches to informal debt when "¿Pagas en cuotas?" is unchecked', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep4 profileId="u1" onComplete={vi.fn()} />);

    await user.type(screen.getByLabelText('Entidad o persona'), 'Carlos');
    await user.click(screen.getByRole('switch', { name: /pagas en cuotas/i }));
    await user.type(screen.getByLabelText('Saldo pendiente'), '350');

    await user.click(screen.getByRole('button', { name: 'Guardar préstamos y continuar' }));

    await waitFor(() => expect(mocks.saveLoans).toHaveBeenCalledWith('u1', [
      expect.objectContaining({
        id: expect.any(String),
        lenderName: 'Carlos',
        hasInstallments: false,
        pendingAmountCents: 35000,
      }),
    ]));
  });

  it('rejects alreadyPaid > installmentCount with exact tuteo alert', async () => {
    const user = userEvent.setup();
    render(<OnboardingStep4 profileId="u1" onComplete={vi.fn()} />);

    await user.type(screen.getByLabelText('Entidad o persona'), 'BCP');
    await user.type(screen.getByLabelText('Monto'), '1000');
    await user.type(screen.getByLabelText('Cuota'), '100');
    await user.type(screen.getByLabelText('Cuotas totales'), '10');
    const paid = screen.getByLabelText('Cuotas ya pagadas');
    await user.clear(paid);
    await user.type(paid, '12');

    await user.click(screen.getByRole('button', { name: 'Guardar préstamos y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Las cuotas pagadas no pueden superar las cuotas totales.');
    expect(mocks.saveLoans).not.toHaveBeenCalled();
  });

  it('routes "No tengo préstamos" and "Omitir por ahora"', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingStep4 profileId="u1" onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: 'No tengo préstamos' }));
    await waitFor(() => expect(mocks.declareNotApplicable).toHaveBeenCalledWith('u1', 'loans'));

    await user.click(screen.getByRole('button', { name: 'Omitir por ahora' }));
    await waitFor(() => expect(mocks.skipStep).toHaveBeenCalledWith('u1', 4));
    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});
