import { describe, expect, it } from 'vitest';
import { buildPaletteIndex } from './buildPaletteIndex';
import {
  PALETTE_TODAY, paletteAccounts, paletteGoals, paletteHabits, paletteLookups, paletteMovements, paletteSavingsGoals, paletteTasks,
} from './paletteFixtures';

const full = () => buildPaletteIndex({
  movements: paletteMovements, lookups: paletteLookups, tasks: paletteTasks, habits: paletteHabits, goals: paletteGoals,
  savingsGoals: paletteSavingsGoals, accounts: paletteAccounts, today: PALETTE_TODAY,
});

describe('buildPaletteIndex', () => {
  it('always offers the actions and routes, even with no data', () => {
    const index = buildPaletteIndex({ today: PALETTE_TODAY });
    expect(index.filter(e => e.kind === 'action').map(e => e.title)).toEqual([
      'Nuevo gasto', 'Nuevo ingreso', 'Transferir', 'Nuevo hábito', 'Nueva tarea', 'Nueva meta', 'Nueva meta de ahorro', 'Cambiar tema',
    ]);
    expect(index.filter(e => e.kind === 'route').map(e => e.title)).toContain('Ajustes');
    expect(index.some(e => e.kind === 'movement' || e.kind === 'task' || e.kind === 'habit')).toBe(false);
  });

  it('hides "Mi Progreso" when gamification is off and shows it otherwise', () => {
    const titles = (visible?: boolean) => buildPaletteIndex({ today: PALETTE_TODAY, gamificationVisible: visible }).filter(e => e.kind === 'route').map(e => e.title);
    expect(titles(false)).not.toContain('Mi Progreso');
    expect(titles(true)).toContain('Mi Progreso');
    expect(titles()).toContain('Mi Progreso');
  });

  it('offers the Finanzas sections as routes with their tab', () => {
    const routes = full().filter(e => e.kind === 'route').map(e => e.payload);
    expect(routes).toContainEqual({ type: 'route', route: 'finances', financesTab: 'budget' });
    expect(routes).toContainEqual({ type: 'route', route: 'finances', financesTab: 'loans' });
    expect(routes).toContainEqual({ type: 'route', route: 'dashboard' });
  });

  it('lists movements newest first with a readable subtitle and the real amount', () => {
    const movements = full().filter(e => e.kind === 'movement');
    expect(movements.map(e => e.id)).toEqual(['movement:m-new', 'movement:m-transfer', 'movement:m-income', 'movement:m-old']);
    const newest = movements[0];
    expect(newest.title).toBe('Transporte');
    expect(newest.subtitle).toBe('Hoy, 10:30 · Transporte');
    expect(newest.amount).toBe(899);
    expect(newest.movementKind).toBe('expense');
    expect(movements[1].subtitle).toBe('10 oct, 18:00 · Efectivo → BCP Débito');
    expect(movements[1].movementKind).toBe('transfer');
  });

  it('stores normalized haystacks, including the amount in both forms', () => {
    const income = full().find(e => e.id === 'movement:m-income')!;
    expect(income.haystacks).toContain('3,000.00');
    expect(income.haystacks).toContain('3000.00');
    expect(income.haystacks.every(h => h === h.toLowerCase())).toBe(true);
    const lunch = full().find(e => e.id === 'movement:m-old')!;
    expect(lunch.haystacks).toContain('alimentacion');
  });

  it('orders tasks by due date with done tasks last and describes the due day', () => {
    const tasks = full().filter(e => e.kind === 'task');
    expect(tasks.map(e => e.title)).toEqual(['Llamar al banco', 'Renovar seguro', 'Pagar luz']);
    expect(tasks[0].subtitle).toBe('Hoy');
    expect(tasks[1].subtitle).toBe('Vence 28 oct · Hogar');
    expect(tasks[2].subtitle).toBe('Vencía 12 oct');
  });

  it('describes habits, goals, savings goals and accounts from real data only', () => {
    const index = full();
    expect(index.find(e => e.id === 'habit:h1')!.subtitle).toBe('Lun · Mié · Vie');
    expect(index.find(e => e.id === 'habit:h2')!.subtitle).toBe('3 veces por semana');
    expect(index.find(e => e.id === 'goal:g1')!.subtitle).toBe('4 de 10');
    expect(index.find(e => e.id === 'goal:g2')!.subtitle).toBe('1 de 2 hitos');
    expect(index.find(e => e.id === 'savings-goal:sg1')!.subtitle).toBe('Meta S/ 3,000.00');
    expect(index.find(e => e.id === 'account:a1')!.subtitle).toBe('Débito');
  });

  it('marks archived accounts and completed goals', () => {
    const index = buildPaletteIndex({
      today: PALETTE_TODAY,
      accounts: [{ ...paletteAccounts[0], archived: true }],
      goals: [{ ...paletteGoals[0], status: 'completed' }],
    });
    expect(index.find(e => e.kind === 'account')!.subtitle).toBe('Débito · Archivada');
    expect(index.find(e => e.kind === 'goal')!.subtitle).toBe('Completada');
  });

  it('keeps payloads that carry only ids (no copies of the entities)', () => {
    const payloads = full().map(e => e.payload);
    expect(payloads).toContainEqual({ type: 'task', id: 't-today' });
    expect(payloads).toContainEqual({ type: 'habit', id: 'h1' });
    expect(payloads).toContainEqual({ type: 'savings-goal', id: 'sg1' });
    expect(payloads).toContainEqual({ type: 'movement', id: 'm-new', date: paletteMovements[2].date });
  });
});
