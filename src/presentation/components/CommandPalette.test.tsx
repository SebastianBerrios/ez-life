import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommandPalette from './CommandPalette';

const { setTheme, themeState } = vi.hoisted(() => ({ setTheme: vi.fn(), themeState: { theme: 'dark' } }));

vi.mock('next-themes', () => ({ useTheme: () => ({ theme: themeState.theme, setTheme }) }));

vi.mock('../hooks/usePaletteData', async () => {
  const { buildPaletteIndex } = await import('../../core/use-cases/buildPaletteIndex');
  const f = await import('../../core/use-cases/paletteFixtures');
  return {
    usePaletteData: (_userId: string, gamificationVisible: boolean) => ({
      loading: false,
      index: buildPaletteIndex({
        movements: f.paletteMovements, lookups: f.paletteLookups, tasks: f.paletteTasks, habits: f.paletteHabits, goals: f.paletteGoals,
        savingsGoals: f.paletteSavingsGoals, accounts: f.paletteAccounts, today: f.PALETTE_TODAY, gamificationVisible,
      }),
    }),
  };
});

const handlers = { onNavigate: vi.fn(), onOpenQuickRecord: vi.fn(), onOpenChange: vi.fn() };

function Host({ initiallyOpen = true, gamificationVisible = true }: { initiallyOpen?: boolean; gamificationVisible?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir-paleta</button>
      <CommandPalette
        open={open}
        onOpenChange={next => { handlers.onOpenChange(next); setOpen(next); }}
        userId="u"
        gamificationVisible={gamificationVisible}
        onNavigate={handlers.onNavigate}
        onOpenQuickRecord={handlers.onOpenQuickRecord}
      />
    </>
  );
}

const combobox = () => screen.getByRole('combobox', { name: 'Buscar en ez-life' });
const optionTitles = () => screen.getAllByRole('option').map(option => within(option).getAllByText(/./)[0].textContent);

beforeEach(() => {
  vi.clearAllMocks();
  themeState.theme = 'dark';
});

describe('CommandPalette', () => {
  it('renders nothing while closed', () => {
    render(<Host initiallyOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('opens as a labelled dialog with the search field focused and the default groups', async () => {
    render(<Host />);
    const dialog = await screen.findByRole('dialog', { name: 'Paleta de comandos' });
    expect(dialog).toHaveAttribute('data-command-palette');
    expect(combobox()).toHaveFocus();
    expect(within(dialog).getByRole('group', { name: 'Acciones' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Ir a' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Movimientos' })).toBeInTheDocument();
    // Empty query: no tasks/habits/goals, only the recent movements.
    expect(within(dialog).queryByRole('group', { name: 'Tareas' })).not.toBeInTheDocument();
  });

  it('wires the combobox and the listbox for assistive technology', async () => {
    render(<Host />);
    await screen.findByRole('dialog');
    const input = combobox();
    const listbox = screen.getByRole('listbox', { name: 'Resultados' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    const [first, second] = screen.getAllByRole('option');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
  });

  it('announces the number of results politely', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    await user.type(combobox(), 'meditacion');
    expect(status).toHaveTextContent('1 resultado');
    await user.clear(combobox());
    await user.type(combobox(), 'a');
    expect(status.textContent).toMatch(/^\d+ resultados?$/);
    await user.clear(combobox());
    await user.type(combobox(), 'zzzz');
    expect(status).toHaveTextContent('Sin resultados');
  });

  it('filters by text ignoring case and accents, grouping the hits', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    await user.type(combobox(), 'ALIMENTACION');
    expect(optionTitles()).toEqual(['Almuerzo']);
    await user.clear(combobox());
    await user.type(combobox(), 'meditación');
    expect(screen.getByRole('group', { name: 'Hábitos' })).toBeInTheDocument();
    expect(optionTitles()).toEqual(['Meditación']);
  });

  it('finds a movement by its amount', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    await user.type(combobox(), '3000');
    expect(within(screen.getByRole('group', { name: 'Movimientos' })).getByText('Sueldo octubre')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Movimientos' })).toHaveTextContent(/\+S\/\s?3,000\.00/);
  });

  it('shows an empty state with the query when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    await user.type(combobox(), 'zzzz');
    expect(screen.getByText('Sin resultados para «zzzz».')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(combobox()).not.toHaveAttribute('aria-activedescendant');
  });

  it('moves the highlight with the arrow keys, wrapping around, and with Home/End', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    const options = () => screen.getAllByRole('option');
    const selectedIndex = () => options().findIndex(option => option.getAttribute('aria-selected') === 'true');

    await user.keyboard('{ArrowDown}');
    expect(selectedIndex()).toBe(1);
    expect(combobox()).toHaveAttribute('aria-activedescendant', options()[1].id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(selectedIndex()).toBe(options().length - 1);
    await user.keyboard('{ArrowDown}');
    expect(selectedIndex()).toBe(0);
    await user.keyboard('{End}');
    expect(selectedIndex()).toBe(options().length - 1);
    await user.keyboard('{Home}');
    expect(selectedIndex()).toBe(0);
    expect(combobox()).toHaveFocus();
  });

  it('highlights the option under the mouse', async () => {
    render(<Host />);
    await screen.findByRole('dialog');
    const options = screen.getAllByRole('option');
    fireEvent.mouseMove(options[3]);
    expect(options[3]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('resets the highlight to the first result when the query changes', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.type(combobox(), 'nuevo');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('activates the highlighted option with Enter and closes', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    await user.type(combobox(), 'nuevo gasto{Enter}');
    expect(handlers.onOpenQuickRecord).toHaveBeenCalledWith('expense', undefined);
    expect(handlers.onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('ignores Enter while an IME composition is active', async () => {
    render(<Host />);
    await screen.findByRole('dialog');
    fireEvent.keyDown(combobox(), { key: 'Enter', isComposing: true });
    expect(handlers.onOpenQuickRecord).not.toHaveBeenCalled();
    expect(handlers.onNavigate).not.toHaveBeenCalled();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns focus to the element that opened it when closed with Escape', async () => {
    const user = userEvent.setup();
    render(<Host initiallyOpen={false} />);
    const trigger = screen.getByRole('button', { name: 'abrir-paleta' });
    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('starts empty every time it opens', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await screen.findByRole('dialog');
    await user.type(combobox(), 'medit');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'abrir-paleta' }));
    await screen.findByRole('dialog');
    expect(combobox()).toHaveValue('');
  });

  it('shows the keyboard hints', async () => {
    render(<Host />);
    await screen.findByRole('dialog');
    expect(screen.getByText('navegar')).toBeInTheDocument();
    expect(screen.getByText('abrir')).toBeInTheDocument();
    expect(screen.getByText('cerrar')).toBeInTheDocument();
  });

  describe('navigation per kind', () => {
    const cases: Array<[string, string, string, unknown[]]> = [
      ['route', 'ajustes', 'palette-option-route:settings', ['settings', undefined]],
      ['route with a Finanzas tab', 'prestamos', 'palette-option-route:finances:loans', ['finances', { financesTab: 'loans' }]],
      ['movement', 'almuerzo', 'palette-option-movement:m-old', ['finances', { financesTab: 'movements', focus: { kind: 'movement', id: 'm-old', date: new Date(2026, 9, 1, 9, 0) } }]],
      ['task', 'llamar', 'palette-option-task:t-today', ['control', { focus: { kind: 'task', id: 't-today' } }]],
      ['habit', 'meditacion', 'palette-option-habit:h1', ['control', { focus: { kind: 'habit', id: 'h1' } }]],
      ['goal', 'correr', 'palette-option-goal:g1', ['control', { focus: { kind: 'goal', id: 'g1' } }]],
      ['savings goal', 'cusco', 'palette-option-savings-goal:sg1', ['control', { focus: { kind: 'savings-goal', id: 'sg1' } }]],
      ['account', 'bcp', 'palette-option-account:a1', ['settings', { focus: { kind: 'account', id: 'a1' } }]],
    ];

    it.each(cases)('%s: clicking navigates and closes', async (_label, query, testId, expected) => {
      const user = userEvent.setup();
      render(<Host />);
      await screen.findByRole('dialog');
      await user.type(combobox(), query);
      await user.click(screen.getByTestId(testId));
      expect(handlers.onNavigate).toHaveBeenCalledWith(...expected);
      expect(handlers.onOpenChange).toHaveBeenLastCalledWith(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('actions', () => {
    const actions: Array<[string, string, unknown[]]> = [
      ['Nuevo ingreso', 'nuevo ingreso', ['income', undefined]],
      ['Transferir', 'transferir', ['transfer', undefined]],
      ['Nuevo hábito', 'nuevo habito', ['habit', 'habit']],
      ['Nueva tarea', 'nueva tarea', ['habit', 'task']],
      ['Nueva meta', 'nueva meta', ['goal', 'goal']],
      ['Nueva meta de ahorro', 'meta de ahorro', ['goal', 'savings-goal']],
    ];

    it.each(actions)('%s opens the quick-record sheet', async (title, typed, expected) => {
      const user = userEvent.setup();
      render(<Host />);
      await screen.findByRole('dialog');
      await user.type(combobox(), typed);
      await user.click(screen.getByRole('option', { name: new RegExp(`^${title}(?! de ahorro)`) }));
      expect(handlers.onOpenQuickRecord).toHaveBeenCalledWith(...expected);
    });

    it('"Cambiar tema" flips the theme and does not navigate', async () => {
      const user = userEvent.setup();
      render(<Host />);
      await screen.findByRole('dialog');
      await user.type(combobox(), 'tema{Enter}');
      expect(setTheme).toHaveBeenCalledWith('light');
      expect(handlers.onNavigate).not.toHaveBeenCalled();
      expect(handlers.onOpenQuickRecord).not.toHaveBeenCalled();
    });

    it('"Cambiar tema" goes back to dark from light', async () => {
      themeState.theme = 'light';
      const user = userEvent.setup();
      render(<Host />);
      await screen.findByRole('dialog');
      await user.type(combobox(), 'tema{Enter}');
      expect(setTheme).toHaveBeenCalledWith('dark');
    });
  });

  it('only offers "Mi Progreso" while gamification is on', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Host gamificationVisible />);
    await screen.findByRole('dialog');
    await user.type(combobox(), 'progreso');
    expect(screen.getByRole('option', { name: /Mi Progreso/ })).toBeInTheDocument();
    unmount();

    render(<Host gamificationVisible={false} />);
    await screen.findByRole('dialog');
    await user.type(combobox(), 'progreso');
    expect(screen.queryByRole('option', { name: /Mi Progreso/ })).not.toBeInTheDocument();
  });

  it('renders each movement kind with a signed amount', async () => {
    render(<Host />);
    await screen.findByRole('dialog');
    const group = screen.getByRole('group', { name: 'Movimientos' });
    expect(within(group).getByTestId('palette-option-movement:m-new')).toHaveTextContent(/[−-]S\/\s?8\.99/);
    expect(within(group).getByTestId('palette-option-movement:m-income')).toHaveTextContent(/\+S\/\s?3,000\.00/);
    expect(within(group).getByTestId('palette-option-movement:m-transfer')).toHaveTextContent(/S\/\s?50\.00/);
    expect(within(group).getByTestId('palette-option-movement:m-transfer')).not.toHaveTextContent(/[+−-]S\/\s?50/);
  });
});
