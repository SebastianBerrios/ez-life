import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HabitList from './HabitList';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { calculateHabitCompletionRate } from '../../core/use-cases/calculateHabitCompletionRate';

vi.mock('../../infrastructure/repositories/local/LocalHabitRepository');
vi.mock('../../core/use-cases/calculateHabitCompletionRate');

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const todayCode = DAY_CODES[new Date().getUTCDay()];
const otherCode = DAY_CODES[(new Date().getUTCDay() + 1) % 7];

function mockHabits(habits: unknown[], completionsByHabit: Record<string, unknown[]> = {}) {
  vi.mocked(LocalHabitRepository).mockImplementation(function () {
    return {
      getAll: vi.fn().mockResolvedValue(habits),
      getCompletions: vi.fn((habitId: string) => Promise.resolve(completionsByHabit[habitId] ?? [])),
      recordCompletion: vi.fn(),
      delete: vi.fn(),
    } as unknown as InstanceType<typeof LocalHabitRepository>;
  });
}

describe('HabitList', () => {
  it('shows the rolling 30-day completion rate next to streak/tokens (SC-006, spec 001)', async () => {
    mockHabits([
      { id: 'h1', user_id: 'u1', name: 'Meditar', schedule_mode: 'fixed_days', fixed_days: [todayCode], created_at: new Date(), updated_at: new Date() },
    ]);
    vi.mocked(calculateHabitCompletionRate).mockReturnValue(72);

    render(<HabitList userId="u1" />);

    expect(await screen.findByText('Meditar')).toBeInTheDocument();
    expect(screen.getByText(/72% de cumplimiento/i)).toBeInTheDocument();
  });

  it('still shows the existing streak/tokens line alongside the completion rate', async () => {
    mockHabits([
      { id: 'h1', user_id: 'u1', name: 'Correr', schedule_mode: 'fixed_days', fixed_days: [todayCode], created_at: new Date(), updated_at: new Date() },
    ]);
    vi.mocked(calculateHabitCompletionRate).mockReturnValue(50);

    render(<HabitList userId="u1" />);

    expect(await screen.findByText(/racha:/i)).toBeInTheDocument();
    expect(screen.getByText(/50% de cumplimiento/i)).toBeInTheDocument();
  });

  it('shows a fixed-days habit scheduled for today (FR-008)', async () => {
    mockHabits([
      { id: 'h1', user_id: 'u1', name: 'Meditar', schedule_mode: 'fixed_days', fixed_days: [todayCode], created_at: new Date(), updated_at: new Date() },
    ]);
    vi.mocked(calculateHabitCompletionRate).mockReturnValue(0);

    render(<HabitList userId="u1" />);

    expect(await screen.findByText('Meditar')).toBeInTheDocument();
  });

  it('does NOT show a fixed-days habit not scheduled for today (FR-008)', async () => {
    mockHabits([
      { id: 'h1', user_id: 'u1', name: 'Yoga', schedule_mode: 'fixed_days', fixed_days: [otherCode], created_at: new Date(), updated_at: new Date() },
    ]);
    vi.mocked(calculateHabitCompletionRate).mockReturnValue(0);

    render(<HabitList userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s h[aá]bitos registrados/i)).toBeInTheDocument();
    expect(screen.queryByText('Yoga')).not.toBeInTheDocument();
  });

  it('does NOT show a frequency habit that already met this week\'s target (FR-008)', async () => {
    const today = new Date();
    mockHabits(
      [{ id: 'h1', user_id: 'u1', name: 'Leer', schedule_mode: 'frequency', frequency_target: 1, created_at: new Date(), updated_at: new Date() }],
      { h1: [{ id: 'c1', habit_id: 'h1', date: today, token_used: false, created_at: today, updated_at: today }] }
    );
    vi.mocked(calculateHabitCompletionRate).mockReturnValue(0);

    render(<HabitList userId="u1" />);

    expect(await screen.findByText(/no ten[eé]s h[aá]bitos registrados/i)).toBeInTheDocument();
    expect(screen.queryByText('Leer')).not.toBeInTheDocument();
  });
});
