import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';
import { HIDE_AMOUNTS_STORAGE_KEY } from '../hooks/useHideAmounts';
import type { SummaryData, SummaryView } from '../hooks/useSummaryData';

const summaryState = vi.hoisted(() => ({
  loading: false,
  register: vi.fn(),
  skip: vi.fn(),
  dismissChecklist: vi.fn(),
  view: null as SummaryView | null,
}));

vi.mock('../hooks/useSummaryData', () => ({
  useSummaryData: () => ({
    loading: summaryState.loading,
    view: summaryState.view!,
    register: summaryState.register,
    skip: summaryState.skip,
    dismissChecklist: summaryState.dismissChecklist,
  }) satisfies SummaryData,
}));

const NOW = new Date(2026, 10, 10, 12, 0);

function makeView(overrides: Partial<SummaryView> = {}): SummaryView {
  return {
    today: NOW,
    isCurrentMonth: true,
    balance: {
      opening: 100000,
      entro: 50000,
      salio: 30000,
      ahorraste: 0,
      sacaste: 0,
      ajuste: 0,
      balance: 120000,
      savingsNet: 0,
      cards: [
        { accountId: 'c1', name: 'BBVA', owed: 80000, previousDebt: 0, creditLimit: 500000, paymentDay: 15 },
      ],
    },
    cards: [
      { accountId: 'c1', name: 'BBVA', owed: 80000, previousDebt: 0, creditLimit: 500000, paymentDay: 15 },
    ],
    pending: [
      {
        key: 'recurrence:r1:2026-11',
        kind: 'recurrence',
        refId: 'r1',
        title: 'Gimnasio',
        amount: 8000,
        day: 5,
        overdue: true,
      },
    ],
    accounts: [
      { id: 'debit-1', name: 'BCP', kind: 'debit', balanceCents: 100000 },
      { id: 'cash-1', name: 'Efectivo', kind: 'cash', balanceCents: 20000 },
    ],
    debts: {
      cards: [
        { accountId: 'c1', name: 'BBVA', owed: 80000, previousDebt: 0, creditLimit: 500000, paymentDay: 15 },
      ],
      loans: [
        {
          id: 'l1',
          name: 'Interbank',
          remainingBalanceCents: 250000,
          nextInstallment: { number: 3, total: 12, amountCents: 25000, remaining: 10 },
          paymentDay: 20,
        },
      ],
      informalDebts: [],
    },
    rule: {
      expectedIncome: 300000,
      hasBuckets: true,
      buckets: [
        {
          id: 'needs',
          name: 'Necesidades',
          percentage: 50,
          isSavings: false,
          kind: 'needs',
          budget: 150000,
          spent: 61500,
          remaining: 88500,
          barPercent: 41,
          exceeded: false,
          negativeSavings: false,
          phrase: 'Te quedan S/ 885.00 para necesidades',
        },
      ],
    },
    primaryGoal: {
      goal: {
        id: 'g1',
        user_id: 'u1',
        name: 'Viaje',
        target_amount: 200000,
        created_at: NOW,
        updated_at: NOW,
      },
      currentAmountCents: 50000,
      percentage: 25,
      remainingCents: 150000,
    },
    checklist: {
      items: [
        { key: 'income', done: true },
        { key: 'accounts', done: true },
        { key: 'cards', done: false },
        { key: 'loans', done: false },
      ],
      doneCount: 2,
      visible: true,
      nextPending: 'cards',
    },
    progress: { visible: true },
    ...overrides,
  };
}

function isBefore(a: HTMLElement, b: HTMLElement): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('Dashboard — Resumen minimalista (spec 013 US4, T070)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    summaryState.loading = false;
    summaryState.view = makeView();
    summaryState.register.mockReset();
    summaryState.skip.mockReset().mockResolvedValue(undefined);
    summaryState.dismissChecklist.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('shows a loading skeleton while useSummaryData is loading', () => {
    summaryState.loading = true;
    render(<Dashboard userId="u1" />);
    expect(screen.getByTestId('dashboard-loading')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders sections in exact SC-009 order with balance, flows and first pending item before Cuentas, and omits every retired dashboard block', () => {
    render(<Dashboard userId="u1" />);

    const balance = screen.getByTestId('balance-hero');
    const pending = screen.getByTestId('pending-registrations');
    const accountsAndDebts = screen.getByTestId('accounts-and-debts');
    const compactRule = screen.getByTestId('compact-rule');
    const primaryGoal = screen.getByTestId('primary-goal');
    const setupChecklist = screen.getByTestId('setup-checklist');

    expect(isBefore(balance, pending)).toBe(true);
    expect(isBefore(pending, accountsAndDebts)).toBe(true);
    expect(isBefore(accountsAndDebts, compactRule)).toBe(true);
    expect(isBefore(compactRule, primaryGoal)).toBe(true);
    expect(isBefore(primaryGoal, setupChecklist)).toBe(true);

    // US4 Independent Test content above Cuentas
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('S/ 1,200.00');
    expect(screen.getByTestId('balance-flows')).toHaveTextContent('Entró S/ 500.00 · Salió S/ 300.00');
    expect(within(pending).getByText('Gimnasio · S/ 80.00 · día 5')).toBeInTheDocument();

    // Retired blocks & jargon must not exist anywhere in Resumen (FR-011, FR-036)
    expect(screen.queryByText(/Capital disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rendimiento conductual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Foco de Hoy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Terminal de control/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Resumen Ejecutivo/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-rule')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-performance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('personal-progress')).not.toBeInTheDocument();
  });

  it('renders friendly empty states when pending, debts, buckets and goal are empty', () => {
    summaryState.view = makeView({
      pending: [],
      debts: { cards: [], loans: [], informalDebts: [] },
      rule: { expectedIncome: 0, hasBuckets: false, buckets: [] },
      primaryGoal: null,
    });

    render(<Dashboard userId="u1" />);

    expect(screen.getByText('No tienes nada pendiente este mes.')).toBeInTheDocument();
    expect(
      screen.getByText('No tienes tarjetas ni préstamos. Si los tienes, agrégalos para ver cuánto debes.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Configura tu distribución 50/30/20 en Ajustes.')).toBeInTheDocument();
    expect(screen.getByTestId('primary-goal-empty')).toBeInTheDocument();
  });

  it('hides Por registrar when viewing a non-current month', () => {
    summaryState.view = makeView({ isCurrentMonth: false, pending: [] });
    render(<Dashboard userId="u1" refDate={new Date(2026, 9, 1)} />);

    expect(screen.queryByTestId('pending-registrations')).not.toBeInTheDocument();
    expect(screen.getByTestId('balance-hero')).toBeInTheDocument();
  });

  it('wires hide-amounts toggle, legacy card credit-limit action, pending actions and goal actions', async () => {
    const user = userEvent.setup();
    const onOpenQuickRecord = vi.fn();
    const onRegisterPending = vi.fn();
    const onAddCreditLimit = vi.fn();
    const onCompleteSetup = vi.fn();
    const prefill = { tab: 'expense' as const, amountCents: 8000, description: 'Gimnasio' };
    summaryState.register.mockReturnValue(prefill);
    summaryState.view = makeView({
      debts: {
        cards: [{ accountId: 'legacy-cc', name: 'Visa', owed: 40000, previousDebt: 40000, creditLimit: undefined }],
        loans: [],
        informalDebts: [],
      },
    });

    render(
      <Dashboard
        userId="u1"
        onOpenQuickRecord={onOpenQuickRecord}
        onRegisterPending={onRegisterPending}
        onAddCreditLimit={onAddCreditLimit}
        onCompleteSetup={onCompleteSetup}
      />,
    );

    await user.click(screen.getByTestId('setup-checklist-item-cards'));
    expect(onCompleteSetup).toHaveBeenCalledWith('cards');

    await user.click(screen.getByRole('button', { name: 'Descartar lista de configuración' }));
    expect(summaryState.dismissChecklist).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(summaryState.register).toHaveBeenCalledTimes(1);
    expect(onRegisterPending).toHaveBeenCalledWith(prefill);

    await user.click(screen.getByRole('button', { name: 'Omitir este mes' }));
    expect(summaryState.skip).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Agregar línea de crédito' }));
    expect(onAddCreditLimit).toHaveBeenCalledWith('legacy-cc');

    await user.click(screen.getByRole('button', { name: 'Aportar' }));
    expect(onOpenQuickRecord).toHaveBeenCalledWith('expense');

    // Toggle hide amounts -> persists and masks figures across sections
    await user.click(screen.getByRole('button', { name: 'Ocultar montos' }));
    expect(window.localStorage.getItem(HIDE_AMOUNTS_STORAGE_KEY)).toBe('1');
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('••••');
    expect(screen.queryByText(/S\/ 1,200\.00/)).not.toBeInTheDocument();
  });
});
