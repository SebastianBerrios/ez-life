import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GuidedTour from './GuidedTour';
import type { GuidedTourStep } from '../../hooks/useGuidedTour';

function TourHarness({ onFinish = vi.fn(), onSkip = vi.fn() }: { onFinish?: () => void; onSkip?: () => void }) {
  const [active, setActive] = useState(true);
  const [step, setStep] = useState<GuidedTourStep>(1);
  return (
    <>
      <div data-tour="balance">Balance</div>
      <div data-tour="accounts">Accounts</div>
      <button type="button" data-tour="add">+</button>
      <button type="button" data-tour="settings">Ajustes</button>
      <GuidedTour
        active={active}
        step={step}
        onNext={() => setStep(s => (s < 4 ? ((s + 1) as GuidedTourStep) : 4))}
        onSkip={() => { setActive(false); onSkip(); }}
        onFinish={() => { setActive(false); onFinish(); }}
      />
    </>
  );
}

describe('GuidedTour (T075)', () => {
  it('walks all 4 steps with exact copy and calls onFinish on "Listo"', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<TourHarness onFinish={onFinish} />);

    expect(screen.getByRole('heading', { name: 'Tu balance del mes' })).toBeInTheDocument();
    expect(screen.getByText('Aquí ves cuánto dinero tienes este mes.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Tus cuentas y deudas' })).toBeInTheDocument();
    expect(screen.getByText('Revisa dónde está tu dinero y cuánto debes.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Registrar' })).toBeInTheDocument();
    expect(screen.getByText('Toca el botón + para anotar un gasto o un ingreso.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Completa tu configuración' })).toBeInTheDocument();
    expect(screen.getByText('Desde aquí (o en Ajustes) agregas lo que te falta.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('guided-tour')).not.toBeInTheDocument();
  });

  it('closes on "Omitir" or Escape from any step and handles missing anchors safely', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<GuidedTour active step={2} onNext={vi.fn()} onSkip={onSkip} onFinish={vi.fn()} />);

    expect(screen.getByTestId('guided-tour')).toBeInTheDocument();
    expect(screen.queryByTestId('guided-tour-highlight')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onSkip).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Omitir' }));
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('highlights the first visible target when multiple anchors exist (step 4 falls back from setup to settings)', () => {
    const hiddenEl = document.createElement('button');
    hiddenEl.setAttribute('data-tour', 'settings');
    hiddenEl.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) });

    const visibleEl = document.createElement('button');
    visibleEl.setAttribute('data-tour', 'settings');
    visibleEl.getBoundingClientRect = () => ({ top: 100, left: 20, width: 80, height: 44, right: 100, bottom: 144, x: 20, y: 100, toJSON: () => ({}) });

    document.body.appendChild(hiddenEl);
    document.body.appendChild(visibleEl);

    try {
      render(<GuidedTour active step={4} onNext={vi.fn()} onSkip={vi.fn()} onFinish={vi.fn()} />);
      const highlight = screen.getByTestId('guided-tour-highlight');
      expect(highlight).toHaveStyle({ top: '92px', left: '12px', width: '96px', height: '60px' });
    } finally {
      hiddenEl.remove();
      visibleEl.remove();
    }
  });
});
