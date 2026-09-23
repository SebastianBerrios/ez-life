import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import HabitDashboard from './HabitDashboard';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';

vi.mock('../../infrastructure/repositories/local/LocalHabitRepository');

function mockHabits(habits: unknown[], completionsByHabit: Record<string, unknown[]> = {}) {
  vi.mocked(LocalHabitRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(habits),
      getCompletions: vi.fn((habitId: string) => Promise.resolve(completionsByHabit[habitId] ?? [])),
    } as unknown as InstanceType<typeof LocalHabitRepository>;
  });
}

describe('HabitDashboard', () => {
  it('shows every habit with its current streak (FR-005)', async () => {
    const today = new Date();
    mockHabits(
      [{ id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], created_at: today, updated_at: today }],
      { h1: [{ id: 'c1', habit_id: 'h1', date: today, token_used: false, created_at: today, updated_at: today }] }
    );

    render(<HabitDashboard userId="u1" />);

    expect(await screen.findByText('Correr')).toBeInTheDocument();
    expect(screen.getByText(/racha:\s*1/i)).toBeInTheDocument();
  });

  it('shows every habit regardless of whether it is scheduled today (dashboard is a full overview, not the "hoy" agenda)', async () => {
    const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const otherCode = DAY_CODES[(new Date().getUTCDay() + 1) % 7];
    mockHabits([
      { id: 'h1', user_id: 'u1', name: 'Yoga', schedule_mode: 'fixed_days', fixed_days: [otherCode], created_at: new Date(), updated_at: new Date() },
    ]);

    render(<HabitDashboard userId="u1" />);

    expect(await screen.findByText('Yoga')).toBeInTheDocument();
  });

  it('shows an empty state when there are no habits', async () => {
    mockHabits([]);

    render(<HabitDashboard userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s h[aá]bitos registrados/i)).toBeInTheDocument();
  });

  it('renders the streak evolution chart with a 30-day default range (FR-004, FR-010)', async () => {
    const today = new Date();
    mockHabits(
      [{ id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], created_at: today, updated_at: today }],
      { h1: [{ id: 'c1', habit_id: 'h1', date: today, token_used: false, created_at: today, updated_at: today }] }
    );

    render(<HabitDashboard userId="u1" />);

    expect(await screen.findByTestId('habit-streak-chart-h1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lets the user change the streak-history range (FR-010)', async () => {
    const user = userEvent.setup();
    const today = new Date();
    mockHabits(
      [{ id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], created_at: today, updated_at: today }],
      { h1: [{ id: 'c1', habit_id: 'h1', date: today, token_used: false, created_at: today, updated_at: today }] }
    );

    render(<HabitDashboard userId="u1" />);
    await screen.findByTestId('habit-streak-chart-h1');

    await user.click(screen.getByRole('button', { name: '7 días' }));

    expect(screen.getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'false');
  });
});
