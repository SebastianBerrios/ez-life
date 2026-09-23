import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GoalDashboard from './GoalDashboard';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';

vi.mock('../../infrastructure/repositories/local/LocalGoalRepository');

function mockGoals(goals: unknown[]) {
  vi.mocked(LocalGoalRepository).mockImplementation(function () {
    return { getAll: vi.fn().mockResolvedValue(goals) } as unknown as InstanceType<typeof LocalGoalRepository>;
  });
}

describe('GoalDashboard', () => {
  it('shows a numeric goal with its current progress (FR-007)', async () => {
    mockGoals([
      { id: 'g1', user_id: 'u1', name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active', created_at: new Date(), updated_at: new Date() },
    ]);

    render(<GoalDashboard userId="u1" />);

    expect(await screen.findByText(/correr 100km/i)).toBeInTheDocument();
    expect(screen.getByText(/40 \/ 100/)).toBeInTheDocument();
  });

  it('shows a checklist goal with its milestone progress (FR-007)', async () => {
    mockGoals([
      {
        id: 'g2', user_id: 'u1', name: 'Mudanza', kind: 'checklist',
        milestones: [{ id: 'm1', label: 'Empacar', done: true }, { id: 'm2', label: 'Contratar flete', done: false }],
        status: 'active', created_at: new Date(), updated_at: new Date(),
      },
    ]);

    render(<GoalDashboard userId="u1" />);

    expect(await screen.findByText(/mudanza/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });

  it('shows completed goals too — a dashboard is a full overview (unlike ControlPage\'s "active only" list)', async () => {
    mockGoals([
      { id: 'g3', user_id: 'u1', name: 'Meta vieja', kind: 'numeric', target_value: 10, current_value: 10, status: 'completed', created_at: new Date(), updated_at: new Date() },
    ]);

    render(<GoalDashboard userId="u1" />);

    expect(await screen.findByText(/meta vieja/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no goals', async () => {
    mockGoals([]);

    render(<GoalDashboard userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s metas registradas/i)).toBeInTheDocument();
  });

  it('shows the numeric progress percentage derived from calculateGoalProgress (FR-006)', async () => {
    mockGoals([
      { id: 'g1', user_id: 'u1', name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active', created_at: new Date(), updated_at: new Date() },
    ]);

    render(<GoalDashboard userId="u1" />);

    expect(await screen.findByText(/correr 100km/i)).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });
});
