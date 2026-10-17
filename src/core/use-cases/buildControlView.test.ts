import { describe, expect, it } from 'vitest';
import { buildControlView, pickActiveStreak, type ControlRawData } from './buildControlView';
import { calendarKey } from './calendar';
import type { Goal, Habit, HabitCompletion, Movement, SavingsGoal, Task } from '../domain/models/types';

const created = new Date(2026, 9, 5, 9); // Monday of the week before
const noon = (day: number, month = 9) => new Date(2026, month, day, 12);
const habit = (id: string, o: Partial<Habit> = {}): Habit => ({
  id, user_id: 'u', name: `Hábito ${id}`, schedule_mode: 'fixed_days', fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], created_at: created, updated_at: created, ...o,
});
const done = (habitId: string, day: number, hour = 12): HabitCompletion => {
  const date = new Date(2026, 9, day, hour);
  return { id: `c-${habitId}-${day}-${hour}`, habit_id: habitId, date, token_used: false, created_at: date, updated_at: date };
};
const task = (id: string, due: Date, o: Partial<Task> = {}): Task => ({
  id, user_id: 'u', title: `Tarea ${id}`, due_date: due, status: 'pending', created_at: created, updated_at: created, ...o,
});
const raw = (o: Partial<ControlRawData> = {}): ControlRawData => ({ habits: [], completionsByHabit: {}, tasks: [], goals: [], savingsGoals: [], movements: [], ...o });

// Friday 2026-10-16, 22:30 local (already Saturday in UTC when the host is UTC-5).
const today = new Date(2026, 9, 16, 22, 30);

describe('buildControlView: daily score and header', () => {
  it('is empty and honest with no data (no score, no state, no streak, no adherence)', () => {
    const view = buildControlView(raw(), today);
    expect(view.score).toMatchObject({ scheduled: 0, pct: null, hasData: false });
    expect(view.scoreState).toBeNull();
    expect(view.activeStreak).toBeNull();
    expect(view.adherence).toBeNull();
    expect(view.week.summary.pct).toBeNull();
    expect(view.load).toEqual({ habitsToday: 0, urgentTasks: 0, activeGoals: 0 });
  });

  it('the score is done/scheduled over today\'s habits and tasks (same as Inicio)', () => {
    const view = buildControlView(raw({
      habits: [habit('a'), habit('b')],
      completionsByHabit: { a: [done('a', 16, 21)] },
      tasks: [task('t1', noon(16)), task('t2', noon(16), { status: 'done', done_at: new Date(2026, 9, 16, 9) })],
    }), today);
    expect(view.score).toMatchObject({ done: 2, scheduled: 4, pct: 50 });
    expect(view.scoreState).toBe('en_ritmo');
  });

  it('the week runs Monday to Sunday and the summary covers up to today', () => {
    const view = buildControlView(raw({
      habits: [habit('a', { fixed_days: ['mon', 'fri', 'sun'] })],
      completionsByHabit: { a: [done('a', 12)] },
    }), today);
    expect(view.week.days.map(d => d.date.getDate())).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(calendarKey(view.week.start)).toBe('2026-10-12');
    expect(calendarKey(view.week.end)).toBe('2026-10-18');
    // Mon done, Fri (today) open; Sunday is in the future.
    expect(view.week.summary).toEqual({ done: 1, scheduled: 2, pct: 50 });
    expect(view.week.state).toBe('en_ritmo');
    expect(view.week.days[4].isToday).toBe(true);
  });
});

describe('buildControlView: habits', () => {
  it('builds cards with schedule text, status, streak and 7-day cells; today\'s habits come first', () => {
    const everyDay = habit('daily', { created_at: new Date(2026, 9, 12, 9) });
    const weekdays = habit('wd', { fixed_days: ['mon', 'tue', 'wed', 'thu', 'fri'], created_at: new Date(2026, 9, 5, 9) });
    const sat = habit('sat', { fixed_days: ['sat'], created_at: new Date(2026, 9, 1, 9) });
    const view = buildControlView(raw({
      habits: [sat, weekdays, everyDay],
      completionsByHabit: { daily: [done('daily', 12), done('daily', 13), done('daily', 14), done('daily', 15), done('daily', 16, 21)], wd: [done('wd', 15)] },
    }), today);

    expect(view.habits.map(card => card.habit.id)).toEqual(['wd', 'daily', 'sat']);
    const [wd, daily, off] = view.habits;
    expect(daily).toMatchObject({ scheduleText: 'Todos los días', status: 'done', doneToday: true, streak: 5, streakUnit: 'days' });
    expect(wd).toMatchObject({ scheduleText: 'Lun · Mar · Mié · Jue · Vie', status: 'pending', doneToday: false, scheduledToday: true });
    expect(off).toMatchObject({ scheduleText: 'Sáb', status: 'off', scheduledToday: false });
    expect(daily.last7).toHaveLength(7);
    expect(daily.last7.map(cell => cell.done)).toEqual([false, false, true, true, true, true, true]);
  });

  it('a pending fixed-days habit keeps showing the run through yesterday', () => {
    const view = buildControlView(raw({
      habits: [habit('a', { created_at: new Date(2026, 9, 12, 9) })],
      completionsByHabit: { a: [done('a', 12), done('a', 13), done('a', 14), done('a', 15)] },
    }), today);
    expect(view.habits[0]).toMatchObject({ status: 'pending', streak: 4 });
    expect(view.activeStreak).toEqual({ streak: 4, unit: 'days' });
  });

  it('a frequency habit counts weeks, is done today by a local-day completion, and its adherence is measured', () => {
    const weekly = habit('w', { schedule_mode: 'frequency', fixed_days: undefined, frequency_target: 2, created_at: new Date(2026, 9, 5, 9) });
    const view = buildControlView(raw({
      habits: [weekly],
      completionsByHabit: { w: [done('w', 6), done('w', 8), done('w', 13), done('w', 16, 21)] },
    }), today);
    expect(view.habits[0]).toMatchObject({ scheduleText: '2 veces por semana', status: 'done', streak: 2, streakUnit: 'weeks' });
    expect(view.activeStreak).toEqual({ streak: 2, unit: 'weeks' });
    expect(view.adherence).not.toBeNull();
  });

  it('ignores deleted habits everywhere', () => {
    const view = buildControlView(raw({ habits: [habit('a', { deleted_at: created })] }), today);
    expect(view.habits).toEqual([]);
    expect(view.score.scheduled).toBe(0);
    expect(view.load.habitsToday).toBe(0);
  });
});

describe('pickActiveStreak', () => {
  it('picks the longest day streak; week streaks only when there is no day streak', () => {
    expect(pickActiveStreak([{ streak: 3, streakUnit: 'days' }, { streak: 9, streakUnit: 'days' }, { streak: 12, streakUnit: 'weeks' }])).toEqual({ streak: 9, unit: 'days' });
    expect(pickActiveStreak([{ streak: 2, streakUnit: 'weeks' }, { streak: 5, streakUnit: 'weeks' }])).toEqual({ streak: 5, unit: 'weeks' });
    expect(pickActiveStreak([{ streak: 2, streakUnit: 'weeks' }, { streak: 1, streakUnit: 'days' }])).toEqual({ streak: 1, unit: 'days' });
  });
  it('is null when nothing has a streak', () => {
    expect(pickActiveStreak([])).toBeNull();
    expect(pickActiveStreak([{ streak: 0, streakUnit: 'days' }])).toBeNull();
  });
});

describe('buildControlView: tasks and load', () => {
  it('groups tasks by window and counts urgent ones (pending high, due today or earlier)', () => {
    const view = buildControlView(raw({
      tasks: [
        task('urgent', noon(16), { priority: 'high' }),
        task('late', noon(14), { priority: 'high' }),
        task('sat', noon(17)),
        task('done', noon(16), { status: 'done', done_at: new Date(2026, 9, 16, 8) }),
      ],
    }), today);
    expect(view.tasks.today.map(i => i.task.id)).toEqual(['late', 'urgent']);
    expect(view.tasks.week.map(i => i.task.id)).toEqual(['sat']);
    expect(view.tasks.done.map(t => t.id)).toEqual(['done']);
    expect(view.load.urgentTasks).toBe(2);
  });
});

describe('buildControlView: goals', () => {
  const goal = (id: string, o: Partial<Goal> = {}): Goal => ({
    id, user_id: 'u', name: `Meta ${id}`, kind: 'numeric', target_value: 10, current_value: 4, status: 'active', created_at: created, updated_at: created, ...o,
  });
  const savings = (id: string, o: Partial<SavingsGoal> = {}): SavingsGoal => ({
    id, user_id: 'u', name: `Ahorro ${id}`, target_amount: 100_000, created_at: new Date(2026, 9, 1, 9), updated_at: created, ...o,
  });
  const contribution = (savingsGoalId: string, amount: number): Movement => ({
    id: `m-${savingsGoalId}-${amount}`, user_id: 'u', amount, type: 'EXPENSE', date: new Date(2026, 9, 10, 12), is_recurring: false,
    savings_goal_id: savingsGoalId, created_at: created, updated_at: created,
  } as Movement);

  it('active goals only, with percent and detail; completed and deleted ones are left out', () => {
    const checklist = goal('c', { kind: 'checklist', target_value: undefined, current_value: undefined, milestones: [{ id: 'a', label: 'A', done: true }, { id: 'b', label: 'B', done: false }, { id: 'c', label: 'C', done: false }] });
    const view = buildControlView(raw({
      goals: [goal('n'), checklist, goal('done', { status: 'completed' }), goal('gone', { deleted_at: created })],
    }), today);
    expect(view.goals.map(card => [card.goal.id, card.percent, card.detail])).toEqual([
      ['n', 40, '4 / 10'],
      ['c', 33, '1 / 3 hitos'],
    ]);
    expect(view.load.activeGoals).toBe(2);
  });

  it('savings goals carry current amount, capped percent and a derived status', () => {
    const deadline = new Date(2026, 10, 30, 12);
    const view = buildControlView(raw({
      savingsGoals: [
        savings('behind', { deadline }), // created Oct 1, deadline Nov 30: ~25% expected on Oct 16
        savings('full'),
        savings('open'),
      ],
      movements: [contribution('full', 100_000), contribution('open', 99_999), contribution('behind', 5_000)],
    }), today);
    const byId = Object.fromEntries(view.savingsGoals.map(card => [card.goal.id, card]));
    expect(byId.full).toMatchObject({ currentCents: 100_000, percent: 100, status: 'completed' });
    expect(byId.open).toMatchObject({ currentCents: 99_999, percent: 99, status: 'no_deadline' });
    expect(byId.behind).toMatchObject({ currentCents: 5_000, percent: 5, status: 'behind' });
    // Open goals first (by deadline, undated last), completed last.
    expect(view.savingsGoals.map(card => card.goal.id)).toEqual(['behind', 'open', 'full']);
    expect(view.load.activeGoals).toBe(3 - 1);
  });

  it('ignores a TRANSFER and adjustments when summing savings contributions', () => {
    const view = buildControlView(raw({
      savingsGoals: [savings('s')],
      movements: [{ ...contribution('s', 50_000), type: 'TRANSFER' } as Movement, { ...contribution('s', 20_000), is_adjustment: true } as Movement],
    }), today);
    expect(view.savingsGoals[0].currentCents).toBe(0);
  });
});
