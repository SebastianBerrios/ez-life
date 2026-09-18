import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CreatePage from './CreatePage';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';

vi.mock('../../infrastructure/repositories/local/LocalGoalRepository');
vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');
vi.mock('../../infrastructure/repositories/local/LocalHabitRepository');

const existingGoal = {
  id: 'g1', user_id: 'u1', name: 'Correr 100km', kind: 'numeric' as const,
  target_value: 100, current_value: 40, status: 'active' as const,
  created_at: new Date(), updated_at: new Date(),
};

function mockRepos() {
  const mockGoalSave = vi.fn().mockResolvedValue({ id: 'g2' });
  vi.mocked(LocalGoalRepository).mockImplementation(function () {
    return { getAll: vi.fn().mockResolvedValue([existingGoal]), save: mockGoalSave, delete: vi.fn() } as unknown as InstanceType<typeof LocalGoalRepository>;
  });
  vi.mocked(LocalTaskRepository).mockImplementation(function () {
    return { getAll: vi.fn().mockResolvedValue([]), save: vi.fn(), delete: vi.fn() } as unknown as InstanceType<typeof LocalTaskRepository>;
  });
  vi.mocked(LocalHabitRepository).mockImplementation(function () {
    return { getAll: vi.fn().mockResolvedValue([]), save: vi.fn(), delete: vi.fn() } as unknown as InstanceType<typeof LocalHabitRepository>;
  });
  return { mockGoalSave };
}

describe('CreatePage', () => {
  it('creates a new Goal via its "+ Nueva Meta" action (FR-005)', async () => {
    const user = userEvent.setup();
    const { mockGoalSave } = mockRepos();

    render(<CreatePage userId="u1" />);

    await user.click(await screen.findByRole('button', { name: /\+ nueva meta/i }));
    await user.type(screen.getByLabelText(/nombre/i), 'Leer 12 libros');
    await user.type(screen.getByLabelText(/valor objetivo/i), '12');
    fireEvent.submit(screen.getByTestId('goal-form'));

    await waitFor(() => {
      expect(mockGoalSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Leer 12 libros' }));
    });
  });

  it('opens an existing Goal in edit mode via "Editar" (FR-006)', async () => {
    const user = userEvent.setup();
    mockRepos();

    render(<CreatePage userId="u1" />);

    expect(await screen.findByText(/correr 100km/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /editar/i }));

    expect(await screen.findByText(/editar meta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Correr 100km');
  });

  it('also offers creation entry points for Task and Habit (FR-005)', async () => {
    mockRepos();
    render(<CreatePage userId="u1" />);

    expect(await screen.findByRole('button', { name: /\+ nueva tarea/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ nuevo h[aá]bito/i })).toBeInTheDocument();
  });
});
