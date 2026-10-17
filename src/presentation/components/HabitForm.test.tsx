import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import HabitForm from './HabitForm';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import type { Habit } from '../../core/domain/models/types';

vi.mock('../../infrastructure/repositories/local/LocalHabitRepository');

describe('HabitForm', () => {
  it('creates a fixed-days habit with at least one day selected', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'h1' });
    const mockOnComplete = vi.fn();
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalHabitRepository>;
    });

    render(<HabitForm userId="user-1" onComplete={mockOnComplete} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr');
    await user.click(screen.getByLabelText(/lunes/i));
    await user.click(screen.getByLabelText(/miércoles/i));

    fireEvent.submit(screen.getByTestId('habit-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1',
        name: 'Correr',
        schedule_mode: 'fixed_days',
        fixed_days: ['mon', 'wed'],
      }));
    });
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('creates a frequency habit with a target of at least once a week', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'h2' });
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalHabitRepository>;
    });

    render(<HabitForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Gimnasio');
    await user.click(screen.getByLabelText(/frecuencia libre/i));
    await user.type(screen.getByLabelText(/veces por semana/i), '3');

    fireEvent.submit(screen.getByTestId('habit-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        schedule_mode: 'frequency',
        frequency_target: 3,
      }));
    });
  });

  it('rejects saving a fixed-days habit with no day selected (edge case)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn();
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalHabitRepository>;
    });

    render(<HabitForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr');
    fireEvent.submit(screen.getByTestId('habit-form'));

    expect(await screen.findByText(/al menos un día/i)).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('prefills fields from `existing` and calls save() with its id (FR-006)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'h1' });
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalHabitRepository>;
    });

    const existing: Habit = {
      id: 'h1', user_id: 'user-1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon', 'wed'],
      created_at: new Date(), updated_at: new Date(),
    };

    render(<HabitForm userId="user-1" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/editar hábito/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Correr');
    expect(screen.getByLabelText(/^lunes$/i)).toBeChecked();
    expect(screen.getByLabelText(/^miércoles$/i)).toBeChecked();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/nombre/i));
    await user.type(screen.getByLabelText(/nombre/i), 'Correr y estirar');

    fireEvent.submit(screen.getByTestId('habit-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        id: 'h1', name: 'Correr y estirar', schedule_mode: 'fixed_days', fixed_days: ['mon', 'wed'],
      }));
    });
  });

  it('saves the optional icon/emoji when the user fills it in (FR-006)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'h3' });
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalHabitRepository>;
    });

    render(<HabitForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr');
    await user.type(screen.getByLabelText(/ícono/i), '🏃');
    await user.click(screen.getByLabelText(/lunes/i));

    fireEvent.submit(screen.getByTestId('habit-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ icon: '🏃' }));
    });
  });

  it('omits icon when left empty', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'h4' });
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalHabitRepository>;
    });

    render(<HabitForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr');
    await user.click(screen.getByLabelText(/lunes/i));

    fireEvent.submit(screen.getByTestId('habit-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
    expect(mockSave.mock.calls[0][0].icon).toBeUndefined();
  });
  it('offers days fixed / frequency as radio chips and weekday chips as checkboxes with the full day as name', async () => {
    const user = userEvent.setup();
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalHabitRepository>;
    });
    render(<HabitForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: /horario/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Días fijos')).toBeChecked();
    expect(screen.getAllByRole('checkbox').map(box => box.getAttribute('aria-label'))).toEqual(
      ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    );
    await user.click(screen.getByLabelText('Viernes'));
    expect(screen.getByLabelText('Viernes')).toBeChecked();
    await user.click(screen.getByLabelText('Viernes'));
    expect(screen.getByLabelText('Viernes')).not.toBeChecked();

    await user.click(screen.getByLabelText(/frecuencia libre/i));
    expect(screen.queryByLabelText('Lunes')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/veces por semana/i)).toBeInTheDocument();
  });

  it('shows its own title standalone, none when embedded, and a primary full-width submit plus Cancelar', async () => {
    const user = userEvent.setup();
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalHabitRepository>;
    });
    const onCancel = vi.fn();
    const { unmount } = render(<HabitForm userId="user-1" onComplete={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('heading', { name: 'Nuevo Hábito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear hábito' })).toHaveClass('w-full');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    unmount();
    render(<HabitForm userId="user-1" embedded onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Nuevo Hábito' })).not.toBeInTheDocument();
  });
});
