import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingStep1 from './OnboardingStep1';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';

// Mock the repositories
vi.mock('../../infrastructure/repositories/local/LocalOnboardingRepository');

const mockSaveStartingPoint = vi.fn();
const mockOnComplete = vi.fn();

function renderStep() {
  vi.mocked(LocalOnboardingRepository).mockImplementation(function() { return { saveStartingPoint: mockSaveStartingPoint } as unknown as LocalOnboardingRepository; });
  return render(<OnboardingStep1 profileId="real-session-id" onComplete={mockOnComplete} />);
}

const submit = () => fireEvent.submit(screen.getByRole('button', { name: /continuar/i }).closest('form')!);

describe('OnboardingStep1', () => {
  beforeEach(() => { mockSaveStartingPoint.mockReset(); mockOnComplete.mockReset(); });

  it('shows the starting point copy, both fields and the balance help text', () => {
    renderStep();
    expect(screen.getByRole('heading', { name: 'Tu punto de partida' })).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Sueldo o ingreso mensual')).toBeRequired();
    const balance = screen.getByLabelText('Saldo actual (opcional)');
    expect(balance).not.toBeRequired();
    expect(screen.getByText('Lo que tienes hoy entre efectivo y cuentas. Puedes ajustarlo después en Ajustes → Cuentas.')).toBeInTheDocument();
    expect(balance).toHaveAccessibleDescription(/Lo que tienes hoy/);
  });

  it('should render form and submit successfully with the real session profile id', async () => {
    const user = userEvent.setup();
    renderStep();
    // Regression guard: the real session profileId is used, never a freshly minted uuid.
    await user.type(screen.getByLabelText('Sueldo o ingreso mensual'), '5000.50');
    submit();
    await waitFor(() => {
      expect(mockSaveStartingPoint).toHaveBeenCalledWith('real-session-id', { income: 500050, openingBalance: 0 });
    });
    expect(mockOnComplete).toHaveBeenCalledWith('real-session-id');
  });

  it('sends the current balance in cents next to the income', async () => {
    const user = userEvent.setup();
    renderStep();
    await user.type(screen.getByLabelText('Sueldo o ingreso mensual'), '3000');
    await user.type(screen.getByLabelText('Saldo actual (opcional)'), '800');
    submit();
    await waitFor(() => {
      expect(mockSaveStartingPoint).toHaveBeenCalledWith('real-session-id', { income: 300000, openingBalance: 80000 });
    });
    expect(mockOnComplete).toHaveBeenCalledWith('real-session-id');
  });

  it('blocks a negative balance with a message and does not call the repository', async () => {
    const user = userEvent.setup();
    renderStep();
    await user.type(screen.getByLabelText('Sueldo o ingreso mensual'), '3000');
    await user.type(screen.getByLabelText('Saldo actual (opcional)'), '-5');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('El saldo actual no puede ser negativo.');
    expect(mockSaveStartingPoint).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it('shows a persistent error when saving fails', async () => {
    const user = userEvent.setup();
    mockSaveStartingPoint.mockRejectedValue('boom');
    renderStep();
    await user.type(screen.getByLabelText('Sueldo o ingreso mensual'), '3000');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar tu punto de partida.');
    expect(mockOnComplete).not.toHaveBeenCalled();
  });
});
