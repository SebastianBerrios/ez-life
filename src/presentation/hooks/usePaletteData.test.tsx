import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { db } from '../../infrastructure/db/db';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { usePaletteData } from './usePaletteData';

const U = 'A';

async function seed() {
  const categories = new LocalCategoryRepository();
  await categories.saveDistributionSet(U, [{ id: 'bucket', user_id: U, name: 'Necesidades', percentage: 100, is_default: true, is_savings: true }]);
  await categories.saveExpenseCategory({ id: 'category', user_id: U, name: 'Alimentación', distribution_category_id: 'bucket' }, ['General']);
  const account = await new LocalPaymentAccountRepository().save({ id: '', user_id: U, name: 'BCP Débito', kind: 'debit', opening_balance: 0 });
  await new LocalMovementRepository().save({
    id: '', user_id: U, type: 'EXPENSE', amount: 1250, date: new Date(), description: 'Almuerzo', distribution_category_id: 'bucket',
    expense_category_id: 'category', account_id: account.id, is_recurring: false,
  });
  await new LocalTaskRepository().save({ id: '', user_id: U, title: 'Llamar al banco', due_date: new Date(), status: 'pending' });
  await new LocalHabitRepository().save({ id: '', user_id: U, name: 'Meditación', schedule_mode: 'frequency', frequency_target: 3 });
  await new LocalGoalRepository().save({ id: '', user_id: U, name: 'Correr 10K', kind: 'numeric', target_value: 10, current_value: 0, status: 'active' });
  await new LocalSavingsGoalRepository().save({ id: '', user_id: U, name: 'Viaje a Cusco', target_amount: 300000 });
}

beforeEach(async () => { await db.delete(); await db.open(); });

describe('usePaletteData', () => {
  it('indexes the real local data of the user, with names resolved', async () => {
    await seed();
    const { result } = renderHook(() => usePaletteData(U, true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const byKind = (kind: string) => result.current.index.filter(entry => entry.kind === kind).map(entry => entry.title);
    expect(byKind('movement')).toEqual(['Almuerzo']);
    expect(byKind('task')).toEqual(['Llamar al banco']);
    expect(byKind('habit')).toEqual(['Meditación']);
    expect(byKind('goal')).toEqual(['Correr 10K']);
    expect(byKind('savings-goal')).toEqual(['Viaje a Cusco']);
    expect(byKind('account')).toContain('BCP Débito');
    const movement = result.current.index.find(entry => entry.kind === 'movement')!;
    expect(movement.subtitle).toContain('Alimentación');
    expect(movement.haystacks).toContain('bcp debito');
  });

  it('only shows "Mi Progreso" when gamification is visible', async () => {
    const { result, rerender } = renderHook(({ visible }) => usePaletteData(U, visible), { initialProps: { visible: false } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.index.some(entry => entry.title === 'Mi Progreso')).toBe(false);
    rerender({ visible: true });
    expect(result.current.index.some(entry => entry.title === 'Mi Progreso')).toBe(true);
  });

  it('ignores the data of other users', async () => {
    await seed();
    const { result } = renderHook(() => usePaletteData('B', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.index.filter(entry => entry.kind === 'task' || entry.kind === 'movement')).toEqual([]);
  });

  it('refreshes while mounted when something changes locally', async () => {
    await seed();
    const { result } = renderHook(() => usePaletteData(U, true));
    await waitFor(() => expect(result.current.index.some(entry => entry.title === 'Llamar al banco')).toBe(true));

    await act(async () => {
      await new LocalTaskRepository().save({ id: '', user_id: U, title: 'Renovar seguro', due_date: new Date(), status: 'pending' });
    });
    await waitFor(() => expect(result.current.index.some(entry => entry.title === 'Renovar seguro')).toBe(true));
  });
});
