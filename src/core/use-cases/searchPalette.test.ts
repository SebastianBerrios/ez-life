import { describe, expect, it } from 'vitest';
import { buildPaletteIndex, type PaletteEntry } from './buildPaletteIndex';
import { flattenPalette, searchPalette } from './searchPalette';
import { normalizeText } from './searchText';
import {
  PALETTE_TODAY, paletteAccounts, paletteGoals, paletteHabits, paletteLookups, paletteMovements, paletteSavingsGoals, paletteTasks,
} from './paletteFixtures';

const index = buildPaletteIndex({
  movements: paletteMovements, lookups: paletteLookups, tasks: paletteTasks, habits: paletteHabits, goals: paletteGoals,
  savingsGoals: paletteSavingsGoals, accounts: paletteAccounts, today: PALETTE_TODAY,
});
const titles = (query: string, options?: Parameters<typeof searchPalette>[2]) => flattenPalette(searchPalette(index, query, options)).map(e => e.title);

function entry(kind: PaletteEntry['kind'], id: string, title: string): PaletteEntry {
  return { id: `${kind}:${id}`, kind, title, subtitle: '', haystacks: [normalizeText(title)], payload: { type: 'habit', id } };
}

describe('searchPalette', () => {
  it('shows actions, routes and the most recent movements for an empty query', () => {
    const groups = searchPalette(index, '');
    expect(groups.map(g => g.label)).toEqual(['Acciones', 'Ir a', 'Movimientos']);
    expect(groups[0].entries).toHaveLength(8);
    expect(groups[2].entries.map(e => e.id)).toEqual(['movement:m-new', 'movement:m-transfer', 'movement:m-income', 'movement:m-old']);
    expect(searchPalette(index, '   ').map(g => g.kind)).toEqual(['action', 'route', 'movement']);
  });

  it('caps the recent movements of an empty query', () => {
    const many = Array.from({ length: 9 }, (_, i) => entry('movement', String(i), `M${i}`));
    expect(searchPalette(many, '')[0].entries).toHaveLength(5);
    expect(searchPalette(many, '', { emptyMovements: 2 })[0].entries).toHaveLength(2);
  });

  it('ignores case and accents in both directions', () => {
    expect(titles('ALIMENTACION')).toContain('Almuerzo');
    expect(titles('alimentación')).toContain('Almuerzo');
    expect(titles('meditacion')).toEqual(['Meditación']);
    expect(titles('HABITO')).toContain('Nuevo hábito');
  });

  it('requires every term, in any haystack', () => {
    expect(titles('almuerzo bcp')).toEqual(['Almuerzo']);
    expect(titles('almuerzo efectivo')).toEqual([]);
  });

  it('finds movements by amount with or without the thousands separator', () => {
    expect(titles('3000')).toEqual(['Sueldo octubre', 'Viaje a Cusco']);
    expect(titles('3,000')).toEqual(['Sueldo octubre', 'Viaje a Cusco']);
    expect(titles('3000.00')).toContain('Sueldo octubre');
    expect(titles('12.50')).toEqual(['Almuerzo']);
  });

  it('orders the groups: acciones, ir a, movimientos, tareas, hábitos, metas, metas de ahorro, cuentas', () => {
    const everything = [
      entry('account', 'a', 'Cuenta x'), entry('savings-goal', 's', 'Ahorro x'), entry('goal', 'g', 'Meta x'),
      entry('habit', 'h', 'Habito x'), entry('task', 't', 'Tarea x'), entry('movement', 'm', 'Mov x'),
      entry('route', 'r', 'Ruta x'), entry('action', 'a', 'Accion x'),
    ];
    expect(searchPalette(everything, 'x').map(g => g.label)).toEqual([
      'Acciones', 'Ir a', 'Movimientos', 'Tareas', 'Hábitos', 'Metas', 'Metas de ahorro', 'Cuentas',
    ]);
  });

  it('ranks prefix and word-start matches before substring matches, keeping index order on ties', () => {
    const entries = ['Compra de pan', 'Japan trip', 'Pan dulce', 'Panadería Lima'].map((title, i) => entry('task', String(i), title));
    expect(flattenPalette(searchPalette(entries, 'pan')).map(e => e.title)).toEqual(['Pan dulce', 'Panadería Lima', 'Compra de pan', 'Japan trip']);
  });

  it('caps each group for a non-empty query (default 5, configurable)', () => {
    const entries = Array.from({ length: 12 }, (_, i) => entry('habit', String(i), `Hábito ${i}`));
    expect(searchPalette(entries, 'habito')[0].entries).toHaveLength(5);
    expect(searchPalette(entries, 'habito', { perGroup: 3 })[0].entries.map(e => e.title)).toEqual(['Hábito 0', 'Hábito 1', 'Hábito 2']);
  });

  it('drops empty groups and returns nothing when nothing matches', () => {
    expect(searchPalette(index, 'zzzz')).toEqual([]);
    expect(searchPalette(index, 'meditacion').map(g => g.label)).toEqual(['Hábitos']);
  });

  it('finds routes by their sub-section and synonyms', () => {
    expect(titles('presupuesto')).toContain('Regla 50/30/20');
    expect(titles('deudas')).toContain('Préstamos');
    expect(titles('configuracion')).toContain('Ajustes');
  });

  it('does not offer Mi Progreso when the index was built without it', () => {
    const hidden = buildPaletteIndex({ today: PALETTE_TODAY, gamificationVisible: false });
    expect(flattenPalette(searchPalette(hidden, 'progreso'))).toEqual([]);
    expect(flattenPalette(searchPalette(index, 'progreso')).map(e => e.title)).toContain('Mi Progreso');
  });
});
