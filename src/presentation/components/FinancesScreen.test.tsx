import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import FinancesScreen from './FinancesScreen';
import { db } from '../../infrastructure/db/db';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';

const { installmentListMounts, debtListMounts, env, download } = vi.hoisted(() => ({
  installmentListMounts: vi.fn(),
  debtListMounts: vi.fn(),
  env: { desktop: false, online: true },
  download: vi.fn(),
}));

vi.mock('../hooks/useMediaQuery', () => ({ useIsDesktop: () => env.desktop }));
vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => env.online }));
vi.mock('../lib/downloadTextFile', () => ({ downloadTextFile: download }));
vi.mock('./InstallmentLoanList', () => ({
  default: function MockInstallmentList() {
    React.useEffect(() => { installmentListMounts(); }, []);
    return <div>InstallmentLoanListStub</div>;
  },
}));
vi.mock('./DebtList', () => ({
  default: function MockDebtList() {
    React.useEffect(() => { debtListMounts(); }, []);
    return <div>DebtListStub</div>;
  },
}));
vi.mock('./InstallmentLoanForm', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>complete-installment-loan</button>,
}));
vi.mock('./DebtForm', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>complete-debt</button>,
}));

const refDate = new Date(2026, 9, 1);
const USER = 'A';

/** Fake local data for October 2026: 2 accounts, income 3,000, 2 expenses, 1 transfer, plus one September expense. */
async function seed() {
  const categories = new LocalCategoryRepository();
  await categories.saveDistributionSet(USER, [
    { id: 'needs', user_id: USER, name: 'Necesidades', percentage: 80, is_default: true, is_savings: false },
    { id: 'save', user_id: USER, name: 'Ahorro', percentage: 20, is_default: true, is_savings: true },
  ]);
  await categories.saveExpenseCategory({ id: 'food', user_id: USER, name: 'Comida', distribution_category_id: 'needs' }, ['Restaurantes']);
  const accounts = new LocalPaymentAccountRepository();
  const bank = await accounts.save({ id: '', user_id: USER, name: 'BCP Débito', kind: 'debit', opening_balance: 100000 });
  const cash = await accounts.save({ id: '', user_id: USER, name: 'Billetera', kind: 'cash', opening_balance: 0 });
  const source = await new LocalIncomeSourceRepository().save({ id: '', user_id: USER, name: 'Sueldo', amount: 300000 });
  const repo = new LocalMovementRepository();
  const base = { id: '', user_id: USER, is_recurring: false };
  await repo.save({ ...base, type: 'INCOME', amount: 300000, date: new Date(2026, 9, 1, 9, 0), description: 'Abono planilla', income_source_id: source.id, account_id: bank.id });
  await repo.save({ ...base, type: 'EXPENSE', amount: 1250, date: new Date(2026, 9, 12, 14, 15), description: 'Almuerzo; con "amigos"', distribution_category_id: 'needs', expense_category_id: 'food', account_id: bank.id });
  await repo.save({ ...base, type: 'EXPENSE', amount: 60000, date: new Date(2026, 9, 14, 10, 0), description: 'Mercado', distribution_category_id: 'needs', expense_category_id: 'food', account_id: bank.id });
  await repo.save({ ...base, type: 'TRANSFER', amount: 20000, date: new Date(2026, 9, 15, 8, 0), description: 'A billetera', account_id: bank.id, to_account_id: cash.id });
  await repo.save({ ...base, type: 'EXPENSE', amount: 5000, date: new Date(2026, 8, 20, 12, 0), description: 'Septiembre', distribution_category_id: 'needs', expense_category_id: 'food', account_id: bank.id });
}

beforeEach(async () => {
  env.desktop = false;
  env.online = true;
  download.mockReset();
  installmentListMounts.mockClear();
  debtListMounts.mockClear();
  await db.delete();
  await db.open();
});

describe('FinancesScreen — layout', () => {
  it('desktop stacks KPIs, Regla 50/30/20, Préstamos and Historial on one page, without the Segmented', async () => {
    env.desktop = true;
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);

    expect(screen.queryByRole('tablist', { name: 'Secciones de Finanzas' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Movimientos, Presupuestos & Préstamos' })).toBeInTheDocument();
    const order = [
      screen.getByTestId('finances-kpis'),
      await screen.findByTestId('rule-section'),
      screen.getByTestId('loans-section'),
      screen.getByTestId('history-panel'),
    ];
    order.slice(1).forEach((node, i) => {
      expect(order[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.getByText('InstallmentLoanListStub')).toBeInTheDocument();
    expect(screen.getByText('DebtListStub')).toBeInTheDocument();
    expect(screen.getByText('Finanzas personales /')).toBeInTheDocument();
  });

  it('mobile shows the Segmented and one section at a time, starting on Movimientos', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Finanzas' })).toBeInTheDocument();
    expect(screen.getByText('PEN (S/)')).toBeInTheDocument();
    expect(screen.getByTestId('finances-kpis')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-section')).toBeNull();
    expect(screen.queryByTestId('loans-section')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Regla 50/30/20' }));
    expect(await screen.findByTestId('rule-section')).toBeInTheDocument();
    expect(screen.queryByTestId('history-panel')).toBeNull();
    expect(screen.getByTestId('finances-kpis')).toBeInTheDocument(); // KPIs stay above every section

    await user.click(screen.getByRole('tab', { name: 'Préstamos' }));
    expect(screen.getByText('InstallmentLoanListStub')).toBeInTheDocument();
    expect(screen.getByText('DebtListStub')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-section')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Movimientos' }));
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
  });

  it('opens on the tab given by initialTab on mobile (deep link)', () => {
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Préstamos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('DebtListStub')).toBeInTheDocument();
  });

  it('scrolls the matching section into view on desktop once the data has loaded', async () => {
    env.desktop = true;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Sección de préstamos' }));
  });

  it('does not render its own month controls (the month comes from the shell)', () => {
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mes siguiente' })).toBeNull();
  });
});

describe('FinancesScreen — header', () => {
  it('"Nuevo Movimiento" triggers the app-level movement form', async () => {
    const user = userEvent.setup();
    const onNewMovement = vi.fn();
    render(<FinancesScreen userId={USER} onNewMovement={onNewMovement} />);
    await user.click(screen.getByRole('button', { name: 'Nuevo Movimiento' }));
    expect(onNewMovement).toHaveBeenCalledTimes(1);
  });

  it('shows the connection state as a badge', () => {
    const { unmount } = render(<FinancesScreen userId={USER} onNewMovement={vi.fn()} />);
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('En línea');
    unmount();
    env.online = false;
    render(<FinancesScreen userId={USER} onNewMovement={vi.fn()} />);
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('Sin conexión');
  });
});

describe('FinancesScreen — KPIs from real local data', () => {
  it('shows the month income, expenses, savings rate against the savings bucket and the capital without counting transfers', async () => {
    await seed();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);

    const income = await screen.findByTestId('kpi-income');
    await waitFor(() => expect(within(income).getByText('3,000.00')).toBeInTheDocument());
    expect(within(income).getByText('1 ingreso registrado')).toBeInTheDocument();

    const expense = screen.getByTestId('kpi-expense');
    expect(within(expense).getByText('612.50')).toBeInTheDocument(); // 12.50 + 600.00, the September expense and the transfer excluded
    expect(within(expense).getByText(/20% del presupuesto base/)).toBeInTheDocument();

    const savings = screen.getByTestId('kpi-savings');
    expect(within(savings).getByText('80%')).toBeInTheDocument();
    expect(within(savings).getByText('obj. 20%')).toBeInTheDocument();
    expect(within(savings).getByText('Meta de ahorro alcanzada')).toBeInTheDocument();

    const capital = screen.getByTestId('kpi-capital');
    // 1,000 opening + 3,000 income − 12.50 − 600.00 − 50.00 (September); the transfer nets to zero.
    expect(within(capital).getByText('3,337.50')).toBeInTheDocument();
    expect(within(capital).getByText('2 cuentas')).toBeInTheDocument();
  });

  it('shows the month history, with the savings insight on mobile', async () => {
    await seed();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    expect(await screen.findByText('Mercado')).toBeInTheDocument();
    expect(screen.queryByText('Septiembre')).toBeNull();
    const insight = screen.getByTestId('savings-insight');
    expect(within(insight).getByText('Tasa de ahorro: 80%')).toBeInTheDocument();
    expect(within(insight).getByText('Has gastado el 20% de lo que ingresaste este mes.')).toBeInTheDocument();
  });

  it('builds the Regla 50/30/20 from the month data', async () => {
    const user = userEvent.setup();
    await seed();
    env.desktop = true;
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    const bucket = await screen.findByTestId('rule-bucket-needs');
    await waitFor(() => expect(within(bucket).getByText('Comida')).toBeInTheDocument());
    expect(within(bucket).getByText('612.50')).toBeInTheDocument();
    expect(within(bucket).getByText('S/ 612.50 / S/ 2,400.00')).toBeInTheDocument();
    expect(within(bucket).getByText('26% usado')).toBeInTheDocument();
    expect(within(bucket).getByText('100% de Necesidades')).toBeInTheDocument();
    expect(screen.getByTestId('budget-status-needs')).toHaveAttribute('aria-label', 'Dentro del límite');
    await user.click(within(bucket).getByRole('button', { name: /Comida/ }));
    expect(within(bucket).getByText('Restaurantes')).toBeInTheDocument();
  });

  it('flags a bucket over its budget with the semaphore label', async () => {
    await seed();
    await new LocalCategoryRepository().saveExpenseCategory({ id: 'invest', user_id: USER, name: 'Inversión', distribution_category_id: 'save' }, ['General']);
    await new LocalMovementRepository().save({ id: '', user_id: USER, type: 'EXPENSE', amount: 200000, date: new Date(2026, 9, 20, 12), distribution_category_id: 'save', expense_category_id: 'invest', is_recurring: false });
    env.desktop = true;
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('budget-status-save')).toHaveAttribute('aria-label', 'Presupuesto excedido'));
    expect(screen.getByTestId('budget-status-needs')).toHaveAttribute('aria-label', 'Dentro del límite');
  });

  it('reloads when the shell bumps movementsRefreshKey', async () => {
    await seed();
    const { rerender } = render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} movementsRefreshKey={0} />);
    await screen.findByText('Mercado');
    await new LocalMovementRepository().save({ id: '', user_id: USER, type: 'EXPENSE', amount: 700, date: new Date(2026, 9, 21, 12), description: 'Nuevo gasto', distribution_category_id: 'needs', expense_category_id: 'food', is_recurring: false });
    rerender(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} movementsRefreshKey={1} />);
    expect(await screen.findByText('Nuevo gasto')).toBeInTheDocument();
  });

  it('explains when there is nothing to execute without a distribution', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Regla 50/30/20' }));
    expect(await screen.findByText(/no hay categorías de distribución configuradas/i)).toBeInTheDocument();
  });
});

describe('FinancesScreen — Exportar CSV', () => {
  it('downloads the selected month (all types, with names) as ez-life-movimientos-YYYY-MM.csv', async () => {
    const user = userEvent.setup();
    await seed();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    await screen.findByText('Mercado');

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('ez-life-movimientos-2026-10.csv');
    const lines = content.split('\n');
    expect(lines[0]).toBe('Fecha;Hora;Tipo;Cuenta;Categoria;Monto;Descripcion');
    expect(lines).toHaveLength(5); // header + income + 2 expenses + transfer
    expect(lines[1]).toBe('01/10/2026;09:00;Ingreso;BCP Débito;Sueldo;S/ 3000,00;Abono planilla');
    expect(lines[2]).toBe('12/10/2026;14:15;Egreso;BCP Débito;Comida;S/ 12,50;"Almuerzo; con ""amigos"""');
    expect(lines[4]).toBe('15/10/2026;08:00;Transferencia;BCP Débito -> Billetera;;S/ 200,00;A billetera');
    expect(content).not.toContain('Septiembre');
  });

  it('is disabled with an explanation when the month has no movements, and does not download', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Exportar CSV' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('title', 'No hay movimientos en este mes para exportar');
    expect(screen.getByText('No hay movimientos este mes para exportar.')).toBeInTheDocument();
    await user.click(button);
    expect(download).not.toHaveBeenCalled();
  });

  it('is enabled when the month has movements', async () => {
    await seed();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    await screen.findByText('Mercado');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByText('No hay movimientos este mes para exportar.')).toBeNull();
  });
});

describe('FinancesScreen — loans', () => {
  it('offers the loan buttons only on the Préstamos section on mobile, always on desktop', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FinancesScreen userId={USER} onNewMovement={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '+ Con cuotas' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Nuevo préstamo' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Préstamos' }));
    expect(screen.getByRole('button', { name: '+ Con cuotas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nuevo préstamo' })).toBeInTheDocument();
    unmount();

    env.desktop = true;
    render(<FinancesScreen userId={USER} onNewMovement={vi.fn()} />);
    expect(screen.getByRole('button', { name: '+ Con cuotas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nuevo préstamo' })).toBeInTheDocument();
  });

  it('opens the installment-loan form and remounts its list on completion', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);
    expect(installmentListMounts).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '+ Con cuotas' }));
    await user.click(await screen.findByText('complete-installment-loan'));

    expect(installmentListMounts).toHaveBeenCalledTimes(2);
  });

  it('opens the debt form and remounts only the debt list on completion', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '+ Nuevo préstamo' }));
    await user.click(await screen.findByText('complete-debt'));

    expect(debtListMounts).toHaveBeenCalledTimes(2);
    expect(installmentListMounts).toHaveBeenCalledTimes(1);
  });

  it('counts the active loans and debts in the section header', async () => {
    const now = new Date();
    await db.debts.put({ id: 'd1', user_id: USER, counterparty_name: 'Ana', direction: 'lent', origin: 'manual', amount: 1000, settled_amount: 0, created_at: now, updated_at: now });
    await db.installment_loans.put({ id: 'l1', user_id: USER, lender_name: 'BCP', amount: 1000, installment_count: 2, remaining_installments: 1, installment_amount: 500, status: 'active', created_at: now, updated_at: now });
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);
    expect(await screen.findByText('2 Activos')).toBeInTheDocument();
  });
});

describe('FinancesScreen — movement requested from ⌘K (focus)', () => {
  const idOf = async (description: string) =>
    (await new LocalMovementRepository().getAll(USER)).find(movement => movement.description === description)!.id;

  it('opens the edit dialog of an editable movement and reports it handled', async () => {
    await seed();
    const id = await idOf('Mercado');
    const onFocusHandled = vi.fn();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} focus={{ kind: 'movement', id }} focusNonce={1} onFocusHandled={onFocusHandled} />);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByLabelText('Concepto / descripción')).toHaveValue('Mercado');
    expect(await within(dialog).findByText('Comida')).toBeInTheDocument();
    expect(onFocusHandled).toHaveBeenCalledTimes(1);
  });

  it('opens the history from another phone section', async () => {
    await seed();
    const id = await idOf('Mercado');
    render(<FinancesScreen userId={USER} refDate={refDate} initialTab="budget" onNewMovement={vi.fn()} focus={{ kind: 'movement', id }} focusNonce={1} />);

    expect(await screen.findByTestId('history-panel')).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByLabelText('Concepto / descripción')).toHaveValue('Mercado');
    expect(await within(dialog).findByText('Comida')).toBeInTheDocument();
  });

  it('reveals (and does not edit) a movement that is managed from its origin', async () => {
    await seed();
    await new LocalMovementRepository().save({
      id: '', user_id: USER, is_recurring: false, type: 'EXPENSE', amount: 4500, date: new Date(2026, 9, 13, 9, 0),
      description: 'Cena compartida', distribution_category_id: 'needs', expense_category_id: 'food', account_id: undefined,
      shared_movement_id: 'sm-1', is_linked: true,
    });
    const id = await idOf('Cena compartida');
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} focus={{ kind: 'movement', id }} focusNonce={1} />);

    const row = await screen.findByTestId(`movement-${id}`);
    await waitFor(() => expect(row).toHaveAttribute('data-reveal', 'true'));
    expect(row).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('jumps to the right page and clears filters on desktop', async () => {
    env.desktop = true;
    await seed();
    const repo = new LocalMovementRepository();
    for (let day = 1; day <= 24; day += 1) {
      await repo.save({ id: '', user_id: USER, is_recurring: false, type: 'EXPENSE', amount: 100, date: new Date(2026, 9, day, 7, 0), description: `Gasto ${day}`, distribution_category_id: 'needs', expense_category_id: 'food' });
    }
    await repo.save({
      id: '', user_id: USER, is_recurring: false, type: 'EXPENSE', amount: 300, date: new Date(2026, 9, 1, 6, 0),
      description: 'El más antiguo', distribution_category_id: 'needs', expense_category_id: 'food', shared_movement_id: 'sm-2', is_linked: true,
    });
    const id = await idOf('El más antiguo');
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} focus={{ kind: 'movement', id }} focusNonce={1} />);

    const row = await screen.findByTestId(`movement-${id}`, undefined, { timeout: 3000 });
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(row).toHaveAttribute('data-reveal', 'true'));
  });

  it('gives up quietly when the movement is not in the month shown', async () => {
    await seed();
    const onFocusHandled = vi.fn();
    const { rerender } = render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} onFocusHandled={onFocusHandled} />);
    await screen.findByTestId('history-panel');
    await screen.findByText('Mercado');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      rerender(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} focus={{ kind: 'movement', id: 'otro-mes' }} focusNonce={1} onFocusHandled={onFocusHandled} />);
      expect(onFocusHandled).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(4100); });
      expect(onFocusHandled).toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
