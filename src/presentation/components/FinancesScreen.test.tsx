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
  env: { online: true },
  download: vi.fn(),
}));

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
  env.online = true;
  download.mockReset();
  installmentListMounts.mockClear();
  debtListMounts.mockClear();
  await db.delete();
  await db.open();
});

describe('FinancesScreen — 3-tab minimalist layout (spec 014)', () => {
  it('shows 3 Segmented tabs without KPI grid or table, switching between Movimientos, Regla 50/30/20, and Préstamos', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Finanzas' })).toBeInTheDocument();
    expect(screen.queryByTestId('finances-kpis')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-section')).toBeNull();
    expect(screen.queryByTestId('loans-section')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Regla 50/30/20' }));
    expect(await screen.findByTestId('rule-section')).toBeInTheDocument();
    expect(screen.queryByTestId('history-panel')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Préstamos' }));
    expect(await screen.findByTestId('loans-section')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-section')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Movimientos' }));
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
  });

  it('opens on the tab given by initialTab (deep link)', () => {
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Préstamos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('loans-section')).toBeInTheDocument();
  });

  it('does not render its own month controls (the month comes from the shell)', () => {
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mes siguiente' })).toBeNull();
  });
});

describe('FinancesScreen — header', () => {
  it('shows the connection state as a badge', () => {
    const { unmount } = render(<FinancesScreen userId={USER} onNewMovement={vi.fn()} />);
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('En línea');
    unmount();
    env.online = false;
    render(<FinancesScreen userId={USER} onNewMovement={vi.fn()} />);
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('Sin conexión');
  });
});

describe('FinancesScreen — hero figures from real local data', () => {
  it('shows the Movimientos hero net balance (income - expense, transfers excluded) and day-grouped cards without a table', async () => {
    await seed();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);

    expect(await screen.findByText('Mercado')).toBeInTheDocument();
    expect(screen.queryByText('Septiembre')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();

    const hero = screen.getByTestId('movements-hero');
    // 3,000.00 income - 612.50 expense = +2,387.50
    expect(within(hero).getByText('2,387.50')).toBeInTheDocument();
    expect(within(hero).getByText(/Ingresos S\/ 3,000\.00 · Egresos S\/ 612\.50/)).toBeInTheDocument();
  });

  it('builds the Regla 50/30/20 hero % and bucket phrases from local data', async () => {
    const user = userEvent.setup();
    await seed();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    await screen.findByText('Mercado');

    await user.click(screen.getByRole('tab', { name: 'Regla 50/30/20' }));
    const bucket = await screen.findByTestId('rule-bucket-needs');
    expect(within(bucket).getByText('Llevas S/ 612.50 de S/ 2,400.00 en necesidades')).toBeInTheDocument();
    expect(screen.getByTestId('budget-status-needs')).toHaveAttribute('aria-label', 'Dentro del límite');

    // Expand category breakdown inside CollapsibleSection
    await user.click(within(bucket).getByRole('button', { name: /Ver 1 categoría/i }));
    await user.click(within(bucket).getByRole('button', { name: /Comida/ }));
    expect(within(bucket).getByText('Restaurantes')).toBeInTheDocument();
  });

  it('reloads when the shell bumps movementsRefreshKey', async () => {
    await seed();
    const { rerender } = render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} movementsRefreshKey={0} />);
    await screen.findByText('Mercado');
    await new LocalMovementRepository().save({ id: '', user_id: USER, type: 'EXPENSE', amount: 700, date: new Date(2026, 9, 21, 12), description: 'Nuevo gasto', distribution_category_id: 'needs', expense_category_id: 'food', is_recurring: false });
    rerender(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} movementsRefreshKey={1} />);
    expect(await screen.findByText('Nuevo gasto')).toBeInTheDocument();
  });

  it('shows actionable empty state when there is no distribution configured', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Regla 50/30/20' }));
    expect(await screen.findByText(/Aún no configuras tu regla 50\/30\/20/i)).toBeInTheDocument();
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
    expect(lines).toHaveLength(5);
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
});

describe('FinancesScreen — loans', () => {
  it('shows empty state when no loans, debts or credit cards exist, and opens forms in Sheet', async () => {
    const user = userEvent.setup();
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);
    expect(await screen.findByText('Aún no tienes préstamos')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Con cuotas' }));
    await user.click(await screen.findByText('complete-installment-loan'));
  });

  it('shows hero total owed and separate "Te deben" card for lent debts', async () => {
    const now = new Date();
    await db.debts.put({ id: 'd1', user_id: USER, counterparty_name: 'Ana', direction: 'lent', origin: 'manual', amount: 8000, settled_amount: 0, created_at: now, updated_at: now });
    await db.installment_loans.put({ id: 'l1', user_id: USER, lender_name: 'BCP', amount: 10000, installment_count: 2, remaining_installments: 1, installment_amount: 5000, status: 'active', created_at: now, updated_at: now });
    render(<FinancesScreen userId={USER} initialTab="loans" onNewMovement={vi.fn()} />);

    const hero = await screen.findByTestId('loans-hero');
    await waitFor(() => expect(within(hero).getByText('50.00')).toBeInTheDocument());

    const owedToMe = await screen.findByTestId('owed-to-me-card');
    expect(within(owedToMe).getByText('80.00')).toBeInTheDocument();
  });
});

describe('FinancesScreen — movement requested from ⌘K (focus)', () => {
  const idOf = async (description: string) =>
    (await new LocalMovementRepository().getAll(USER)).find(movement => movement.description === description)!.id;

  it('opens the edit sheet of an editable movement and reports it handled', async () => {
    await seed();
    const id = await idOf('Mercado');
    const onFocusHandled = vi.fn();
    render(<FinancesScreen userId={USER} refDate={refDate} onNewMovement={vi.fn()} focus={{ kind: 'movement', id }} focusNonce={1} onFocusHandled={onFocusHandled} />);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByLabelText('Concepto / descripción')).toHaveValue('Mercado');
    expect(onFocusHandled).toHaveBeenCalledTimes(1);
  });

  it('switches to Movimientos from another tab when focus arrives', async () => {
    await seed();
    const id = await idOf('Mercado');
    render(<FinancesScreen userId={USER} refDate={refDate} initialTab="budget" onNewMovement={vi.fn()} focus={{ kind: 'movement', id }} focusNonce={1} />);

    expect(await screen.findByTestId('history-panel')).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByLabelText('Concepto / descripción')).toHaveValue('Mercado');
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
