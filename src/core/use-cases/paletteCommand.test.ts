import { describe, expect, it } from 'vitest';
import { buildPaletteIndex } from './buildPaletteIndex';
import { paletteCommand } from './paletteCommand';
import {
  PALETTE_TODAY, paletteAccounts, paletteGoals, paletteHabits, paletteLookups, paletteMovements, paletteSavingsGoals, paletteTasks,
} from './paletteFixtures';

const index = buildPaletteIndex({
  movements: paletteMovements, lookups: paletteLookups, tasks: paletteTasks, habits: paletteHabits, goals: paletteGoals,
  savingsGoals: paletteSavingsGoals, accounts: paletteAccounts, today: PALETTE_TODAY,
});
const command = (id: string) => paletteCommand(index.find(e => e.id === id)!);

describe('paletteCommand', () => {
  it('maps every creation action to the quick-record sheet tab and sub-form', () => {
    expect(command('action:new-expense')).toEqual({ type: 'quick-record', tab: 'expense' });
    expect(command('action:new-income')).toEqual({ type: 'quick-record', tab: 'income' });
    expect(command('action:transfer')).toEqual({ type: 'quick-record', tab: 'transfer' });
    expect(command('action:new-habit')).toEqual({ type: 'quick-record', tab: 'habit', kind: 'habit' });
    expect(command('action:new-task')).toEqual({ type: 'quick-record', tab: 'habit', kind: 'task' });
    expect(command('action:new-goal')).toEqual({ type: 'quick-record', tab: 'goal', kind: 'goal' });
    expect(command('action:new-savings-goal')).toEqual({ type: 'quick-record', tab: 'goal', kind: 'savings-goal' });
    expect(command('action:toggle-theme')).toEqual({ type: 'toggle-theme' });
  });

  it('navigates routes, carrying the Finanzas tab', () => {
    expect(command('route:settings')).toEqual({ type: 'navigate', route: 'settings', options: undefined });
    expect(command('route:finances:loans')).toEqual({ type: 'navigate', route: 'finances', options: { financesTab: 'loans' } });
  });

  it('sends a movement to Finanzas > Movimientos with focus and its date', () => {
    expect(command('movement:m-old')).toEqual({
      type: 'navigate', route: 'finances',
      options: { financesTab: 'movements', focus: { kind: 'movement', id: 'm-old', date: paletteMovements[0].date } },
    });
  });

  it('sends tasks, habits, goals and savings goals to Control with focus', () => {
    expect(command('task:t-today')).toEqual({ type: 'navigate', route: 'control', options: { focus: { kind: 'task', id: 't-today' } } });
    expect(command('habit:h1')).toEqual({ type: 'navigate', route: 'control', options: { focus: { kind: 'habit', id: 'h1' } } });
    expect(command('goal:g1')).toEqual({ type: 'navigate', route: 'control', options: { focus: { kind: 'goal', id: 'g1' } } });
    expect(command('savings-goal:sg1')).toEqual({ type: 'navigate', route: 'control', options: { focus: { kind: 'savings-goal', id: 'sg1' } } });
  });

  it('sends an account to Ajustes', () => {
    expect(command('account:a1')).toEqual({ type: 'navigate', route: 'settings', options: { focus: { kind: 'account', id: 'a1' } } });
  });
});
