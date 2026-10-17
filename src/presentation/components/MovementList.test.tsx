import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import MovementList, { MOVEMENT_PAGE_SIZE } from './MovementList';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import type { Movement } from '../../core/domain/models/types';
import { EMPTY_LOOKUPS, type MovementLookups } from '../../core/use-cases/describeMovement';

vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');
vi.mock('./MovementForm', () => ({
  default: function MockMovementForm({ movement, onComplete, onCancel }: { movement?: Movement; onComplete: () => void; onCancel: () => void }) {
    return (
      <div>
        <p>{`editing:${movement?.id}`}</p>
        <button onClick={onComplete}>save-edit</button>
        <button onClick={onCancel}>cancel-edit</button>
      </div>
    );
  },
}));

const TODAY = new Date(2026, 9, 16, 21, 30);

function movement(patch: Partial<Movement> & { id: string }): Movement {
  return {
    user_id: 'u1', type: 'EXPENSE', amount: 1000, date: new Date(2026, 9, 16, 14, 30), is_recurring: false,
    created_at: new Date(), updated_at: new Date(), ...patch,
  };
}

const lookups: MovementLookups = {
  categoryName: { c1: 'Comida', c2: 'Transporte' },
  subcategoryName: { s1: 'Restaurantes' },
  incomeSourceName: { i1: 'Sueldo' },
  bucket: { b1: { name: 'Necesidades', percentage: 50 } },
  accountName: { a1: 'BCP Débito', a2: 'Efectivo' },
};

const deleteMock = vi.fn();

function renderList(movements: Movement[], overrides: Partial<React.ComponentProps<typeof MovementList>> = {}) {
  const onChanged = vi.fn();
  const view = render(
    <MovementList
      userId="u1"
      movements={movements}
      lookups={lookups}
      pendingIds={new Set()}
      balanceCents={0}
      today={TODAY}
      loading={false}
      desktop={false}
      onChanged={onChanged}
      {...overrides}
    />,
  );
  return { onChanged, ...view };
}

const rowIds = () => screen.queryAllByTestId(/^movement-(?!sync-)/).map(row => row.getAttribute('data-testid'));

beforeEach(() => {
  deleteMock.mockReset().mockResolvedValue(undefined);
  vi.mocked(LocalMovementRepository).mockImplementation(function () {
    return { delete: deleteMock } as unknown as InstanceType<typeof LocalMovementRepository>;
  });
});

describe('MovementList', () => {
  it('shows the movements it is given', () => {
    renderList([movement({ id: 'm1', description: 'Café' })]);
    expect(screen.getByText('Café')).toBeInTheDocument();
  });

  it('shows a loading state instead of rows while loading', () => {
    const { container } = renderList([movement({ id: 'm1', description: 'Café' })], { loading: true });
    expect(screen.queryByText('Café')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  describe('category/subcategory visibility (FR-007, FR-008, US3)', () => {
    it("shows a movement's resolved category and subcategory name directly in the list", () => {
      renderList([movement({ id: 'm1', description: 'Almuerzo', expense_category_id: 'c1', expense_subcategory_id: 's1' })]);
      expect(screen.getByText('Almuerzo')).toBeInTheDocument();
      expect(screen.getByText(/comida/i)).toBeInTheDocument();
      expect(screen.getByText(/restaurantes/i)).toBeInTheDocument();
    });

    it('shows "Sin categoría" for a movement without a category', () => {
      renderList([movement({ id: 'm1', description: 'Varios', amount: 500 })]);
      expect(screen.getByText('Varios')).toBeInTheDocument();
      expect(screen.getByText(/sin categor[ií]a/i)).toBeInTheDocument();
    });

    it('shows the real bucket as "50% Necesidades" next to the title', () => {
      renderList([movement({ id: 'm1', description: 'Almuerzo', distribution_category_id: 'b1', expense_category_id: 'c1' })]);
      expect(screen.getByText('50% Necesidades')).toBeInTheDocument();
    });
  });

  describe('balance adjustment badge (006-ajuste-de-balance-mensual)', () => {
    it('shows the "Ajuste" badge for a manual balance adjustment', () => {
      renderList([movement({ id: 'm1', type: 'INCOME', amount: 5000, description: 'Bono', is_adjustment: true })]);
      expect(screen.getByText('Bono')).toBeInTheDocument();
      expect(screen.getByText('Ajuste')).toBeInTheDocument();
    });

    it('does not show the "Ajuste" badge for a regular movement', () => {
      renderList([movement({ id: 'm1', description: 'Café' })]);
      expect(screen.getByText('Café')).toBeInTheDocument();
      expect(screen.queryByText('Ajuste')).not.toBeInTheDocument();
    });
  });

  describe('time and transfers (011-cuentas-hora-prioridad)', () => {
    it('shows the movement time on its row', () => {
      renderList([movement({ id: 'm1', description: 'Café', amount: 500, date: new Date(2026, 9, 16, 7, 5) })]);
      expect(screen.getByText(/07:05/)).toBeInTheDocument();
    });

    it('renders a transfer as neutral (no sign, no category), labelled "Transferencia" with its destination', () => {
      renderList([movement({ id: 't1', type: 'TRANSFER', amount: 2500, description: 'A ahorros', account_id: 'a1', to_account_id: 'a2' })]);
      const row = screen.getByTestId('movement-t1');
      expect(within(row).getByText('A ahorros')).toBeInTheDocument();
      expect(within(row).getByText('Transferencia')).toBeInTheDocument();
      expect(within(row).getByText('A: Efectivo')).toBeInTheDocument();
      expect(within(row).queryByText(/sin categor[ií]a/i)).not.toBeInTheDocument();
      expect(row.querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'neutral');
      expect(within(row).getByText('25.00')).toBeInTheDocument();
      expect(row.querySelector('[data-slot="money-sign"]')).toBeNull();
    });

    it('signs incomes with + and expenses with a minus', () => {
      renderList([
        movement({ id: 'in', type: 'INCOME', amount: 300000, description: 'Sueldo base', income_source_id: 'i1' }),
        movement({ id: 'ex', amount: 1250, description: 'Menú' }),
      ]);
      const income = screen.getByTestId('movement-in');
      expect(within(income).getByText('3,000.00')).toBeInTheDocument();
      expect(income.querySelector('[data-slot="money-sign"]')).toHaveTextContent('+');
      expect(income.querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'income');
      const expense = screen.getByTestId('movement-ex');
      expect(expense.querySelector('[data-slot="money-sign"]')).toHaveTextContent('−');
      expect(expense.querySelector('[data-slot="money"]')).toHaveAttribute('data-tone', 'expense');
    });
  });

  describe('grouping by day (mobile)', () => {
    it('groups rows under a heading per local day, newest first', () => {
      renderList([
        movement({ id: 'old', description: 'Sueldo', date: new Date(2026, 9, 1, 9, 0) }),
        movement({ id: 'yesterday', description: 'Cena', date: new Date(2026, 9, 15, 20, 0) }),
        movement({ id: 'today', description: 'Café', date: new Date(2026, 9, 16, 14, 30) }),
      ]);
      const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
      expect(headings).toEqual(expect.arrayContaining(['Hoy, 16 de octubre 2026', 'Ayer, 15 de octubre 2026', '1 de octubre 2026']));
      expect(rowIds()).toEqual(['movement-today', 'movement-yesterday', 'movement-old']);
      const todayGroup = screen.getByRole('region', { name: 'Hoy, 16 de octubre 2026' });
      expect(within(todayGroup).getByText('Café')).toBeInTheDocument();
      expect(within(todayGroup).queryByText('Cena')).toBeNull();
    });
  });

  describe('filters, search and sort', () => {
    const month = [
      movement({ id: 'e1', description: 'Café', expense_category_id: 'c1', amount: 1000, date: new Date(2026, 9, 14, 8, 0), account_id: 'a1' }),
      movement({ id: 'e2', description: 'Taxi', expense_category_id: 'c2', amount: 2000, date: new Date(2026, 9, 12, 8, 0), is_linked: true, shared_movement_id: 'sm' }),
      movement({ id: 'i1', type: 'INCOME', description: 'Sueldo', income_source_id: 'i1', amount: 300000, date: new Date(2026, 9, 1, 9, 0) }),
      movement({ id: 't1', type: 'TRANSFER', description: 'Mover', account_id: 'a1', to_account_id: 'a2', amount: 5000, date: new Date(2026, 9, 5, 10, 0) }),
    ];

    it('shows the count of every filter tab and filters by tab', async () => {
      const user = userEvent.setup();
      renderList(month);
      expect(screen.getByRole('tab', { name: /^Todos\s*4$/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /^Gastos\s*2$/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /^Ingresos\s*1$/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /^Transferencias\s*1$/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /^Compartido\s*1$/ })).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: /^Gastos/ }));
      expect(rowIds()).toEqual(['movement-e1', 'movement-e2']);
      await user.click(screen.getByRole('tab', { name: /^Ingresos/ }));
      expect(rowIds()).toEqual(['movement-i1']);
      await user.click(screen.getByRole('tab', { name: /^Transferencias/ }));
      expect(rowIds()).toEqual(['movement-t1']);
      await user.click(screen.getByRole('tab', { name: /^Compartido/ }));
      expect(rowIds()).toEqual(['movement-e2']);
    });

    it('searches ignoring case and accents over description, category, account and amount', async () => {
      const user = userEvent.setup();
      renderList(month);
      const search = screen.getByRole('searchbox', { name: 'Buscar movimientos' });

      await user.type(search, 'CAFE');
      expect(rowIds()).toEqual(['movement-e1']);
      await user.clear(search);
      await user.type(search, 'transporte');
      expect(rowIds()).toEqual(['movement-e2']);
      await user.clear(search);
      await user.type(search, 'debito');
      expect(rowIds()).toEqual(['movement-e1', 'movement-t1']);
      await user.clear(search);
      await user.type(search, '3000');
      expect(rowIds()).toEqual(['movement-i1']);
    });

    it('filters by category', async () => {
      const user = userEvent.setup();
      renderList(month);
      await user.click(screen.getByRole('combobox', { name: 'Filtrar por categoría' }));
      await user.click(await screen.findByRole('option', { name: 'Transporte' }));
      expect(rowIds()).toEqual(['movement-e2']);
    });

    it('toggles the date sort between newest and oldest first', async () => {
      const user = userEvent.setup();
      renderList(month);
      expect(rowIds()).toEqual(['movement-e1', 'movement-e2', 'movement-t1', 'movement-i1']);
      await user.click(screen.getByRole('button', { name: /Fecha.*más recientes primero/ }));
      expect(rowIds()).toEqual(['movement-i1', 'movement-t1', 'movement-e2', 'movement-e1']);
      expect(screen.getByRole('button', { name: /Fecha.*más antiguos primero/ })).toBeInTheDocument();
    });

    it('explains an empty filter result and clears the filters', async () => {
      const user = userEvent.setup();
      renderList([movement({ id: 'e1', description: 'Café' })]);

      await user.click(screen.getByRole('tab', { name: /^Transferencias/ }));
      expect(screen.getByText('No hay transferencias en este mes.')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: /^Compartido/ }));
      expect(screen.getByText('No hay movimientos compartidos en este mes.')).toBeInTheDocument();

      await user.type(screen.getByRole('searchbox'), 'zzz');
      expect(screen.getByText(/no hay movimientos que coincidan/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
      expect(screen.getByText('Café')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /^Todos/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('shows "No hay movimientos en este mes" without toolbar for an empty month', () => {
      renderList([]);
      expect(screen.getByText(/no hay movimientos en este mes/i)).toBeInTheDocument();
      expect(screen.queryByRole('tablist')).toBeNull();
    });
  });

  describe('edit and delete', () => {
    it('opens the edit form from the row menu and reports the change when it is saved', async () => {
      const user = userEvent.setup();
      const { onChanged } = renderList([movement({ id: 'm1', description: 'Café' })]);

      await user.click(screen.getByRole('button', { name: 'Acciones de Café' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
      expect(await screen.findByText('editing:m1')).toBeInTheDocument();

      await user.click(screen.getByText('save-edit'));
      expect(onChanged).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByText('editing:m1')).toBeNull());
    });

    it('closes the edit form on cancel without reporting a change', async () => {
      const user = userEvent.setup();
      const { onChanged } = renderList([movement({ id: 'm1', description: 'Café' })]);
      await user.click(screen.getByRole('button', { name: 'Acciones de Café' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
      await user.click(await screen.findByText('cancel-edit'));
      await waitFor(() => expect(screen.queryByText('editing:m1')).toBeNull());
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('deletes after confirmation, scoped to the user', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { onChanged } = renderList([movement({ id: 'm1', description: 'Café' })]);

      await user.click(screen.getByRole('button', { name: 'Acciones de Café' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));

      await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('m1', 'u1'));
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the confirmation is declined', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { onChanged } = renderList([movement({ id: 'm1', description: 'Café' })]);

      await user.click(screen.getByRole('button', { name: 'Acciones de Café' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));

      expect(deleteMock).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('shows the error when the delete fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      deleteMock.mockRejectedValue(new Error('No se pudo borrar'));
      renderList([movement({ id: 'm1', description: 'Café' })]);

      await user.click(screen.getByRole('button', { name: 'Acciones de Café' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo borrar');
    });

    it('offers no menu for shared, linked or installment movements', () => {
      renderList([
        movement({ id: 'shared', description: 'Cena', shared_movement_id: 'sm' }),
        movement({ id: 'linked', description: 'Taxi', is_linked: true }),
        movement({ id: 'loan', description: 'Cuota', installment_payment_id: 'p' }),
        movement({ id: 'own', description: 'Café' }),
      ]);
      expect(screen.getAllByRole('button', { name: /^Acciones de / })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Acciones de Café' })).toBeInTheDocument();
    });
  });

  describe('desktop table', () => {
    const rows = [
      movement({ id: 'e1', description: 'Almuerzo', expense_category_id: 'c1', expense_subcategory_id: 's1', distribution_category_id: 'b1', account_id: 'a1', amount: 1250, date: new Date(2026, 9, 12, 14, 15) }),
      movement({ id: 'i1', type: 'INCOME', description: 'Abono planilla', income_source_id: 'i1', account_id: 'a1', amount: 300000, date: new Date(2026, 9, 10, 9, 30) }),
      movement({ id: 't1', type: 'TRANSFER', description: 'A ahorros', account_id: 'a1', to_account_id: 'a2', amount: 5000, date: new Date(2026, 9, 10, 10, 0) }),
    ];

    it('renders a table with column headers, one row per movement and the sync state', () => {
      renderList(rows, { desktop: true, pendingIds: new Set(['e1']), balanceCents: 298750 });
      const table = screen.getByRole('table', { name: 'Movimientos del mes' });
      const headers = within(table).getAllByRole('columnheader').map(h => h.textContent);
      expect(headers).toEqual(['Fecha y hora', 'Concepto', 'Categoría', 'Cuenta', 'Estado', 'Monto', 'Acciones']);
      expect(within(table).getAllByRole('row')).toHaveLength(1 + rows.length);

      const expense = screen.getByTestId('movement-e1');
      expect(within(expense).getByText('Almuerzo')).toBeInTheDocument();
      expect(within(expense).getByText('Comida')).toBeInTheDocument();
      expect(within(expense).getByText('50% Necesidades')).toBeInTheDocument();
      expect(within(expense).getByText('BCP Débito')).toBeInTheDocument();
      expect(within(expense).getByText('12 oct 2026')).toBeInTheDocument();
      expect(within(expense).getByText('14:15')).toBeInTheDocument();
      expect(within(expense).getByLabelText('Pendiente de sincronizar')).toHaveTextContent('Pendiente');
      expect(within(screen.getByTestId('movement-i1')).getByLabelText('Sincronizado')).toHaveTextContent('Sincronizado');
      expect(within(screen.getByTestId('movement-t1')).getByText('BCP Débito → Efectivo')).toBeInTheDocument();
    });

    it('shows the footer with the shown count and the net balance of the cycle', () => {
      renderList(rows, { desktop: true, balanceCents: 298750 });
      expect(screen.getByText(/Mostrando 3 de 3 registros del mes/)).toBeInTheDocument();
      const footer = screen.getByText(/Balance neto del ciclo/);
      expect(within(footer).getByText('2,987.50')).toBeInTheDocument();
      expect(footer.querySelector('[data-slot="money-sign"]')).toHaveTextContent('+');
      expect(screen.queryByRole('navigation', { name: 'Paginación de movimientos' })).toBeNull();
    });

    it('paginates 20 rows per page and goes back to page 1 when a filter changes', async () => {
      const user = userEvent.setup();
      const many = Array.from({ length: 45 }, (_, i) => movement({
        id: `m${String(i).padStart(2, '0')}`, description: `Gasto ${i}`, date: new Date(2026, 9, 1, 8, i),
      }));
      renderList(many, { desktop: true });

      expect(MOVEMENT_PAGE_SIZE).toBe(20);
      expect(rowIds()).toHaveLength(20);
      expect(screen.getByText(/Mostrando 20 de 45 registros del mes/)).toBeInTheDocument();
      const pager = screen.getByRole('navigation', { name: 'Paginación de movimientos' });
      expect(within(pager).getByRole('button', { name: 'Anterior' })).toBeDisabled();
      expect(within(pager).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');

      await user.click(within(pager).getByRole('button', { name: 'Siguiente' }));
      expect(rowIds()[0]).toBe('movement-m24'); // newest first: page 2 starts at the 21st newest
      await user.click(within(pager).getByRole('button', { name: 'Siguiente' }));
      expect(rowIds()).toHaveLength(5);
      expect(screen.getByText(/Mostrando 5 de 45 registros del mes/)).toBeInTheDocument();
      expect(within(pager).getByRole('button', { name: 'Siguiente' })).toBeDisabled();

      await user.type(screen.getByRole('searchbox'), 'Gasto 44');
      expect(screen.getByText(/\(45 del mes\)/)).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Paginación de movimientos' })).toBeNull(); // one match: one page, back on page 1
      expect(rowIds()).toEqual(['movement-m44']);
      expect(screen.getByText(/Mostrando 1 de 1 registro filtrado \(45 del mes\)/)).toBeInTheDocument();
    });

    it('opens the edit form from the row menu on desktop too', async () => {
      const user = userEvent.setup();
      renderList(rows, { desktop: true });
      await user.click(screen.getByRole('button', { name: 'Acciones de Almuerzo' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
      expect(await screen.findByText('editing:e1')).toBeInTheDocument();
    });
  });
});

describe('EMPTY_LOOKUPS', () => {
  it('lets the list render a movement whose lookups are missing', () => {
    renderList([movement({ id: 'm1', description: 'Café', expense_category_id: 'gone', account_id: 'gone' })], { lookups: EMPTY_LOOKUPS });
    expect(screen.getByText('Café')).toBeInTheDocument();
    expect(screen.getByText('Sin categoría')).toBeInTheDocument();
  });
});
