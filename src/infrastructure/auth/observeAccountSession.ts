import { getSupabaseBrowserClient } from '../supabase/client';
import { LocalOnboardingRepository } from '../repositories/local/LocalOnboardingRepository';
import { getLocalAccount, rememberLocalAccount, forgetLocalAccount, type LocalAccount } from './localAccount';

export interface AccountState { account: LocalAccount | null; startStep: 1 | 2 | 3; completed: boolean }
/** Async setup has an immediate cleanup boundary; callbacks never await under the auth lock. */
export function observeAccountSession(syncNow: () => Promise<void>, listener: (state: AccountState) => void): () => void {
  const supabase = getSupabaseBrowserClient();
  let disposed = false;
  let generation = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  async function apply(account: LocalAccount | null, remote: boolean) {
    const version = ++generation;
    if (!account) { if (!disposed) listener({ account: null, startStep: 1, completed: false }); return; }
    if (remote) rememberLocalAccount(account);
    if (remote && navigator.onLine) {
      try {
        const { error } = await supabase.rpc('enroll_self');
        if (error) console.error('enroll_self failed:', error);
        await syncNow();
      } catch (error) { console.error('Initial sync failed:', error); }
    }
    const progress = await new LocalOnboardingRepository().progress(account.id);
    if (disposed || version !== generation || getLocalAccount()?.id !== account.id) return;
    listener({ account, startStep: progress === 0 ? 1 : progress === 1 ? 2 : 3, completed: progress === 3 });
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') return;
    if (event === 'SIGNED_OUT' && navigator.onLine) { forgetLocalAccount(); generation++; }
    const eventVersion = ++generation;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (disposed || eventVersion !== generation) return;
      void apply(session?.user ? { id: session.user.id, avatarUrl: session.user.user_metadata?.avatar_url } : getLocalAccount(), Boolean(session?.user));
    }, 0);
    timers.add(timer);
  });
  const check = async () => {
    const checkVersion = ++generation;
    if (!navigator.onLine && getLocalAccount()) { await apply(getLocalAccount(), false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (disposed || checkVersion !== generation) return;
    await apply(session?.user ? { id: session.user.id, avatarUrl: session.user.user_metadata?.avatar_url } : getLocalAccount(), Boolean(session?.user));
  };
  void check().catch(error => { console.error('Session check failed:', error); void apply(getLocalAccount(), false); });
  window.addEventListener('online', check);
  return () => { disposed = true; generation++; subscription.unsubscribe(); timers.forEach(clearTimeout); window.removeEventListener('online', check); };
}
