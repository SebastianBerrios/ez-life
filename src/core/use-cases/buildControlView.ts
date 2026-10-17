import type { Goal, Habit, HabitCompletion, Movement, SavingsGoal, Task } from '../domain/models/types';
import { calendarKey, weekWindow } from './calendar';
import { buildFocusToday } from './buildFocusToday';
import { currentHabitStreak } from './buildHabitStreak';
import { calculateAdherence } from './calculateAdherence';
import { calculateDailyScore, type DailyScore } from './calculateDailyScore';
import { calculateGoalProgress } from './calculateGoalProgress';
import { calculateSavingsGoalProgress } from './calculateSavingsGoalProgress';
import { calculateWeeklyPerformance, summarizeWeek, type DayPerformance, type WeekSummary } from './calculateWeeklyPerformance';
import { describeGoalStatus, type GoalStatus } from './describeGoalStatus';
import { describeHabitSchedule } from './describeHabitSchedule';
import { describeScoreState, type ScoreState } from './describeScoreState';
import { groupTasksByWindow, countUrgentTasks, type TaskWindows } from './groupTasksByWindow';
import { habitLast7Days, habitStateOnDay, type HabitDayCell } from './habitDay';

export interface ControlRawData {
  habits: Habit[];
  completionsByHabit: Record<string, HabitCompletion[]>;
  /** Every non-deleted task, done ones included. */
  tasks: Task[];
  goals: Goal[];
  savingsGoals: SavingsGoal[];
  /** All-time movements (savings goal progress is lifetime, not cycle-scoped). */
  movements: Movement[];
}

export type HabitTodayStatus = 'done' | 'pending' | 'off';

export interface HabitCard {
  habit: Habit;
  scheduleText: string;
  streak: number;
  streakUnit: 'days' | 'weeks';
  /** Streak-protection tokens ("comodines") currently available. */
  tokensAvailable: number;
  doneToday: boolean;
  scheduledToday: boolean;
  /** 'done' = completed today, 'pending' = scheduled and open, 'off' = not scheduled today. */
  status: HabitTodayStatus;
  last7: HabitDayCell[];
}

export interface GoalCard {
  goal: Goal;
  /** Integer 0-100. */
  percent: number;
  /** Numeric: "current / target"; checklist: "done / total hitos". */
  detail: string;
}

export interface SavingsGoalCard {
  goal: SavingsGoal;
  currentCents: number;
  /** Integer 0-100; never 100 while the goal is still open. */
  percent: number;
  status: GoalStatus;
}

export interface ActiveStreak {
  streak: number;
  unit: 'days' | 'weeks';
}

export interface ControlView {
  today: Date;
  /** Same score as Inicio: share of today's habits and tasks that are done. */
  score: DailyScore;
  scoreState: ScoreState | null;
  /** Longest current streak among habits; `null` when no habit has a streak. */
  activeStreak: ActiveStreak | null;
  week: { days: DayPerformance[]; start: Date; end: Date; summary: WeekSummary; state: ScoreState | null };
  load: { habitsToday: number; urgentTasks: number; activeGoals: number };
  habits: HabitCard[];
  /** Average 30-day adherence of the habits; `null` when there is nothing to measure. */
  adherence: number | null;
  tasks: TaskWindows;
  goals: GoalCard[];
  savingsGoals: SavingsGoalCard[];
}

/**
 * The longest current streak to headline ("Racha activa"). Day streaks (fixed-days habits) and
 * week streaks are different units and are never compared: day streaks win when any exists, a week
 * streak is shown only if no habit has a day streak. `null` when every streak is 0.
 */
export function pickActiveStreak(cards: Pick<HabitCard, 'streak' | 'streakUnit'>[]): ActiveStreak | null {
  let best: ActiveStreak | null = null;
  for (const card of cards) {
    if (card.streak <= 0) continue;
    const candidate = { streak: card.streak, unit: card.streakUnit };
    if (!best
      || (candidate.unit === 'days' && best.unit === 'weeks')
      || (candidate.unit === best.unit && candidate.streak > best.streak)) best = candidate;
  }
  return best;
}

function wholePercent(percentage: number): number {
  if (percentage >= 100) return 100;
  return Math.min(99, Math.max(0, Math.floor(percentage)));
}

function buildHabitCards(habits: Habit[], completionsByHabit: Record<string, HabitCompletion[]>, today: Date): HabitCard[] {
  const cards = habits.filter(habit => !habit.deleted_at).map((habit): HabitCard => {
    const completions = completionsByHabit[habit.id] ?? [];
    const state = habitStateOnDay(habit, completions, today, today);
    const { streak, unit, tokensAvailable } = currentHabitStreak(habit, completions, today);
    return {
      habit,
      scheduleText: describeHabitSchedule(habit),
      streak,
      streakUnit: unit,
      tokensAvailable,
      doneToday: state.done,
      scheduledToday: state.scheduled,
      status: state.done ? 'done' : state.scheduled ? 'pending' : 'off',
      last7: habitLast7Days(habit, completions, today),
    };
  });
  // Habits that apply today first (they keep their place when checked); stable by creation otherwise.
  return cards.sort((a, b) => Number(b.scheduledToday) - Number(a.scheduledToday) || a.habit.created_at.getTime() - b.habit.created_at.getTime());
}

function buildGoalCard(goal: Goal): GoalCard {
  const percent = Math.round(calculateGoalProgress(goal) * 100);
  const detail = goal.kind === 'numeric'
    ? `${goal.current_value ?? 0} / ${goal.target_value ?? 0}`
    : `${(goal.milestones ?? []).filter(m => m.done).length} / ${(goal.milestones ?? []).length} hitos`;
  return { goal, percent, detail };
}

/**
 * Everything the Control screen renders for `today`, derived from the local data. Pure and
 * deterministic: every day comparison is by LOCAL calendar day.
 */
export function buildControlView(raw: ControlRawData, today: Date): ControlView {
  const liveHabits = raw.habits.filter(habit => !habit.deleted_at);
  const focus = buildFocusToday(liveHabits, raw.completionsByHabit, raw.tasks, today);
  const score = calculateDailyScore(focus);

  const habits = buildHabitCards(liveHabits, raw.completionsByHabit, today);
  const weekDays = calculateWeeklyPerformance(liveHabits, raw.completionsByHabit, raw.tasks, today, today);
  const summary = summarizeWeek(weekDays);
  const { start, end } = weekWindow(today);

  const goals = raw.goals.filter(goal => !goal.deleted_at && goal.status !== 'completed').map(buildGoalCard);
  const savingsGoals = raw.savingsGoals
    .filter(goal => !goal.deleted_at && goal.target_amount > 0)
    .map((goal): SavingsGoalCard => {
      const { currentAmountCents, percentage } = calculateSavingsGoalProgress(goal, raw.movements);
      return { goal, currentCents: currentAmountCents, percent: wholePercent(percentage), status: describeGoalStatus(goal, percentage, today) };
    })
    // Open goals first (nearest deadline first), completed ones last.
    .sort((a, b) =>
      Number(a.status === 'completed') - Number(b.status === 'completed')
      || (a.goal.deadline ? calendarKey(a.goal.deadline) : '9999').localeCompare(b.goal.deadline ? calendarKey(b.goal.deadline) : '9999')
      || a.goal.name.localeCompare(b.goal.name));

  return {
    today,
    score,
    scoreState: describeScoreState(score.pct),
    activeStreak: pickActiveStreak(habits),
    week: { days: weekDays, start, end: new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1), summary, state: describeScoreState(summary.pct) },
    load: {
      habitsToday: habits.filter(card => card.scheduledToday).length,
      urgentTasks: countUrgentTasks(raw.tasks, today),
      activeGoals: goals.length + savingsGoals.filter(card => card.status !== 'completed').length,
    },
    habits,
    adherence: calculateAdherence(liveHabits, raw.completionsByHabit, today),
    tasks: groupTasksByWindow(raw.tasks, today),
    goals,
    savingsGoals,
  };
}
