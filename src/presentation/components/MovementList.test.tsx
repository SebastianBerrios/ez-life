import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MovementList from './MovementList';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';

vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');

function mockRepo(movements: unknown[] = []) {
  const mockGetAllByCycle = vi.fn().mockResolvedValue(movements);
  vi.mocked(LocalMovementRepository).mockImplementation(function () {
    return { getAllByCycle: mockGetAllByCycle, delete: vi.fn() } as unknown as InstanceType<typeof LocalMovementRepository>;
  });
  return { mockGetAllByCycle };
}

function mockCategories(
  expenseCategories: unknown[] = [],
  subcategoriesByCategory: Record<string, unknown[]> = {}
) {
  vi.mocked(LocalCategoryRepository).mockImplementation(function () {
    return {
      getExpenseCategories: vi.fn().mockResolvedValue(expenseCategories),
      getSubcategories: vi.fn((categoryId: string) => Promise.resolve(subcategoriesByCategory[categoryId] ?? [])),
    } as unknown as InstanceType<typeof LocalCategoryRepository>;
  });
}

// Simulates the parent (MainFlow) pattern already proven for SavingsGoal:
// bumping a `key` prop remounts the list, forcing a fresh fetch (FR-002).
function Wrapper() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div>
      <button onClick={() => setRefreshKey(k => k + 1)}>bump</button>
      <MovementList key={refreshKey} userId="u1" />
    </div>
  );
}

describe('MovementList', () => {
  it('shows movements for the current cycle', async () => {
    mockRepo([
      { id: 'm1', user_id: 'u1', type: 'EXPENSE', amount: 1000, date: new Date(), description: 'Café', is_recurring: false, created_at: new Date(), updated_at: new Date() },
    ]);
    mockCategories([]);

    render(<MovementList userId="u1" />);

    expect(await screen.findByText('Café')).toBeInTheDocument();
  });

  it('refetches when its `key` prop changes — the refresh-by-key pattern MainFlow relies on (FR-002)', async () => {
    const user = userEvent.setup();
    const { mockGetAllByCycle } = mockRepo([]);
    mockCategories([]);

    render(<Wrapper />);

    await screen.findByText(/no hay movimientos/i);
    expect(mockGetAllByCycle).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('bump'));

    await screen.findByText(/no hay movimientos/i);
    expect(mockGetAllByCycle).toHaveBeenCalledTimes(2);
  });

  describe('category/subcategory visibility (FR-007, FR-008, US3)', () => {
    it('shows a movement\'s resolved category and subcategory name directly in the list', async () => {
      mockRepo([
        {
          id: 'm1', user_id: 'u1', type: 'EXPENSE', amount: 1000, date: new Date(), description: 'Almuerzo',
          expense_category_id: 'ec1', expense_subcategory_id: 'sub1',
          is_recurring: false, created_at: new Date(), updated_at: new Date(),
        },
      ]);
      mockCategories(
        [{ id: 'ec1', user_id: 'u1', distribution_category_id: 'dc1', name: 'Comida', created_at: new Date(), updated_at: new Date() }],
        { ec1: [{ id: 'sub1', category_id: 'ec1', name: 'Restaurantes', created_at: new Date(), updated_at: new Date() }] }
      );

      render(<MovementList userId="u1" />);

      expect(await screen.findByText('Almuerzo')).toBeInTheDocument();
      expect(screen.getByText(/comida/i)).toBeInTheDocument();
      expect(screen.getByText(/restaurantes/i)).toBeInTheDocument();
    });

    it('shows "Sin categoría" for a movement without a category', async () => {
      mockRepo([
        { id: 'm1', user_id: 'u1', type: 'EXPENSE', amount: 500, date: new Date(), description: 'Varios', is_recurring: false, created_at: new Date(), updated_at: new Date() },
      ]);
      mockCategories([]);

      render(<MovementList userId="u1" />);

      expect(await screen.findByText('Varios')).toBeInTheDocument();
      expect(screen.getByText(/sin categor[ií]a/i)).toBeInTheDocument();
    });
  });

  describe('balance adjustment badge (006-ajuste-de-balance-mensual)', () => {
    it('shows the "Ajuste" badge for a manual balance adjustment', async () => {
      mockRepo([
        {
          id: 'm1', user_id: 'u1', type: 'INCOME', amount: 5000, date: new Date(), description: 'Bono',
          is_adjustment: true, is_recurring: false, created_at: new Date(), updated_at: new Date(),
        },
      ]);
      mockCategories([]);

      render(<MovementList userId="u1" />);

      expect(await screen.findByText('Bono')).toBeInTheDocument();
      expect(screen.getByText('Ajuste')).toBeInTheDocument();
    });

    it('does not show the "Ajuste" badge for a regular movement', async () => {
      mockRepo([
        { id: 'm1', user_id: 'u1', type: 'EXPENSE', amount: 1000, date: new Date(), description: 'Café', is_recurring: false, created_at: new Date(), updated_at: new Date() },
      ]);
      mockCategories([]);

      render(<MovementList userId="u1" />);

      expect(await screen.findByText('Café')).toBeInTheDocument();
      expect(screen.queryByText('Ajuste')).not.toBeInTheDocument();
    });
  });
});
