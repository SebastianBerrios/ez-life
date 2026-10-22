import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { emitSyncCompleted } from '../../infrastructure/sync/syncEvents';
import { HIDE_AMOUNTS_STORAGE_KEY } from '../hooks/useHideAmounts';

type Row = Record<string, unknown>;

// Mutable fixtures read by the factory mocks below (hoisted so the mocks can see them).
const state = vi.hoisted(() => ({
  habits: [] as Row[],
  completions: {} as Record<string, Row[]>,
  tasks: [] as Row[],
  goals: [] as Row[],
  loans: [] as Row[],
  accounts: [] as Row[],
  allMovements: [] as Row[],
  spaces: [] as Row[],
  sharedMovements: {} as Record<string, Row[]>,
  progress: { items: [] as Row[], visible: false, loading: false, error: false },
  recordCompletion: vi.fn(),
  markDone: vi.fn(),
}));

vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');
vi.mock('../../infrastructure/repositories/local/LocalDebtRepository');
vi.mock('../../infrastructure/repositories/local/LocalIncomeSourceRepository', () => ({
  LocalIncomeSourceRepository: vi.fn(function () { return { getAll: vi.fn().mockResolvedValue([{ id: 'salary', amount: 10000 }]) }; }),
}));
vi.mock('../../infrastructure/repositories/local/LocalPaymentAccountRepository', () => ({
  LocalPaymentAccountRepository: vi.fn(function () { return { getAll: async () => state.accounts }; }),
}));
vi.mock('../../infrastructure/repositories/local/LocalInstallmentLoanRepository', () => ({
  LocalInstallmentLoanRepository: vi.fn(function () { return { getAll: async () => state.loans }; }),
}));
vi.mock('../../infrastructure/repositories/local/LocalSavingsGoalRepository', () => ({
  LocalSavingsGoalRepository: vi.fn(function () { return { getAll: async () => state.goals }; }),
}));
vi.mock('../../infrastructure/repositories/local/LocalHabitRepository', () => ({
  LocalHabitRepository: vi.fn(function () {
    return {
      getAll: async () => state.habits,
      getCompletions: async (habitId: string) => state.completions[habitId] ?? [],
      recordCompletion: async (habitId: string, date: Date, tokenUsed: boolean) => {
        state.recordCompletion(habitId, date, tokenUsed);
        state.completions[habitId] = [...(state.completions[habitId] ?? []), { id: `c-${habitId}`, habit_id: habitId, date, token_used: tokenUsed }];
      },
    };
  }),
}));
vi.mock('../../infrastructure/repositories/local/LocalTaskRepository', () => ({
  LocalTaskRepository: vi.fn(function () {
    return {
      getAllIncludingDone: async () => state.tasks,
      markDone: async (id: string) => {
        state.markDone(id);
        state.tasks = state.tasks.map(task => (task.id === id ? { ...task, status: 'done' } : task));
      },
    };
  }),
}));
vi.mock('../../infrastructure/repositories/local/LocalSharedSpaceRepository', () => ({
  LocalSharedSpaceRepository: vi.fn(function () { return { getAllForUser: async () => state.spaces }; }),
}));
vi.mock('../../infrastructure/repositories/local/LocalSharedMovementRepository', () => ({
  LocalSharedMovementRepository: vi.fn(function () { return { getAllForSpace: async (spaceId: string) => state.sharedMovements[spaceId] ?? [] }; }),
}));
vi.mock('../hooks/usePersonalProgress', () => ({ usePersonalProgress: () => state.progress }));

const WAIT = { timeout: 3000 };

// Dashboard fetches the current cycle AND the previous cycle (FR-003) — this
// mock picks which array to return based on the requested cycle's month, so
// tests can control current vs. previous period data independently. `allTime`
// feeds the full-history read behind capital, recent movements and goals.
function mockMovements(current: unknown[], previous: unknown[] = [], allTime: unknown[] = current) {
  const todayMonth = new Date().getMonth();
  const getAllByCycle = vi.fn((_userId: string, start: Date) =>
    Promise.resolve(start.getMonth() === todayMonth ? current : previous)
  );
  const getAll = vi.fn(() => Promise.resolve(allTime));
  vi.mocked(LocalMovementRepository).mockImplementation(function () {
    return { getAllByCycle, getAll } as unknown as InstanceType<typeof LocalMovementRepository>;
  });
  return { getAllByCycle, getAll };
}

function mockCategories(
  distCategories: unknown[] = [],
  expenseCategories: unknown[] = [],
  subcategoriesByCategory: Record<string, unknown[]> = {}
) {
  vi.mocked(LocalCategoryRepository).mockImplementation(function () {
    return {
      getDistributionCategories: vi.fn().mockResolvedValue(distCategories),
      getExpenseCategories: vi.fn().mockResolvedValue(expenseCategories),
      getSubcategories: vi.fn((categoryId: string) => Promise.resolve(subcategoriesByCategory[categoryId] ?? [])),
    } as unknown as InstanceType<typeof LocalCategoryRepository>;
  });
}

function mockDebts(debts: unknown[] = []) {
  vi.mocked(LocalDebtRepository).mockImplementation(function () {
    return { getAll: vi.fn().mockResolvedValue(debts) } as unknown as InstanceType<typeof LocalDebtRepository>;
  });
}

const baseCategory = {
  user_id: 'user-1',
  is_default: true,
  is_savings: false,
  created_at: new Date(),
  updated_at: new Date(),
};

const baseExpenseCategory = {
  user_id: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
};

function movement(overrides: Record<string, unknown>) {
  return {
    id: `m-${Math.random()}`, user_id: 'user-1', type: 'EXPENSE', amount: 0, date: new Date(), description: undefined,
    is_recurring: false, created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (id: string, name: string, overrides: Row = {}): Row => ({
  id, user_id: 'user-1', name, schedule_mode: 'fixed_days', fixed_days: ALL_DAYS, created_at: new Date(), updated_at: new Date(), ...overrides,
});
const taskDueToday = (id: string, title: string, overrides: Row = {}): Row => {
  const now = new Date();
  return { id, user_id: 'user-1', title, due_date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12), status: 'pending', created_at: now, updated_at: now, ...overrides };
};

function setDesktop(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  state.habits = []; state.completions = {}; state.tasks = []; state.goals = []; state.loans = []; state.accounts = [];
  state.allMovements = []; state.spaces = []; state.sharedMovements = {};
  state.progress = { items: [], visible: false, loading: false, error: false };
  state.recordCompletion.mockClear(); state.markDone.mockClear();
  window.localStorage.clear();
  setDesktop(false);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('Dashboard — month from the shell (refDate)', () => {
  it('loads the cycle of refDate and its previous month, with no internal month controls', async () => {
    const { getAllByCycle } = mockMovements([]);
    mockCategories();
    mockDebts([]);

    const { rerender } = render(<Dashboard userId="user-1" refDate={new Date(2026, 7, 1)} />);
    await waitFor(() => expect(getAllByCycle).toHaveBeenCalledTimes(2), WAIT);
    expect(getAllByCycle.mock.calls.map(call => (call[1] as Date).getMonth()).sort()).toEqual([6, 7]);
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mes siguiente' })).toBeNull();

    rerender(<Dashboard userId="user-1" refDate={new Date(2026, 8, 1)} />);
    await waitFor(() => expect(getAllByCycle).toHaveBeenCalledTimes(4), WAIT);
    expect(getAllByCycle.mock.calls.slice(2).map(call => (call[1] as Date).getMonth()).sort()).toEqual([7, 8]);
  });
});

describe('Dashboard', () => {
  it('shows active debts alongside the existing budget-vs-actual view (FR-025)', async () => {
    mockMovements([]);
    mockCategories([]);
    mockDebts([
      {
        id: 'debt-1', user_id: 'user-1', counterparty_name: 'Juan', direction: 'lent', origin: 'manual',
        amount: 10000, settled_amount: 4000, created_at: new Date(), updated_at: new Date(),
      },
    ]);

    render(<Dashboard userId="user-1" />);

    expect(await screen.findByRole('heading', { name: /préstamos activos/i })).toBeInTheDocument();
    expect(await screen.findByText(/le prestaste a juan/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('debt-debt-1')).toHaveTextContent(/S\/\s*60\.00/); // remaining balance, S/60.00
    });
  });

  it('does not list a fully settled debt and shows a friendly message when there are no active debts', async () => {
    mockMovements([]);
    mockCategories([]);
    mockDebts([
      { id: 'd-done', user_id: 'user-1', counterparty_name: 'Ana', direction: 'borrowed', origin: 'manual', amount: 5000, settled_amount: 5000, created_at: new Date(), updated_at: new Date() },
    ]);

    render(<Dashboard userId="user-1" />);

    expect(await screen.findByText(/no tienes deudas activas/i)).toBeInTheDocument();
    expect(screen.queryByText(/ana/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /ver préstamos/i })).toBeNull();
  });

  it('reloads local data when a sync cycle completes (e.g. a movement pulled from another device)', async () => {
    const { getAllByCycle } = mockMovements([]);
    mockCategories([]);
    mockDebts([]);

    render(<Dashboard userId="user-1" />);
    // One call for the current cycle, one for the previous cycle (FR-003).
    await waitFor(() => expect(getAllByCycle).toHaveBeenCalledTimes(2), WAIT);

    act(() => {
      emitSyncCompleted();
    });

    await waitFor(() => expect(getAllByCycle).toHaveBeenCalledTimes(4), WAIT);
  });

  it('keeps showing the screen (no skeleton) while a later reload is in flight', async () => {
    mockMovements([movement({ type: 'INCOME', amount: 10000 })]);
    mockCategories([]);
    mockDebts([]);

    render(<Dashboard userId="user-1" />);
    await screen.findByTestId('hero-balance');
    act(() => {
      emitSyncCompleted();
    });
    expect(screen.queryByTestId('dashboard-loading')).toBeNull();
    expect(screen.getByTestId('hero-balance')).toBeInTheDocument();
  });

  describe('budget semaphore (FR-001, T008)', () => {
    it('marks each distribution category with a 3-level color indicator by proximity to its limit', async () => {
      mockMovements([
        movement({ type: 'INCOME', amount: 10000 }),
        movement({ type: 'EXPENSE', amount: 6000, distribution_category_id: 'over-cat', expense_category_id: 'ec-over' }),
        movement({ type: 'EXPENSE', amount: 2700, distribution_category_id: 'warn-cat', expense_category_id: 'ec-warn' }),
        movement({ type: 'EXPENSE', amount: 200, distribution_category_id: 'ok-cat', expense_category_id: 'ec-ok' }),
      ]);
      mockCategories(
        [
          { ...baseCategory, id: 'over-cat', name: 'Esenciales', percentage: 50 },
          { ...baseCategory, id: 'warn-cat', name: 'Gustos', percentage: 30 },
          { ...baseCategory, id: 'ok-cat', name: 'Ahorro', percentage: 20 },
        ],
        [
          { ...baseExpenseCategory, id: 'ec-over', distribution_category_id: 'over-cat', name: 'Comida' },
          { ...baseExpenseCategory, id: 'ec-warn', distribution_category_id: 'warn-cat', name: 'Ocio' },
          { ...baseExpenseCategory, id: 'ec-ok', distribution_category_id: 'ok-cat', name: 'Ahorro extra' },
        ]
      );
      mockDebts([]);

      render(<Dashboard userId="user-1" />);

      const over = await screen.findByTestId('budget-status-over-cat');
      const warning = await screen.findByTestId('budget-status-warn-cat');
      const ok = await screen.findByTestId('budget-status-ok-cat');

      expect(over).toHaveAttribute('aria-label', 'Presupuesto excedido');
      expect(warning).toHaveAttribute('aria-label', 'Cerca del límite');
      expect(ok).toHaveAttribute('aria-label', 'Dentro del límite');

      // Spent / budget per bucket, whole-percent consumption and the real category names of the bucket.
      const overRow = screen.getByTestId('budget-row-over-cat');
      expect(overRow).toHaveTextContent(/120% consumido/);
      expect(overRow).toHaveTextContent(/de S\/ 50\.00/);
      expect(overRow).toHaveTextContent('Comida');
      expect(overRow).toHaveTextContent(/Excedido por S\/ 10\.00/);
      expect(screen.getByTestId('budget-row-ok-cat')).toHaveTextContent(/Disponible: S\/ 18\.00/);
    });

    it('lists the buckets largest share first, whatever order the repository returns them in', async () => {
      mockMovements([]);
      mockCategories([
        { ...baseCategory, id: 'a-ahorro', name: 'Ahorro', percentage: 20 },
        { ...baseCategory, id: 'b-gustos', name: 'Gustos', percentage: 30 },
        { ...baseCategory, id: 'c-nec', name: 'Necesidades', percentage: 50 },
      ]);
      mockDebts([]);

      render(<Dashboard userId="user-1" />);

      await screen.findByTestId('budget-row-c-nec');
      const order = screen.getAllByTestId(/^budget-row-/).map(row => row.getAttribute('data-testid'));
      expect(order).toEqual(['budget-row-c-nec', 'budget-row-b-gustos', 'budget-row-a-ahorro']);
    });

    it('says so when no distribution categories exist and when there is no expected income', async () => {
      mockMovements([]);
      mockCategories([]);
      mockDebts([]);
      render(<Dashboard userId="user-1" />);
      expect(await screen.findByText(/no hay categorías de distribución configuradas/i)).toBeInTheDocument();
    });
  });

  it('removed the category bar chart and the period-comparison card (comparison lives in the hero delta)', async () => {
    mockMovements([movement({ type: 'INCOME', amount: 10000 })], [movement({ type: 'INCOME', amount: 8000 })]);
    mockCategories([{ ...baseCategory, id: 'over-cat', name: 'Esenciales', percentage: 50 }]);
    mockDebts([]);

    render(<Dashboard userId="user-1" />);
    await screen.findByTestId('hero-balance');
    expect(screen.queryByTestId('category-breakdown-chart')).toBeNull();
    expect(screen.queryByTestId('period-comparison')).toBeNull();
    expect(screen.queryByText(/comparación con el mes anterior/i)).toBeNull();
  });
});

describe('Dashboard — structure (mobile)', () => {
  it('keeps the heading order valid: an (invisible) h2 sits between the shell h1 and the panel h3 titles', async () => {
    mockMovements([movement({ type: 'INCOME', amount: 10000 })], []);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);

    const mobile = await screen.findByTestId('dashboard-mobile');
    const h2 = within(mobile).getByRole('heading', { level: 2, name: 'Resumen del ciclo' });
    expect(h2).toHaveClass('sr-only');
    const headings = within(mobile).getAllByRole('heading');
    expect(headings[0]).toBe(h2);
  });

  it('reserves a full screen of skeleton while loading so the rows under it never jump', () => {
    mockMovements([], []);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);
    expect(screen.getByTestId('dashboard-loading')).toHaveClass('min-h-[100dvh]');
  });
});

describe('Dashboard — hero (mobile)', () => {
  it('shows the cycle balance, the delta against the previous cycle and the available capital', async () => {
    mockMovements(
      [movement({ type: 'INCOME', amount: 10000 }), movement({ type: 'EXPENSE', amount: 6000 })],
      [movement({ type: 'INCOME', amount: 8000 }), movement({ type: 'EXPENSE', amount: 3000 })],
      [movement({ type: 'INCOME', amount: 10000 }), movement({ type: 'EXPENSE', amount: 6000 })],
    );
    state.accounts = [{ id: 'a', user_id: 'user-1', name: 'BCP', kind: 'debit', opening_balance: 100000, created_at: new Date(), updated_at: new Date() }];
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" />);

    const hero = await screen.findByTestId('hero-balance');
    expect(within(hero).getByText(/balance del ciclo/i)).toBeInTheDocument();
    expect(screen.getByTestId('hero-amount')).toHaveTextContent(/^S\/\s*40\.00$/);
    // previous balance 50.00 -> delta -10.00
    expect(screen.getByTestId('balance-delta')).toHaveTextContent(/-S\/ 10\.00\s*vs mes anterior/);
    // capital = opening 1,000.00 (+ unassigned net 40.00)
    expect(screen.getByTestId('hero-capital')).toHaveTextContent(/S\/\s*1,040\.00/);
  });

  it('says there is nothing to compare when the previous cycle has no data', async () => {
    mockMovements([movement({ type: 'INCOME', amount: 10000 })], []);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);
    expect(await screen.findByText(/sin datos del mes anterior/i)).toBeInTheDocument();
    expect(screen.queryByTestId('balance-delta')).toBeNull();
  });

  it('hides amounts with the eye toggle, persists the choice and restores it on remount', async () => {
    const user = userEvent.setup();
    mockMovements([movement({ type: 'INCOME', amount: 10000 })]);
    mockCategories();
    mockDebts([]);

    const first = render(<Dashboard userId="user-1" />);
    const toggle = await screen.findByRole('button', { name: 'Ocultar montos' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('hero-amount')).toHaveTextContent('100.00');

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Mostrar montos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('hero-amount')).toHaveTextContent('••••');
    expect(screen.getByTestId('hero-amount')).not.toHaveTextContent('100.00');
    expect(screen.getByTestId('hero-capital')).toHaveTextContent('••••');
    expect(window.localStorage.getItem(HIDE_AMOUNTS_STORAGE_KEY)).toBe('1');

    first.unmount();
    render(<Dashboard userId="user-1" />);
    await waitFor(() => expect(screen.getByTestId('hero-amount')).toHaveTextContent('••••'));

    await user.click(screen.getByRole('button', { name: 'Mostrar montos' }));
    expect(screen.getByTestId('hero-amount')).toHaveTextContent('100.00');
    expect(window.localStorage.getItem(HIDE_AMOUNTS_STORAGE_KEY)).toBe('0');
  });

  it('keeps working when localStorage is unavailable', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    mockMovements([movement({ type: 'INCOME', amount: 10000 })]);
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" />);
    await user.click(await screen.findByRole('button', { name: 'Ocultar montos' }));
    expect(screen.getByTestId('hero-amount')).toHaveTextContent('••••');
    setItem.mockRestore();
    getItem.mockRestore();
  });

  it('routes the four quick actions: Ingreso / Gasto / Mover open the sheet on their tab, Metas goes to Control', async () => {
    const user = userEvent.setup();
    const onOpenQuickRecord = vi.fn();
    const onNavigate = vi.fn();
    mockMovements([]);
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" onOpenQuickRecord={onOpenQuickRecord} onNavigate={onNavigate} />);
    const actions = within(await screen.findByRole('group', { name: 'Acciones rápidas' }));

    await user.click(actions.getByRole('button', { name: 'Ingreso' }));
    await user.click(actions.getByRole('button', { name: 'Gasto' }));
    await user.click(actions.getByRole('button', { name: 'Mover' }));
    expect(onOpenQuickRecord.mock.calls.map(call => call[0])).toEqual(['income', 'expense', 'transfer']);

    await user.click(actions.getByRole('button', { name: 'Metas' }));
    expect(onNavigate).toHaveBeenCalledWith('control', undefined);
  });
});

describe('Dashboard — Foco de Hoy', () => {
  it('shows an empty state when nothing is scheduled today', async () => {
    mockMovements([]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);
    expect(await screen.findByText('Nada programado para hoy')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver todo/i })).toBeNull();
  });

  it('lists the habit and the tasks due today, with the urgent badge and the habit streak', async () => {
    state.habits = [habit('h1', 'Tender la cama')];
    const now = new Date();
    const dayNoon = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    state.habits = [habit('h1', 'Tender la cama', { created_at: dayNoon(-3) })];
    state.completions = { h1: [-3, -2, -1].map(offset => ({ id: `c${offset}`, habit_id: 'h1', date: dayNoon(offset), token_used: false })) };
    state.tasks = [
      taskDueToday('t1', 'Examen UI/UX', { priority: 'high' }),
      taskDueToday('t2', 'Mañana no', { due_date: new Date(Date.now() + 2 * 86400000) }),
    ];
    mockMovements([]);
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" />);

    const task = await screen.findByTestId('focus-item-task-t1');
    expect(within(task).getByText('Urgente')).toBeInTheDocument();
    expect(within(task).getByText(/vence hoy/i)).toBeInTheDocument();
    expect(screen.queryByText('Mañana no')).toBeNull();
    const habitRow = screen.getByTestId('focus-item-habit-h1');
    expect(habitRow).toHaveTextContent('Tender la cama');
    expect(habitRow).toHaveTextContent(/Racha 3 d/);
    // Urgent tasks come first, then habits.
    const rows = screen.getAllByTestId(/^focus-item-/).map(row => row.getAttribute('data-testid'));
    expect(rows).toEqual(['focus-item-task-t1', 'focus-item-habit-h1']);
    expect(screen.getByRole('button', { name: /ver todo \(2\)/i })).toBeInTheDocument();
  });

  it('marks a habit done with the check (recordCompletion for today) and keeps it done', async () => {
    const user = userEvent.setup();
    state.habits = [habit('h1', 'Meditar')];
    mockMovements([]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);

    const check = await screen.findByRole('checkbox', { name: /meditar/i });
    expect(check).toHaveAttribute('aria-checked', 'false');
    await user.click(check);

    expect(state.recordCompletion).toHaveBeenCalledTimes(1);
    expect(state.recordCompletion.mock.calls[0][0]).toBe('h1');
    expect(state.recordCompletion.mock.calls[0][2]).toBe(false);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /meditar/i })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('checkbox', { name: /meditar/i })).toBeDisabled();
    expect(screen.getByTestId('focus-item-habit-h1')).toHaveTextContent(/completado/i);
  });

  it('marks a task done with the keyboard (Space) through markDone', async () => {
    const user = userEvent.setup();
    state.tasks = [taskDueToday('t1', 'Pagar luz')];
    mockMovements([]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);

    const check = await screen.findByRole('checkbox', { name: /pagar luz/i });
    check.focus();
    await user.keyboard(' ');

    expect(state.markDone).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /pagar luz/i })).toHaveAttribute('aria-checked', 'true'));
  });

  it('"Ver todo" goes to Control', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    state.tasks = [taskDueToday('t1', 'Algo')];
    mockMovements([]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" onNavigate={onNavigate} />);
    await user.click(await screen.findByRole('button', { name: /ver todo \(1\)/i }));
    expect(onNavigate).toHaveBeenCalledWith('control', undefined);
  });
});

describe('Dashboard — Meta principal', () => {
  const goal = (id: string, name: string, target: number) => ({ id, user_id: 'user-1', name, target_amount: target, created_at: new Date(), updated_at: new Date() });

  it('is hidden without an active savings goal', async () => {
    mockMovements([]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);
    await screen.findByTestId('hero-balance');
    expect(screen.queryByTestId('primary-goal')).toBeNull();
  });

  it('shows the goal with the most progress, what is missing, and "Aportar" opens the sheet', async () => {
    const user = userEvent.setup();
    const onOpenQuickRecord = vi.fn();
    state.goals = [goal('g1', 'Auto Nuevo', 100000), goal('g2', 'Laptop', 20000)];
    const saving = [movement({ type: 'EXPENSE', amount: 5000, savings_goal_id: 'g2' }), movement({ type: 'EXPENSE', amount: 1000, savings_goal_id: 'g1' })];
    mockMovements([], [], saving);
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" onOpenQuickRecord={onOpenQuickRecord} />);

    const card = await screen.findByTestId('primary-goal');
    expect(card).toHaveTextContent('Meta: Laptop');
    expect(card).toHaveTextContent(/S\/ 50\.00 acumulado/);
    expect(card).toHaveTextContent(/Faltan S\/ 150\.00/);
    expect(card).toHaveTextContent(/Objetivo S\/ 200\.00/);
    expect(card).toHaveTextContent('25%');
    await user.click(within(card).getByRole('button', { name: /aportar/i }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('expense');
  });
});

describe('Dashboard — Mi Progreso', () => {
  it('shows "X de 6 logros" and opens the progress route', async () => {
    const user = userEvent.setup();
    const onOpenProgress = vi.fn();
    state.progress = { items: [{ earned: true }, { earned: true }, { earned: false }], visible: true, loading: false, error: false };
    mockMovements([]);
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" onOpenProgress={onOpenProgress} />);
    const card = await screen.findByRole('button', { name: /mi progreso/i });
    expect(card).toHaveTextContent('2 de 6 logros');
    await user.click(card);
    expect(onOpenProgress).toHaveBeenCalledTimes(1);
  });

  it('is hidden when personal progress is turned off', async () => {
    mockMovements([]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);
    await screen.findByTestId('hero-balance');
    expect(screen.queryByRole('button', { name: /mi progreso/i })).toBeNull();
  });
});

describe('Dashboard — Préstamos activos', () => {
  const loan = (overrides: Row = {}) => ({
    id: 'l1', user_id: 'user-1', lender_name: 'BCP Crédito Personal', amount: 1000000, installment_count: 24, remaining_installments: 21,
    installment_amount: 52000, status: 'active', created_at: new Date(), updated_at: new Date(), ...overrides,
  });

  it('lists the next installment of an active loan and links to the loans tab', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    state.loans = [loan(), loan({ id: 'l2', lender_name: 'Pagado', status: 'settled', remaining_installments: 0 })];
    mockMovements([]);
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" onNavigate={onNavigate} />);

    const row = await screen.findByTestId('loan-l1');
    expect(row).toHaveTextContent('BCP Crédito Personal');
    expect(row).toHaveTextContent('Cuota 04/24');
    expect(row).toHaveTextContent(/S\/\s*520\.00/);
    expect(screen.queryByText('Pagado')).toBeNull();
    expect(screen.queryByText(/no tienes deudas activas/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: /ver préstamos/i }));
    expect(onNavigate).toHaveBeenCalledWith('finances', { financesTab: 'loans' });
  });
});

describe('Dashboard — desktop', () => {
  beforeEach(() => setDesktop(true));

  it('renders the executive header, the four KPI cards and no mobile hero', async () => {
    const user = userEvent.setup();
    const onOpenQuickRecord = vi.fn();
    state.goals = [{ id: 'g1', user_id: 'user-1', name: 'Auto Nuevo', target_amount: 1800000, created_at: new Date(), updated_at: new Date() }];
    mockMovements([movement({ type: 'INCOME', amount: 10000 }), movement({ type: 'EXPENSE', amount: 2500, distribution_category_id: 'b1' })]);
    mockCategories([{ ...baseCategory, id: 'b1', name: 'Necesidades', percentage: 100 }]);
    mockDebts([]);

    render(<Dashboard userId="user-1" onOpenQuickRecord={onOpenQuickRecord} />);

    expect(await screen.findByRole('heading', { name: /resumen ejecutivo/i })).toBeInTheDocument();
    expect(screen.getByText(/terminal de control/i)).toHaveTextContent(/ciclo activo/i);
    expect(screen.queryByTestId('hero-balance')).toBeNull();
    expect(screen.getByTestId('kpi-capital')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-rule')).toHaveTextContent(/S\/\s*25\.00/);
    expect(screen.getByTestId('kpi-rule')).toHaveTextContent(/de S\/ 100\.00/);
    expect(screen.getByTestId('kpi-performance')).toHaveTextContent(/nada programado para hoy/i);
    expect(screen.getByTestId('primary-goal')).toHaveTextContent('Auto Nuevo');
    // savings rate = (100 - 25) / 100 = 75%
    expect(screen.getByTestId('savings-rate')).toHaveTextContent('75%');

    await user.click(screen.getByRole('button', { name: /registrar movimiento/i }));
    await user.click(screen.getByRole('button', { name: /transferir/i }));
    const capital = within(screen.getByTestId('kpi-capital'));
    await user.click(capital.getByRole('button', { name: /ingreso/i }));
    await user.click(capital.getByRole('button', { name: /gasto/i }));
    expect(onOpenQuickRecord.mock.calls.map(call => call[0])).toEqual(['expense', 'transfer', 'income', 'expense']);
  });

  it('shows the behavioral score and the next pending item', async () => {
    state.habits = [habit('h1', 'Leer 20 min')];
    state.completions = { h1: [{ id: 'c1', habit_id: 'h1', date: new Date(), token_used: false }] };
    state.tasks = [taskDueToday('t1', 'Examen UI/UX')];
    mockMovements([]);
    mockCategories();
    mockDebts([]);

    render(<Dashboard userId="user-1" />);

    const kpi = await screen.findByTestId('kpi-performance');
    expect(within(kpi).getByTestId('score-pct')).toHaveTextContent('50%');
    expect(kpi).toHaveTextContent('1/2');
    expect(kpi).toHaveTextContent('Siguiente: Examen UI/UX');
  });

  it('lists recent transactions with a transfer shown neutral and never counted as income or expense', async () => {
    const accounts = [
      { id: 'a', user_id: 'user-1', name: 'BCP Débito', kind: 'debit', opening_balance: 0, created_at: new Date(), updated_at: new Date() },
      { id: 'b', user_id: 'user-1', name: 'Efectivo', kind: 'cash', opening_balance: 0, created_at: new Date(), updated_at: new Date() },
    ];
    state.accounts = accounts;
    const base = Date.now();
    const income = movement({ id: 'inc', type: 'INCOME', amount: 10000, description: 'Nómina', account_id: 'a', date: new Date(base - 3000) });
    const expense = movement({ id: 'exp', type: 'EXPENSE', amount: 2500, description: 'Almuerzo', account_id: 'a', distribution_category_id: 'b1', expense_category_id: 'ec1', date: new Date(base - 2000) });
    const transfer = movement({ id: 'trf', type: 'TRANSFER', amount: 5000, account_id: 'a', to_account_id: 'b', date: new Date(base - 1000) });
    mockMovements([income, expense, transfer]);
    mockCategories(
      [{ ...baseCategory, id: 'b1', name: 'Necesidades', percentage: 100 }],
      [{ ...baseExpenseCategory, id: 'ec1', distribution_category_id: 'b1', name: 'Alimentación' }],
    );
    mockDebts([]);

    render(<Dashboard userId="user-1" />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    // Newest first: the transfer, then the expense, then the income.
    expect(rows[0]).toHaveAttribute('data-kind', 'transfer');
    expect(rows[0]).toHaveTextContent('Transferencia');
    expect(rows[0]).toHaveTextContent('BCP Débito → Efectivo');
    expect(rows[0]).toHaveTextContent(/S\/\s*50\.00/);
    expect(rows[0]).not.toHaveTextContent(/[+−-]\s*S\//);
    expect(rows[1]).toHaveTextContent('Almuerzo');
    expect(rows[1]).toHaveTextContent('Alimentación');
    expect(rows[1]).toHaveTextContent('Necesidades');
    expect(rows[1]).toHaveTextContent(/−S\/\s*25\.00/);
    expect(rows[2]).toHaveTextContent(/\+S\/\s*100\.00/);
    expect(rows[2]).toHaveTextContent(/Hoy, \d{2}:\d{2}/);

    // The cycle totals only see income and expense: 100.00 - 25.00 = 75.00 (the 50.00 transfer is ignored).
    expect(screen.getByTestId('kpi-capital')).toHaveTextContent(/\+S\/\s*75\.00/);
    expect(screen.getByTestId('savings-rate')).toHaveTextContent('75%');
  });

  it('"Ver todo" of the recent transactions goes to Finanzas', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    mockMovements([movement({ type: 'INCOME', amount: 100 })]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" onNavigate={onNavigate} />);
    const panel = await screen.findByTestId('recent-transactions');
    await user.click(within(panel).getByRole('button', { name: /ver todo/i }));
    expect(onNavigate).toHaveBeenCalledWith('finances', undefined);
  });

  it('shows the shared-space balance only when the user has a space', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    state.spaces = [{ id: 's1', name: 'Casa', permission_mode: 'open', status: 'active', created_by: 'user-1' }];
    state.sharedMovements = {
      s1: [{ id: 'sm1', shared_space_id: 's1', created_by: 'user-1', type: 'expense', total_amount_cents: 9000, split_mode: 'fixed_amount',
        splits: [{ user_id: 'user-1', share_cents: 4500 }, { user_id: 'other', share_cents: 4500 }], linked_movement_ids: [], date: new Date() }],
    };
    mockMovements([]);
    mockCategories();
    mockDebts([]);

    const { unmount } = render(<Dashboard userId="user-1" onNavigate={onNavigate} />);
    const card = await screen.findByTestId('shared-space-card');
    expect(card).toHaveTextContent('Casa');
    expect(card).toHaveTextContent(/Te deben/);
    expect(card).toHaveTextContent(/S\/\s*45\.00/);
    await user.click(within(card).getByRole('button', { name: /liquidar saldo/i }));
    expect(onNavigate).toHaveBeenCalledWith('shared-space', undefined);

    unmount();
    state.spaces = [];
    mockMovements([]);
    render(<Dashboard userId="user-1" />);
    await screen.findByTestId('dashboard-desktop');
    expect(screen.queryByTestId('shared-space-card')).toBeNull();
  });

  it('does not render the desktop-only blocks on mobile', async () => {
    setDesktop(false);
    mockMovements([movement({ type: 'INCOME', amount: 100 })]);
    mockCategories();
    mockDebts([]);
    render(<Dashboard userId="user-1" />);
    await screen.findByTestId('hero-balance');
    expect(screen.queryByTestId('recent-transactions')).toBeNull();
    expect(screen.queryByTestId('kpi-capital')).toBeNull();
    expect(screen.queryByRole('heading', { name: /resumen ejecutivo/i })).toBeNull();
  });
});
