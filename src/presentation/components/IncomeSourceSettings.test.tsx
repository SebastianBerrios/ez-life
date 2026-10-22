import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IncomeSourceSettings from './IncomeSourceSettings';
import { db } from '../../infrastructure/db/db';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';

const U = 'u';

beforeEach(async () => { await db.delete(); await db.open(); });
afterEach(() => vi.restoreAllMocks());

describe('IncomeSourceSettings', () => {
  it('shows an empty state and lists real sources with their amount', async () => {
    const { unmount } = render(<IncomeSourceSettings userId={U} />);
    expect(await screen.findByText('Todavía no tienes fuentes de ingreso.')).toBeInTheDocument();
    unmount();

    await new LocalIncomeSourceRepository().save({ id: '', user_id: U, name: 'Sueldo', amount: 300050 });
    render(<IncomeSourceSettings userId={U} />);
    const row = (await screen.findByText('Sueldo')).closest('li')!;
    expect(within(row).getByLabelText('Ingreso mensual de Sueldo')).toHaveTextContent(/S\/\s?3,000\.50/);
  });

  it('adds a source, parsing the amount into integer cents', async () => {
    const user = userEvent.setup();
    render(<IncomeSourceSettings userId={U} />);
    await screen.findByText('Todavía no tienes fuentes de ingreso.');

    await user.type(screen.getByLabelText('Nombre de la fuente'), 'Freelance');
    await user.type(screen.getByLabelText('Ingreso mensual esperado'), '1,250.75');
    await user.click(screen.getByRole('button', { name: 'Agregar fuente' }));

    expect(await screen.findByText('Freelance')).toBeInTheDocument();
    expect((await new LocalIncomeSourceRepository().getAll(U))[0].amount).toBe(125075);
    expect(screen.getByLabelText('Nombre de la fuente')).toHaveValue('');
  });

  it('rejects an amount with more than two decimals and saves nothing', async () => {
    const user = userEvent.setup();
    render(<IncomeSourceSettings userId={U} />);
    await user.type(await screen.findByLabelText('Nombre de la fuente'), 'Freelance');
    await user.type(screen.getByLabelText('Ingreso mensual esperado'), '10.123');
    await user.click(screen.getByRole('button', { name: 'Agregar fuente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresa un monto con hasta dos decimales.');
    expect(await new LocalIncomeSourceRepository().getAll(U)).toEqual([]);
  });

  it('edits a source with the amount prefilled from cents (no float formatting)', async () => {
    const user = userEvent.setup();
    await new LocalIncomeSourceRepository().save({ id: '', user_id: U, name: 'Sueldo', amount: 300005 });
    render(<IncomeSourceSettings userId={U} />);

    await user.click(await screen.findByRole('button', { name: 'Editar Sueldo' }));
    expect(screen.getByLabelText('Ingreso mensual esperado')).toHaveValue('3000.05');
    expect(screen.getByLabelText('Nombre de la fuente')).toHaveValue('Sueldo');

    await user.clear(screen.getByLabelText('Ingreso mensual esperado'));
    await user.type(screen.getByLabelText('Ingreso mensual esperado'), '3200');
    await user.click(screen.getByRole('button', { name: 'Guardar fuente' }));

    await waitFor(async () => expect((await new LocalIncomeSourceRepository().getAll(U))[0].amount).toBe(320000));
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('cancels an edit without saving', async () => {
    const user = userEvent.setup();
    await new LocalIncomeSourceRepository().save({ id: '', user_id: U, name: 'Sueldo', amount: 300000 });
    render(<IncomeSourceSettings userId={U} />);
    await user.click(await screen.findByRole('button', { name: 'Editar Sueldo' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Nombre de la fuente')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Agregar fuente' })).toBeInTheDocument();
  });

  it('deletes only after confirmation', async () => {
    const user = userEvent.setup();
    await new LocalIncomeSourceRepository().save({ id: '', user_id: U, name: 'Sueldo', amount: 300000 });
    render(<IncomeSourceSettings userId={U} />);

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    await user.click(await screen.findByRole('button', { name: 'Eliminar Sueldo' }));
    expect(screen.getByText('Sueldo')).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Eliminar Sueldo' }));
    await waitFor(() => expect(screen.queryByText('Sueldo')).toBeNull());
  });
});
