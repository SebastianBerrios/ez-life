import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { emitSyncCompleted } from '../../infrastructure/sync/syncEvents';

vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');
vi.mock('../../infrastructure/repositories/local/LocalDebtRepository');
vi.mock('../../infrastructure/repositories/local/LocalIncomeSourceRepository', () => ({
  LocalIncomeSourceRepository: vi.fn(function () { return { getAll: vi.fn().mockResolvedValue([{ id: 'salary', amount: 10000 }]) }; }),
}));

// Dashboard fetches the current cycle AND the previous cycle (FR-003) — this
// mock picks which array to return based on the requested cycle's month, so
// tests can control current vs. previous period data independently.
function mockMovements(current: unknown[], previous: unknown[] = []) {
  const todayMonth = new Date().getMonth();
  const getAllByCycle = vi.fn((_userId: string, start: Date) =>
    Promise.resolve(start.getMonth() === todayMonth ? current : previous)
  );
  vi.mocked(LocalMovementRepository).mockImplementation(function () {
    return { getAllByCycle } as unknown as InstanceType<typeof LocalMovementRepository>;
  });
  return { getAllByCycle };
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
    id: `m-${Math.random()}`, user_id: 'user-1', type: 'EXPENSE', amount: 0, date: new Date(),
    is_recurring: false, created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

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

    expect(await screen.findByText(/deudas activas/i)).toBeInTheDocument();
    expect(await screen.findByText(/juan/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/60\.00/)).toBeInTheDocument(); // remaining balance, S/60.00
    });
  });

  it('shows a friendly message when there are no active debts', async () => {
    mockMovements([]);
    mockCategories([]);
    mockDebts([]);

    render(<Dashboard userId="user-1" />);

    expect(await screen.findByText(/no ten[eé]s deudas activas/i)).toBeInTheDocument();
  });

  it('reloads local data when a sync cycle completes (e.g. a movement pulled from another device)', async () => {
    const { getAllByCycle } = mockMovements([]);
    mockCategories([]);
    mockDebts([]);

    render(<Dashboard userId="user-1" />);
    // One call for the current cycle, one for the previous cycle (FR-003).
    await waitFor(() => expect(getAllByCycle).toHaveBeenCalledTimes(2));

    act(() => {
      emitSyncCompleted();
    });

    await waitFor(() => expect(getAllByCycle).toHaveBeenCalledTimes(4));
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
    });
  });

  describe('category breakdown chart (FR-002, T006)', () => {
    it('renders a chart of spending distribution by category', async () => {
      mockMovements([
        movement({ type: 'INCOME', amount: 10000 }),
        movement({ type: 'EXPENSE', amount: 6000, distribution_category_id: 'over-cat', expense_category_id: 'ec-over' }),
      ]);
      mockCategories(
        [{ ...baseCategory, id: 'over-cat', name: 'Esenciales', percentage: 50 }],
        [{ ...baseExpenseCategory, id: 'ec-over', distribution_category_id: 'over-cat', name: 'Comida' }]
      );
      mockDebts([]);

      render(<Dashboard userId="user-1" />);

      expect(await screen.findByTestId('category-breakdown-chart')).toBeInTheDocument();
    });

    it('shows a friendly empty state when there is nothing categorized to chart yet', async () => {
      mockMovements([movement({ type: 'INCOME', amount: 10000 })]);
      mockCategories([{ ...baseCategory, id: 'over-cat', name: 'Esenciales', percentage: 50 }]);
      mockDebts([]);

      render(<Dashboard userId="user-1" />);

      expect(await screen.findByText(/no hay gastos categorizados/i)).toBeInTheDocument();
    });
  });

  describe('period comparison (FR-003, T007)', () => {
    it('renders the current-vs-previous-period comparison when previous period data exists', async () => {
      mockMovements(
        [
          movement({ type: 'INCOME', amount: 10000 }),
          movement({ type: 'EXPENSE', amount: 6000, distribution_category_id: 'over-cat', expense_category_id: 'ec-over' }),
        ],
        [
          movement({ type: 'INCOME', amount: 8000 }),
          movement({ type: 'EXPENSE', amount: 3000 }),
        ]
      );
      mockCategories(
        [{ ...baseCategory, id: 'over-cat', name: 'Esenciales', percentage: 50 }],
        [{ ...baseExpenseCategory, id: 'ec-over', distribution_category_id: 'over-cat', name: 'Comida' }]
      );
      mockDebts([]);

      render(<Dashboard userId="user-1" />);

      const comparison = await screen.findByTestId('period-comparison');
      // income delta: 10000 - 8000 = +2000 cents = +S/20.00
      expect(comparison).toHaveTextContent(/\+\s*S\/\s*20\.00/);
    });

    it('shows a clear message instead of a broken comparison when there is no previous-period data', async () => {
      mockMovements([movement({ type: 'INCOME', amount: 10000 })], []);
      mockCategories([{ ...baseCategory, id: 'over-cat', name: 'Esenciales', percentage: 50 }]);
      mockDebts([]);

      render(<Dashboard userId="user-1" />);

      expect(await screen.findByText(/no hay datos del mes anterior/i)).toBeInTheDocument();
    });
  });
});
