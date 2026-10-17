import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TaskForm from './TaskForm';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import type { Task } from '../../core/domain/models/types';

vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');

describe('TaskForm', () => {
  it('creates a task with a due date', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't1' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/título/i), 'Pagar el alquiler');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', title: 'Pagar el alquiler', status: 'pending',
        due_date: new Date(2026, 11, 31, 12), // local noon, never UTC midnight
      }));
    });
  });

  it('prefills fields from `existing` and calls save() with its id, preserving status (FR-006)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't1' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    const existing: Task = {
      id: 't1', user_id: 'user-1', title: 'Pagar el alquiler', due_date: new Date(2026, 11, 31, 12),
      status: 'done', done_at: new Date('2026-12-30'),
      created_at: new Date(), updated_at: new Date(),
    };

    render(<TaskForm userId="user-1" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/editar tarea/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveValue('Pagar el alquiler');
    expect(screen.getByLabelText(/fecha límite/i)).toHaveValue('2026-12-31');
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/título/i));
    await user.type(screen.getByLabelText(/título/i), 'Pagar el alquiler (retitulada)');

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        id: 't1', title: 'Pagar el alquiler (retitulada)', status: 'done', done_at: existing.done_at,
      }));
    });
  });

  it('creates a recurring task with fixed days, setting schedule_mode and recurrence_series_id (FR-001)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't1' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/título/i), 'Sacar la basura');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });
    await user.click(screen.getByLabelText(/repetir tarea/i));
    await user.click(screen.getByLabelText(/^sábado$/i));

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Sacar la basura',
        schedule_mode: 'fixed_days',
        fixed_days: ['sat'],
        recurrence_active: true,
        recurrence_series_id: expect.any(String),
      }));
    });
    const savedSeriesId: string = mockSave.mock.calls[0][0].recurrence_series_id;
    expect(savedSeriesId.length).toBeGreaterThan(0);
  });

  it('creates a recurring task with a weekly frequency target, setting schedule_mode and recurrence_series_id (FR-001)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't2' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/título/i), 'Ir al gimnasio');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });
    await user.click(screen.getByLabelText(/repetir tarea/i));
    await user.click(screen.getByLabelText(/frecuencia libre/i));
    await user.type(screen.getByLabelText(/veces por semana/i), '3');

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Ir al gimnasio',
        schedule_mode: 'frequency',
        frequency_target: 3,
        recurrence_active: true,
        recurrence_series_id: expect.any(String),
      }));
    });
  });

  it('does not set any recurrence field for a non-recurring task', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't3' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/título/i), 'Pagar el alquiler');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pagar el alquiler' }));
    });
    const saved = mockSave.mock.calls[0][0];
    expect(saved.schedule_mode).toBeUndefined();
    expect(saved.recurrence_series_id).toBeUndefined();
  });

  it('saves the optional description when the user fills it in (FR-007)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't4' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/título/i), 'Pagar el alquiler');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });
    await user.type(screen.getByLabelText(/descripción/i), 'Transferir antes del día 5');

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ description: 'Transferir antes del día 5' }));
    });
  });

  it('omits description when left empty', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't5' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/título/i), 'Pagar el alquiler');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });

    fireEvent.submit(screen.getByTestId('task-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
    expect(mockSave.mock.calls[0][0].description).toBeUndefined();
  });

  it('saves priority and tag, defaulting to medium without tag (011)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 't6' });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    const { unmount } = render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/título/i), 'Default');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });
    fireEvent.submit(screen.getByTestId('task-form'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0]).toMatchObject({ priority: 'medium', tag: undefined });
    unmount();

    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/título/i), 'Entrega');
    fireEvent.change(screen.getByLabelText(/fecha límite/i), { target: { value: '2026-12-31' } });
    await user.click(screen.getByRole('tab', { name: 'Alta' }));
    await user.type(screen.getByLabelText(/etiqueta/i), '  Maestría / Estudio ');
    fireEvent.submit(screen.getByTestId('task-form'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(mockSave.mock.calls[1][0]).toMatchObject({ priority: 'high', tag: 'Maestría / Estudio' });
  });

  it('prefills priority and tag when editing', () => {
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
    });
    const existing: Task = {
      id: 't1', user_id: 'user-1', title: 'Tesis', due_date: new Date(2026, 11, 31, 12), status: 'pending',
      priority: 'low', tag: 'Maestría', created_at: new Date(), updated_at: new Date(),
    };
    render(<TaskForm userId="user-1" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Baja' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Media' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText(/etiqueta/i)).toHaveValue('Maestría');
  });

  it('shows the calendar day the user picked even for an evening local time (UTC-5 regression)', () => {
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
    });
    // Local 19:00 is 00:00 UTC of the next day in UTC-5: the old
    // toISOString().slice(0, 10) read would show the 17th instead of the 16th.
    const existing: Task = {
      id: 't1', user_id: 'user-1', title: 'Noche', due_date: new Date(2026, 9, 16, 19, 0), status: 'pending',
      created_at: new Date(), updated_at: new Date(),
    };
    render(<TaskForm userId="user-1" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/fecha límite/i)).toHaveValue('2026-10-16');
  });
  it('priority is a Segmented control that defaults to Media and exposes the three options', () => {
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
    });
    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    const tabs = screen.getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).toEqual(['Alta', 'Media', 'Baja']);
    expect(screen.getByRole('tab', { name: 'Media' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps its own title standalone and hides it when embedded in a sheet', () => {
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
    });
    const { unmount } = render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Nueva Tarea' })).toBeInTheDocument();
    unmount();
    render(<TaskForm userId="user-1" embedded onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Nueva Tarea' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeInTheDocument();
  });

  it('the repeat switch reveals the recurrence options and exposes aria-checked', async () => {
    const user = userEvent.setup();
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
    });
    render(<TaskForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    const repeat = screen.getByRole('switch', { name: /repetir tarea/i });
    expect(repeat).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByLabelText(/^lunes$/i)).not.toBeInTheDocument();
    await user.click(repeat);
    expect(repeat).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/^lunes$/i)).not.toBeChecked();
  });
});

