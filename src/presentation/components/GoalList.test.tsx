import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GoalList from './GoalList';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';

vi.mock('../../infrastructure/repositories/local/LocalGoalRepository');

function mockGoals(goals: unknown[]) {
  vi.mocked(LocalGoalRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(goals),
      updateProgress: vi.fn(),
      delete: vi.fn(),
    } as unknown as InstanceType<typeof LocalGoalRepository>;
  });
}

describe('GoalList', () => {
  it('shows an active goal (FR-009)', async () => {
    mockGoals([
      { id: 'g1', user_id: 'u1', name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 40, status: 'active', created_at: new Date(), updated_at: new Date() },
    ]);

    render(<GoalList userId="u1" />);

    expect(await screen.findByText(/correr 100km/i)).toBeInTheDocument();
  });

  it('does NOT show a completed goal (FR-009: "metas activas")', async () => {
    mockGoals([
      { id: 'g1', user_id: 'u1', name: 'Meta vieja', kind: 'numeric', target_value: 10, current_value: 10, status: 'completed', created_at: new Date(), updated_at: new Date() },
    ]);

    render(<GoalList userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s metas registradas/i)).toBeInTheDocument();
    expect(screen.queryByText('Meta vieja')).not.toBeInTheDocument();
  });
});
