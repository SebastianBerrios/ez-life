import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HabitsDashboard from './HabitsDashboard';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';

vi.mock('../../infrastructure/repositories/local/LocalHabitRepository');
vi.mock('../../infrastructure/repositories/local/LocalGoalRepository');
vi.mock('../../infrastructure/repositories/local/LocalTaskRepository');

describe('HabitsDashboard', () => {
  it('shows habit streaks, active goals, and upcoming tasks (FR-026)', async () => {
    vi.mocked(LocalHabitRepository).mockImplementation(function () {
      return {
        getAll: vi.fn().mockResolvedValue([
          { id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon'], created_at: new Date(), updated_at: new Date() },
        ]),
        getCompletions: vi.fn().mockResolvedValue([]),
      } as unknown as InstanceType<typeof LocalHabitRepository>;
    });
    vi.mocked(LocalGoalRepository).mockImplementation(function () {
      return {
        getAll: vi.fn().mockResolvedValue([
          { id: 'g1', user_id: 'u1', name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active', created_at: new Date(), updated_at: new Date() },
        ]),
      } as unknown as InstanceType<typeof LocalGoalRepository>;
    });
    vi.mocked(LocalTaskRepository).mockImplementation(function () {
      return {
        getAll: vi.fn().mockResolvedValue([
          { id: 't1', user_id: 'u1', title: 'Pagar alquiler', status: 'pending', due_date: new Date(), created_at: new Date(), updated_at: new Date() },
        ]),
      } as unknown as InstanceType<typeof LocalTaskRepository>;
    });

    render(<HabitsDashboard userId="u1" />);

    expect(await screen.findByText('Correr')).toBeInTheDocument();
    expect(await screen.findByText(/correr 100km/i)).toBeInTheDocument();
    expect(await screen.findByText(/pagar alquiler/i)).toBeInTheDocument();
  });
});
