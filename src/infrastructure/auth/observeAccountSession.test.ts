import { beforeEach, it, expect, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { observeAccountSession } from './observeAccountSession';
import { rememberLocalAccount, getLocalAccount, forgetLocalAccount } from './localAccount';
const mock = vi.hoisted(() => ({ getSession: vi.fn(), unsubscribe: vi.fn(), callback: null as null | ((event: string, session: { user: { id: string; user_metadata: object } } | null) => void) }));
vi.mock('../supabase/client', () => ({ getSupabaseBrowserClient: () => ({
  rpc: async () => ({ error: null }), auth: { getSession: mock.getSession,
    onAuthStateChange: (callback: typeof mock.callback) => { mock.callback = callback; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; },
  },
}) }));
vi.mock('../repositories/local/LocalCategoryRepository', () => ({ LocalCategoryRepository: vi.fn(function () {
  return { getDistributionCategories: async () => [{ id: 'bucket' }], getExpenseCategories: async () => [{ id: 'category' }] };
}) }));
vi.mock('../repositories/local/LocalOnboardingRepository', () => ({ LocalOnboardingRepository: vi.fn(function () { return { progress: async () => 3 }; }) }));
const session = (id: string) => ({ user: { id, user_metadata: {} } });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mock.getSession.mockResolvedValue({ data: { session: session('A') } }); });
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
