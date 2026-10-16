import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MainFlow from './MainFlow';

const { movementListMounts, syncNow } = vi.hoisted(() => ({ movementListMounts: vi.fn(), syncNow: vi.fn().mockResolvedValue(undefined) }));

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
vi.mock('./MoreDrawer', () => ({ default: () => null }));
vi.mock('./BottomNav', () => ({ overflowNavItems: [] }));
vi.mock('./Dashboard', () => ({ default: () => null }));
vi.mock('./SavingsGoalList', () => ({ default: () => null }));
vi.mock('./SavingsGoalForm', () => ({ default: () => null }));
vi.mock('./DebtList', () => ({ default: () => null }));
vi.mock('./DebtForm', () => ({ default: () => null }));
vi.mock('./InstallmentLoanList', () => ({ default: () => null }));
vi.mock('./InstallmentLoanForm', () => ({ default: () => null }));
vi.mock('./SharedSpaceScreen', () => ({ default: () => null }));
vi.mock('./SharedSpaceCreate', () => ({ default: () => null }));
vi.mock('./SharedSpaceJoin', () => ({ default: () => null }));
vi.mock('./SharedMovementForm', () => ({ default: () => null }));
vi.mock('./ControlPage', () => ({ default: () => null }));
vi.mock('./CreatePage', () => ({ default: () => null }));
vi.mock('./AnalysisScreen', () => ({ default: () => null }));
vi.mock('./SettingsScreen', () => ({ default: () => null }));
vi.mock('./NotificationHistory', () => ({ default: () => null }));

vi.mock('./Layout', () => ({
  default: function MockLayout({ children, onNavigate }: { children: React.ReactNode; onNavigate: (route: string) => void }) {
    return (
      <div>
        <button onClick={() => onNavigate('movements')}>go-movements</button>
        {children}
      </div>
    );
  },
}));

vi.mock('./MovementList', () => ({
  default: function MockMovementList() {
    React.useEffect(() => { movementListMounts(); }, []);
    return <div>MovementListStub</div>;
  },
}));

vi.mock('./MovementForm', () => ({
  default: function MockMovementForm({ onComplete }: { onComplete: () => void }) {
    return <button onClick={onComplete}>complete-movement</button>;
  },
}));

describe('MainFlow — reactivity wiring (US2)', () => {
  it("creating a movement bumps MovementList's refresh key, remounting it to refetch immediately (FR-002)", async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await user.click(await screen.findByText('go-movements'));
    await screen.findByText('MovementListStub');
    expect(movementListMounts).toHaveBeenCalledTimes(1);

    const fab = await screen.findByRole('button', { name: /registrar nuevo movimiento/i });
    await user.click(fab);
    await user.click(await screen.findByText('complete-movement'));

    await waitFor(() => expect(movementListMounts).toHaveBeenCalledTimes(2));
  });
});

describe('MainFlow — per-route document title (US3, FR-004)', () => {
  it('sets a route-specific document.title and updates it when currentRoute changes', async () => {
    const user = userEvent.setup();
    render(<MainFlow />);

    await waitFor(() => expect(document.title).toBe('Resumen · ez-life'));

    await user.click(await screen.findByText('go-movements'));

    await waitFor(() => expect(document.title).toBe('Historial · ez-life'));
  });
});
