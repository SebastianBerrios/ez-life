import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GoalForm from './GoalForm';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import type { Goal } from '../../core/domain/models/types';

vi.mock('../../infrastructure/repositories/local/LocalGoalRepository');

describe('GoalForm', () => {
  it('creates a numeric goal with a target value', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g1' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr 100km');
    await user.type(screen.getByLabelText(/valor objetivo/i), '100');

    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 0, status: 'active',
      }));
    });
  });

  it('creates a checklist goal with milestones', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g2' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Aprender React');
    await user.click(screen.getByLabelText(/checklist/i));
    await user.type(screen.getByLabelText(/nuevo hito/i), 'Fundamentos');
    await user.click(screen.getByRole('button', { name: /agregar hito/i }));

    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'checklist',
        milestones: [expect.objectContaining({ label: 'Fundamentos', done: false })],
      }));
    });
  });

  it('prefills fields from `existing` and calls save() with its id, preserving progress (FR-006)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g1' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    const existing: Goal = {
      id: 'g1', user_id: 'user-1', name: 'Correr 100km', kind: 'numeric',
      target_value: 100, current_value: 40, status: 'active',
      created_at: new Date(), updated_at: new Date(),
    };

    render(<GoalForm userId="user-1" existing={existing} onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/editar meta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Correr 100km');
    expect(screen.getByLabelText(/valor objetivo/i)).toHaveValue('100');
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/nombre/i));
    await user.type(screen.getByLabelText(/nombre/i), 'Correr 100km (editada)');

    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        id: 'g1', name: 'Correr 100km (editada)', current_value: 40, status: 'active',
      }));
    });
  });

  it('saves the optional description when the user fills it in (FR-008)', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g3' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr 100km');
    await user.type(screen.getByLabelText(/valor objetivo/i), '100');
    await user.type(screen.getByLabelText(/descripción/i), 'Prepararme para la maratón');

    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ description: 'Prepararme para la maratón' }));
    });
  });

  it('omits description when left empty', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g4' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });

    render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Correr 100km');
    await user.type(screen.getByLabelText(/valor objetivo/i), '100');

    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
    expect(mockSave.mock.calls[0][0].description).toBeUndefined();
  });
  it('adds a milestone with Enter without submitting the form, and removes it with its labelled button', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue({ id: 'g' });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: mockSave } as unknown as InstanceType<typeof LocalGoalRepository>;
    });
    render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Aprender React');
    await user.click(screen.getByLabelText(/checklist/i));
    await user.type(screen.getByLabelText(/nuevo hito/i), 'Fundamentos{Enter}');

    expect(screen.getByText('Fundamentos')).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/nuevo hito/i)).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Quitar hito Fundamentos' }));
    expect(screen.queryByText('Fundamentos')).not.toBeInTheDocument();
  });

  it('kind is a radio group of chips; its own title shows standalone and not when embedded', () => {
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return { save: vi.fn() } as unknown as InstanceType<typeof LocalGoalRepository>;
    });
    const { unmount } = render(<GoalForm userId="user-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: /tipo/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Numérica')).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Nueva Meta' })).toBeInTheDocument();
    unmount();
    render(<GoalForm userId="user-1" embedded onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Nueva Meta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear meta' })).toBeInTheDocument();
  });
});
