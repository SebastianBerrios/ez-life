import { beforeEach, it, expect, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { observeAccountSession } from './observeAccountSession';
import { rememberLocalAccount, getLocalAccount, forgetLocalAccount } from './localAccount';
const mock = vi.hoisted(() => ({
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
  progress: vi.fn<() => Promise<number>>().mockResolvedValue(6),
  callback: null as null | ((event: string, session: { user: { id: string; user_metadata: object } } | null) => void),
}));
vi.mock('../supabase/client', () => ({ getSupabaseBrowserClient: () => ({
  rpc: async () => ({ error: null }), auth: { getSession: mock.getSession,
    onAuthStateChange: (callback: typeof mock.callback) => { mock.callback = callback; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; },
  },
}) }));
vi.mock('../repositories/local/LocalCategoryRepository', () => ({ LocalCategoryRepository: vi.fn(function () {
  return { getDistributionCategories: async () => [{ id: 'bucket' }], getExpenseCategories: async () => [{ id: 'category' }] };
}) }));
vi.mock('../repositories/local/LocalOnboardingRepository', () => ({ LocalOnboardingRepository: vi.fn(function () { return { progress: mock.progress }; }) }));
const session = (id: string) => ({ user: { id, user_metadata: {} } });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mock.progress.mockResolvedValue(6); mock.getSession.mockResolvedValue({ data: { session: session('A') } }); });
it('unsubscribes synchronously and discards a late initial session after unmount', async () => {
  let resolve: (value: unknown) => void = () => {};
  mock.getSession.mockImplementation(() => new Promise(done => { resolve = done; }));
  const listener = vi.fn(); const dispose = observeAccountSession(async () => {}, listener); dispose();
  resolve({ data: { session: session('A') } }); await Promise.resolve(); await Promise.resolve();
  expect(mock.unsubscribe).toHaveBeenCalledOnce(); expect(listener).not.toHaveBeenCalled();
});
it('prevents a late initial A session from replacing a newly selected B account', async () => {
  let resolve: (value: unknown) => void = () => {};
  mock.getSession.mockImplementation(() => new Promise(done => { resolve = done; }));
  const listener = vi.fn(); const dispose = observeAccountSession(async () => {}, listener);
  mock.callback?.('SIGNED_IN', session('B')); await waitFor(() => expect(listener).toHaveBeenCalled());
  resolve({ data: { session: session('A') } }); await Promise.resolve(); await Promise.resolve();
  expect(getLocalAccount()?.id).toBe('B'); expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ account: { id: 'B', avatarUrl: undefined } })); dispose();
});
it('opens a previously selected account offline and logout clears only the selection', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  rememberLocalAccount({ id: 'A' }); const listener = vi.fn(); const sync = vi.fn();
  const dispose = observeAccountSession(sync, listener);
  await waitFor(() => expect(listener).toHaveBeenCalled()); expect(mock.getSession).not.toHaveBeenCalled(); expect(sync).not.toHaveBeenCalled();
  forgetLocalAccount(); expect(getLocalAccount()).toBeNull(); dispose(); vi.restoreAllMocks();
});
it('maps progress 6 (including v1 step 3) to completed=true, and progress 5 (v1 step 2) to step 6 Categorías', async () => {
  mock.progress.mockResolvedValueOnce(6);
  const listenerDone = vi.fn();
  const d1 = observeAccountSession(async () => {}, listenerDone);
  await waitFor(() => expect(listenerDone).toHaveBeenCalledWith(expect.objectContaining({ completed: true, startStep: 6 })));
  d1();

  mock.progress.mockResolvedValueOnce(5);
  const listenerResume = vi.fn();
  const d2 = observeAccountSession(async () => {}, listenerResume);
  await waitFor(() => expect(listenerResume).toHaveBeenCalledWith(expect.objectContaining({ completed: false, startStep: 6 })));
  d2();

  mock.progress.mockResolvedValueOnce(1);
  const listenerStep2 = vi.fn();
  const d3 = observeAccountSession(async () => {}, listenerStep2);
  await waitFor(() => expect(listenerStep2).toHaveBeenCalledWith(expect.objectContaining({ completed: false, startStep: 2 })));
  d3();
});

it('reports syncError instead of starting onboarding when initial sync fails on a fresh device, while keeping existing local users working', async () => {
  mock.progress.mockResolvedValueOnce(0);
  const listenerFreshFail = vi.fn();
  const d1 = observeAccountSession(async () => false, listenerFreshFail);
  await waitFor(() => expect(listenerFreshFail).toHaveBeenCalledWith(expect.objectContaining({
    completed: false,
    syncError: true,
  })));
  d1();

  mock.progress.mockResolvedValueOnce(6);
  const listenerExistingFail = vi.fn();
  const d2 = observeAccountSession(async () => false, listenerExistingFail);
  await waitFor(() => expect(listenerExistingFail).toHaveBeenCalledWith(expect.objectContaining({
    completed: true,
    syncError: false,
  })));
  d2();
});
