import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MainFlow from './MainFlow';

const { movementListMounts, syncNow, ensureDefault } = vi.hoisted(() => ({ movementListMounts: vi.fn(), syncNow: vi.fn().mockResolvedValue(undefined), ensureDefault: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../infrastructure/repositories/local/LocalPaymentAccountRepository', () => ({
  LocalPaymentAccountRepository: vi.fn(function () { return { ensureDefault }; }),
}));

vi.mock('../../infrastructure/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1', user_metadata: {} } } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    rpc: vi.fn(function () { return { then: (cb: (arg: { error: null }) => void) => cb({ error: null }) }; }),
  }),
}));

vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository', () => ({
  LocalCategoryRepository: vi.fn().mockImplementation(function () {
    return {
      getDistributionCategories: vi.fn().mockResolvedValue([{ id: 'c1' }]),
      getExpenseCategories: vi.fn().mockResolvedValue([{ id: 'e1' }]),
    };
  }),
}));

vi.mock('../../infrastructure/sync/repairOrphanedRows', () => ({ repairOrphanedLocalRows: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../infrastructure/repositories/local/LocalOnboardingRepository', () => ({ LocalOnboardingRepository: vi.fn(function () { return { progress: async () => 3 }; }) }));
vi.mock('../../infrastructure/sync/mergeDuplicateCategories', () => ({ mergeDuplicateCategories: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../infrastructure/sync/repairDanglingExpenseCategories', () => ({ repairDanglingExpenseCategories: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../hooks/useRecurrenceEvaluator', () => ({ useRecurrenceEvaluator: vi.fn() }));
vi.mock('../hooks/useSyncManager', () => ({ useSyncManager: () => ({ syncNow }) }));
vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../hooks/useNotificationEvaluator', () => ({ useNotificationEvaluator: vi.fn() }));
vi.mock('../hooks/useTaskRecurrenceEvaluator', () => ({ useTaskRecurrenceEvaluator: vi.fn() }));

vi.mock('./LoginScreen', () => ({ default: () => null }));
vi.mock('./OnboardingWizard', () => ({ default: () => null }));
vi.mock('../hooks/useHasUnreadNotifications', () => ({ useHasUnreadNotifications: () => false }));
vi.mock('./Dashboard', () => ({
  default: function MockDashboard({ refDate, onOpenQuickRecord, onNavigate }: {
    refDate?: Date;
    onOpenQuickRecord?: (tab?: string) => void;
    onNavigate?: (route: string, options?: { financesTab?: string }) => void;
  }) {
    return (
      <div>
        <span>{`DashboardStub:${refDate?.getFullYear()}-${refDate?.getMonth()}`}</span>
        <button onClick={() => onOpenQuickRecord?.('transfer')}>dashboard-quick-transfer</button>
        <button onClick={() => onOpenQuickRecord?.()}>dashboard-quick-default</button>
        <button onClick={() => onNavigate?.('finances', { financesTab: 'loans' })}>dashboard-open-loans</button>
        <button onClick={() => onNavigate?.('control')}>dashboard-open-control</button>
      </div>
    );
  },
}));
vi.mock('./SharedSpaceScreen', () => ({ default: () => null }));
vi.mock('./SharedSpaceCreate', () => ({ default: () => null }));
vi.mock('./SharedSpaceJoin', () => ({ default: () => null }));
vi.mock('./SharedMovementForm', () => ({ default: () => null }));
vi.mock('./ControlPage', () => ({
  default: function MockControlPage({ onOpenQuickRecord, onOpenProgress, focus, focusNonce, onFocusHandled }: {
    onOpenQuickRecord?: (tab?: string, kind?: string) => void;
    onOpenProgress?: () => void;
    focus?: { kind: string; id: string };
    focusNonce?: number;
    onFocusHandled?: () => void;
  }) {
    return (
      <div>
        <span>ControlStub</span>
        <span data-testid="control-focus">{focus ? `${focus.kind}:${focus.id}:${focusNonce ? 'n' : '-'}` : 'none'}</span>
        <button onClick={() => onFocusHandled?.()}>control-focus-handled</button>
        <button onClick={() => onOpenQuickRecord?.('habit', 'habit')}>control-new-habit</button>
        <button onClick={() => onOpenQuickRecord?.('habit', 'task')}>control-new-task</button>
        <button onClick={() => onOpenQuickRecord?.('goal', 'savings-goal')}>control-new-savings</button>
        <button onClick={() => onOpenQuickRecord?.('expense')}>control-allocate</button>
        <button onClick={() => onOpenProgress?.()}>control-open-progress</button>
      </div>
    );
  },
}));
vi.mock('./HabitForm', () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="habit-form" data-embedded={String(Boolean(embedded))} /> }));
vi.mock('./TaskForm', () => ({ default: () => <div data-testid="task-form" /> }));
vi.mock('./GoalForm', () => ({ default: () => <div data-testid="goal-form" /> }));
vi.mock('./SavingsGoalForm', () => ({ default: () => <div data-testid="savings-goal-form" /> }));
vi.mock('./SettingsScreen', () => ({
  default: function MockSettings({ focus, accountName, accountEmail }: { focus?: { kind: string; id: string }; accountName?: string; accountEmail?: string }) {
    return <span data-testid="settings-focus">{`${focus ? `${focus.kind}:${focus.id}` : 'none'}|${accountName ?? ''}|${accountEmail ?? ''}`}</span>;
  },
}));
vi.mock('./CommandPalette', () => ({
  default: function MockPalette({ open, onOpenChange, onNavigate, onOpenQuickRecord, gamificationVisible }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onNavigate: (route: string, options?: unknown) => void;
    onOpenQuickRecord: (tab: string, kind?: string) => void;
    gamificationVisible?: boolean;
  }) {
    if (!open) return null;
    return (
      <div role="dialog" aria-label="palette-stub" data-command-palette="">
        <span>{`palette gamification:${String(gamificationVisible)}`}</span>
        <button onClick={() => { onOpenChange(false); onNavigate('finances', { financesTab: 'movements', focus: { kind: 'movement', id: 'm1', date: new Date(2026, 2, 14) } }); }}>pick-movement</button>
        <button onClick={() => { onOpenChange(false); onNavigate('control', { focus: { kind: 'task', id: 't1' } }); }}>pick-task</button>
        <button onClick={() => { onOpenChange(false); onNavigate('settings', { focus: { kind: 'account', id: 'a1' } }); }}>pick-account</button>
        <button onClick={() => { onOpenChange(false); onOpenQuickRecord('habit', 'task'); }}>pick-new-task</button>
        <button onClick={() => onOpenChange(false)}>close-palette</button>
      </div>
    );
  },
}));
vi.mock('./NotificationHistory', () => ({ default: () => null }));

vi.mock('./Layout', () => ({
  default: function MockLayout({ children, onNavigate, onNewMovement, onShiftMonth, onOpenSearch, currentRoute }: {
    children: React.ReactNode;
    onNavigate: (route: string) => void;
    onOpenSearch?: () => void;
    onNewMovement: () => void;
    onShiftMonth: (delta: number) => void;
    currentRoute: string;
  }) {
    return (
      <div>
        <span data-testid="route">{currentRoute}</span>
        <button onClick={() => onOpenSearch?.()}>open-search</button>
        <button onClick={() => onNavigate('finances')}>go-finances</button>
        <button onClick={() => onNavigate('dashboard')}>go-dashboard</button>
        <button onClick={() => onNavigate('control')}>go-control</button>
        <button onClick={() => onNavigate('settings')}>go-settings</button>
        <button onClick={() => onShiftMonth(1)}>next-month</button>
        <button onClick={() => onShiftMonth(-1)}>previous-month</button>
        <button aria-label="Registrar nuevo movimiento" onClick={onNewMovement}>+</button>
        {children}
      </div>
    );
  },
}));

vi.mock('./FinancesScreen', () => ({
  default: function MockFinancesScreen({ refDate, initialTab, onNewMovement, movementsRefreshKey, focus, onFocusHandled }: {
    refDate?: Date;
    initialTab?: string;
    focus?: { kind: string; id: string };
    onFocusHandled?: () => void;
    onNewMovement: () => void;
    movementsRefreshKey?: number;
  }) {
    // Counts one "load" per refresh-key value: the real screen reloads its data when the shell bumps the key.
    React.useEffect(() => { movementListMounts(); }, [movementsRefreshKey]);
    return (
      <div>
        <span>{`FinancesStub:${refDate?.getFullYear()}-${refDate?.getMonth()}`}</span>
        <span>{`FinancesTab:${initialTab}`}</span>
        <span data-testid="finances-focus">{focus ? `${focus.kind}:${focus.id}` : 'none'}</span>
        <button onClick={() => onFocusHandled?.()}>finances-focus-handled</button>
        <button onClick={onNewMovement}>Nuevo Movimiento</button>
      </div>
    );
  },
}));

vi.mock('./TransferForm', () => ({
  default: function MockTransferForm({ onComplete }: { onComplete: () => void }) {
    return <button onClick={onComplete}>complete-transfer</button>;
  },
}));

vi.mock('./MovementForm', () => ({
  default: function MockMovementForm({ onComplete }: { onComplete: () => void }) {
    return <button onClick={onComplete}>complete-movement</button>;
  },
}));

const monthOf = (delta: number) => {
  const target = new Date(new Date().getFullYear(), new Date().getMonth() + delta, 1);
  return `${target.getFullYear()}-${target.getMonth()}`;
};

describe('MainFlow — reactivity wiring (US2)', () => {
  it("creating a movement bumps the Finanzas refresh key so it reloads its data immediately (FR-002)", async () => {
    const user = userEvent.setup();
    movementListMounts.mockClear();
    render(<MainFlow />);

    await user.click(await screen.findByText('go-finances'));
    await screen.findByText(/^FinancesStub/);
    expect(movementListMounts).toHaveBeenCalledTimes(1);

    const plus = await screen.findByRole('button', { name: /registrar nuevo movimiento/i });
    await user.click(plus);
    await user.click(await screen.findByText('complete-movement'));

    await waitFor(() => expect(movementListMounts).toHaveBeenCalledTimes(2));
  });

  it('opens the same movement form from the "Nuevo Movimiento" button inside Finanzas', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await user.click(await screen.findByText('go-finances'));
    await user.click(await screen.findByRole('button', { name: 'Nuevo Movimiento' }));

    expect(await screen.findByText('complete-movement')).toBeInTheDocument();
  });
});

describe('MainFlow — Nuevo Registro sheet (spec 010)', () => {
  it('opens on "Gasto" from the central "+" and closes when the movement is saved', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await user.click(await screen.findByRole('button', { name: /registrar nuevo movimiento/i }));

    expect(await screen.findByRole('dialog', { name: 'Nuevo Registro' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Gasto' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByText('complete-movement'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens on the tab requested through openQuickRecord (Inicio quick actions)', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await user.click(await screen.findByText('dashboard-quick-transfer'));
    expect(await screen.findByRole('tab', { name: 'Mover' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('complete-transfer')).toBeInTheDocument();
  });

  it('defaults to "Gasto" when openQuickRecord is called without a tab, and resets to it on every open', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await user.click(await screen.findByText('dashboard-quick-transfer'));
    await screen.findByRole('tab', { name: 'Mover' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('dashboard-quick-default'));
    expect(await screen.findByRole('tab', { name: 'Gasto' })).toHaveAttribute('aria-selected', 'true');
  });

  it('refreshes the movement list after saving a transfer', async () => {
    const user = userEvent.setup();
    movementListMounts.mockClear();
    render(<MainFlow />);
    await user.click(await screen.findByText('go-finances'));
    await screen.findByText(/^FinancesStub/);
    expect(movementListMounts).toHaveBeenCalledTimes(1);

    await user.click(await screen.findByRole('button', { name: 'Nuevo Movimiento' }));
    await user.click(await screen.findByRole('tab', { name: 'Mover' }));
    await user.click(await screen.findByText('complete-transfer'));

    await waitFor(() => expect(movementListMounts).toHaveBeenCalledTimes(2));
  });
});

describe('MainFlow — per-route document title (US3, FR-004)', () => {
  it('sets a route-specific document.title and updates it when currentRoute changes', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await waitFor(() => expect(document.title).toBe('Resumen · ez-life'));

    await user.click(await screen.findByText('go-finances'));
    await waitFor(() => expect(document.title).toBe('Finanzas · ez-life'));

    await user.click(await screen.findByText('go-control'));
    await waitFor(() => expect(document.title).toBe('Control & Hábitos · ez-life'));

    await user.click(await screen.findByText('go-settings'));
    await waitFor(() => expect(document.title).toBe('Ajustes · ez-life'));
  });
});

describe('MainFlow — shared month selector', () => {
  it('starts on the current month and passes refDate to Dashboard and Finanzas', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    expect(await screen.findByText(`DashboardStub:${monthOf(0)}`)).toBeInTheDocument();

    await user.click(screen.getByText('go-finances'));
    expect(await screen.findByText(`FinancesStub:${monthOf(0)}`)).toBeInTheDocument();
  });

  it('moves one month at a time and keeps the selection when switching routes', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await screen.findByText(`DashboardStub:${monthOf(0)}`);

    await user.click(screen.getByText('previous-month'));
    expect(await screen.findByText(`DashboardStub:${monthOf(-1)}`)).toBeInTheDocument();
    await user.click(screen.getByText('previous-month'));
    expect(await screen.findByText(`DashboardStub:${monthOf(-2)}`)).toBeInTheDocument();
    await user.click(screen.getByText('next-month'));
    expect(await screen.findByText(`DashboardStub:${monthOf(-1)}`)).toBeInTheDocument();

    await user.click(screen.getByText('go-finances'));
    expect(await screen.findByText(`FinancesStub:${monthOf(-1)}`)).toBeInTheDocument();
  });
});

describe('MainFlow — Inicio deep links', () => {
  it('opens Finanzas on the Préstamos tab from Inicio, and plain navigation goes back to Movimientos', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await user.click(await screen.findByText('dashboard-open-loans'));
    expect(screen.getByTestId('route')).toHaveTextContent('finances');
    expect(await screen.findByText('FinancesTab:loans')).toBeInTheDocument();

    await user.click(screen.getByText('go-dashboard'));
    await user.click(screen.getByText('go-finances'));
    expect(await screen.findByText('FinancesTab:movements')).toBeInTheDocument();
  });

  it('routes Inicio navigation callbacks to the shell', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByText('dashboard-open-control'));
    expect(screen.getByTestId('route')).toHaveTextContent('control');
  });

  it('does not repeat the Mi progreso row under the Inicio card (Ajustes keeps it)', async () => {
    render(<MainFlow />);
    await screen.findByText(/^DashboardStub/);
    expect(screen.queryByRole('button', { name: 'Mi progreso' })).not.toBeInTheDocument();
  });
});

describe('MainFlow — Control entry points', () => {
  async function openControl(user: ReturnType<typeof userEvent.setup>) {
    render(<MainFlow />);
    await user.click(await screen.findByText('go-control'));
    await screen.findByText('ControlStub');
  }

  it('opens "Nuevo Registro" directly on the habit, task, and savings-goal forms', async () => {
    const user = userEvent.setup();
    await openControl(user);

    await user.click(screen.getByText('control-new-habit'));
    expect(await screen.findByTestId('habit-form')).toHaveAttribute('data-embedded', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('control-new-task'));
    expect(await screen.findByTestId('task-form')).toBeInTheDocument();
    expect(screen.queryByTestId('habit-form')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('control-new-savings'));
    expect(await screen.findByTestId('savings-goal-form')).toBeInTheDocument();
  });

  it('"Asignar ahorro" opens the sheet on the expense tab and a plain "+" forgets the previous kind', async () => {
    const user = userEvent.setup();
    await openControl(user);
    await user.click(screen.getByText('control-allocate'));
    expect(await screen.findByRole('tab', { name: 'Gasto', selected: true })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('control-new-task'));
    await screen.findByTestId('task-form');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByLabelText('Registrar nuevo movimiento'));
    expect(await screen.findByRole('tab', { name: 'Gasto', selected: true })).toBeInTheDocument();
    expect(screen.queryByTestId('task-form')).not.toBeInTheDocument();
  });

  it('navigates to Mi progreso from Control and no longer wraps Control in its own heading', async () => {
    const user = userEvent.setup();
    await openControl(user);
    expect(screen.queryByRole('heading', { name: /control & hábitos/i })).not.toBeInTheDocument();
    await user.click(screen.getByText('control-open-progress'));
    expect(screen.getByTestId('route')).toHaveTextContent('progress');
  });
});

describe('MainFlow — transitional mobile entry rows', () => {
  it('offers Espacio compartido from Inicio and Ajustes, and navigates there', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await user.click(await screen.findByRole('button', { name: 'Espacio compartido' }));
    expect(screen.getByTestId('route')).toHaveTextContent('shared-space');

    await user.click(screen.getByText('go-settings'));
    await user.click(await screen.findByRole('button', { name: 'Espacio compartido' }));
    expect(screen.getByTestId('route')).toHaveTextContent('shared-space');
  });
});

describe('MainFlow — default payment account (spec 011)', () => {
  it('seeds the default "Efectivo" account for the signed-in user once the app shell is reached', async () => {
    render(<MainFlow />);
    await screen.findByText('go-finances');
    await waitFor(() => expect(ensureDefault).toHaveBeenCalledWith('user-1'));
  });
});

describe('MainFlow — ⌘K command palette (spec 010)', () => {
  it('opens with Ctrl+K once the app shell is up, and closes with the same combo', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await screen.findByText('go-finances');
    expect(screen.queryByRole('dialog', { name: 'palette-stub' })).not.toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'palette-stub' })).toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'palette-stub' })).not.toBeInTheDocument());
  });

  it('opens from the topbar search entry point and tells the palette whether gamification is shown', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByText('open-search'));
    expect(await screen.findByRole('dialog', { name: 'palette-stub' })).toBeInTheDocument();
    expect(screen.getByText(/palette gamification:/)).toBeInTheDocument();
  });

  it('does not open over another open dialog (the Nuevo Registro sheet)', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByRole('button', { name: /registrar nuevo movimiento/i }));
    await screen.findByRole('dialog', { name: 'Nuevo Registro' });
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog', { name: 'palette-stub' })).not.toBeInTheDocument();
  });

  it('sends a movement to Finanzas > Movimientos, switches to its month and hands over the focus request', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByText('open-search'));
    await user.click(await screen.findByText('pick-movement'));

    expect(await screen.findByTestId('finances-focus')).toHaveTextContent('movement:m1');
    expect(screen.getByTestId('route')).toHaveTextContent('finances');
    expect(screen.getByText('FinancesTab:movements')).toBeInTheDocument();
    expect(screen.getByText('FinancesStub:2026-2')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'palette-stub' })).not.toBeInTheDocument();

    await user.click(screen.getByText('finances-focus-handled'));
    expect(screen.getByTestId('finances-focus')).toHaveTextContent('none');
  });

  it('sends a task to Control with the focus request, and a plain navigation drops it', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByText('open-search'));
    await user.click(await screen.findByText('pick-task'));
    expect(await screen.findByTestId('control-focus')).toHaveTextContent(/^task:t1:n$/);

    await user.click(screen.getByText('go-dashboard'));
    await user.click(screen.getByText('go-control'));
    expect(await screen.findByTestId('control-focus')).toHaveTextContent('none');
  });

  it('does not hand a control focus to Finanzas', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByText('open-search'));
    await user.click(await screen.findByText('pick-task'));
    await screen.findByTestId('control-focus');
    await user.click(screen.getByText('go-finances'));
    expect(await screen.findByTestId('finances-focus')).toHaveTextContent('none');
  });

  it('sends an account to Ajustes with the focus request', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByText('open-search'));
    await user.click(await screen.findByText('pick-account'));
    expect(await screen.findByTestId('settings-focus')).toHaveTextContent('account:a1');
  });

  it('opens the Nuevo Registro sheet on the requested sub-form from a palette action', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);
    await user.click(await screen.findByText('open-search'));
    await user.click(await screen.findByText('pick-new-task'));
    expect(await screen.findByTestId('task-form')).toBeInTheDocument();
  });
});
