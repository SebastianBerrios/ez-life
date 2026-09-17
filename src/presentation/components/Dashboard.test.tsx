import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';

vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');
vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');
vi.mock('../../infrastructure/repositories/local/LocalDebtRepository');

describe('Dashboard', () => {
  it('shows active debts alongside the existing budget-vs-actual view (FR-025)', async () => {
    vi.mocked(LocalMovementRepository).mockImplementation(function () {
      return { getAllByCycle: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalMovementRepository>;
    });
    vi.mocked(LocalCategoryRepository).mockImplementation(function () {
      return { getDistributionCategories: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalCategoryRepository>;
    });
    vi.mocked(LocalDebtRepository).mockImplementation(function () {
      return {
        getAll: vi.fn().mockResolvedValue([
          {
            id: 'debt-1', user_id: 'user-1', counterparty_name: 'Juan', direction: 'lent', origin: 'manual',
            amount: 10000, settled_amount: 4000, created_at: new Date(), updated_at: new Date(),
          },
        ]),
      } as unknown as InstanceType<typeof LocalDebtRepository>;
    });

    render(<Dashboard userId="user-1" />);

    expect(await screen.findByText(/deudas activas/i)).toBeInTheDocument();
    expect(await screen.findByText(/juan/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/60\.00/)).toBeInTheDocument(); // remaining balance, S/60.00
    });
  });

  it('shows a friendly message when there are no active debts', async () => {
    vi.mocked(LocalMovementRepository).mockImplementation(function () {
      return { getAllByCycle: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalMovementRepository>;
    });
    vi.mocked(LocalCategoryRepository).mockImplementation(function () {
      return { getDistributionCategories: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalCategoryRepository>;
    });
    vi.mocked(LocalDebtRepository).mockImplementation(function () {
      return { getAll: vi.fn().mockResolvedValue([]) } as unknown as InstanceType<typeof LocalDebtRepository>;
    });

    render(<Dashboard userId="user-1" />);

    expect(await screen.findByText(/no ten[eé]s deudas activas/i)).toBeInTheDocument();
  });
});
