'use client';

import React, { useState } from 'react';
import LoginScreen from './LoginScreen';
import OnboardingWizard from './OnboardingWizard';
import Layout from './Layout';
import MoreDrawer from './MoreDrawer';
import { overflowNavItems } from './BottomNav';
import Dashboard from './Dashboard';
import MovementList from './MovementList';
import MovementForm from './MovementForm';
import SavingsGoalList from './SavingsGoalList';
import SavingsGoalForm from './SavingsGoalForm';
import DebtList from './DebtList';
import DebtForm from './DebtForm';
import InstallmentLoanList from './InstallmentLoanList';
import InstallmentLoanForm from './InstallmentLoanForm';
import SharedSpaceScreen from './SharedSpaceScreen';
import SharedSpaceCreate from './SharedSpaceCreate';
import SharedSpaceJoin from './SharedSpaceJoin';
import SharedMovementForm from './SharedMovementForm';
import ControlPage from './ControlPage';
import CreatePage from './CreatePage';
import AnalysisScreen from './AnalysisScreen';
import { Membership } from '../../core/domain/models/types';
import SettingsScreen from './SettingsScreen';
import NotificationHistory from './NotificationHistory';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Bell } from 'lucide-react';
import { useRecurrenceEvaluator } from '../hooks/useRecurrenceEvaluator';
import { useSyncManager } from '../hooks/useSyncManager';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useNotificationEvaluator } from '../hooks/useNotificationEvaluator';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { repairOrphanedLocalRows } from '../../infrastructure/sync/repairOrphanedRows';
import { mergeDuplicateCategories } from '../../infrastructure/sync/mergeDuplicateCategories';
import { repairDanglingExpenseCategories } from '../../infrastructure/sync/repairDanglingExpenseCategories';

// Shared chrome for the app's dialogs (movement form, goal form,
// notification history) — always centered on the viewport, never a
// bottom sheet, with a single padding layer (the form/list content
// inside renders chrome-less so it doesn't double up with this).
const SHEET_DIALOG_CONTENT_CLASS =
  'bg-card max-w-md rounded-2xl border border-border p-5 shadow-xl max-h-[85vh] overflow-y-auto sm:p-6';

export default function MainFlow() {
  const [step, setStep] = useState<'loading' | 'login' | 'onboarding-wizard' | 'app'>('loading');
  const [wizardStartStep, setWizardStartStep] = useState<1 | 2 | 3>(1);
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalsRefreshKey, setGoalsRefreshKey] = useState(0);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtsRefreshKey, setDebtsRefreshKey] = useState(0);
  const [showInstallmentLoanForm, setShowInstallmentLoanForm] = useState(false);
  const [installmentLoansRefreshKey, setInstallmentLoansRefreshKey] = useState(0);
  const [showSharedSpaceCreate, setShowSharedSpaceCreate] = useState(false);
  const [showSharedSpaceJoin, setShowSharedSpaceJoin] = useState(false);
  const [sharedSpacesRefreshKey, setSharedSpacesRefreshKey] = useState(0);
  const [addMovementTarget, setAddMovementTarget] = useState<{ spaceId: string; members: Membership[] } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [showNotifications, setShowNotifications] = useState(false);

  // Background Jobs
  useRecurrenceEvaluator(profileId);
  const { syncNow } = useSyncManager();
  useNotificationEvaluator(profileId);
  const isOnline = useOnlineStatus();

  React.useEffect(() => {
    import('../../infrastructure/supabase/client').then(({ getSupabaseBrowserClient }) => {
      const supabase = getSupabaseBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkSessionAndCategories = async (session: any) => {
        if (session?.user) {
          const userId = session.user.id;
          setProfileId(userId);
          // Read avatar from OAuth metadata (Google / GitHub)
          const avatar = session.user.user_metadata?.avatar_url as string | undefined;
          setAvatarUrl(avatar);

          // Explicit, app-triggered enrollment (never a trigger on
          // auth.users, never a client-side insert) — this is what actually
          // makes this authenticated session an ez-life *member*, not just
          // an authenticated mvp-lab fleet user (Principio IX). Idempotent
          // server-side; best-effort here since it needs connectivity and
          // must never block offline-first local usage if it fails.
          supabase.rpc('enroll_self').then(({ error }: { error: unknown }) => {
            if (error) console.error('enroll_self failed:', error);
          });

          try {
            // Repair any local rows orphaned by the old onboarding bug (a
            // stale random user_id instead of the real session id) BEFORE
            // deciding whether this device needs the wizard — otherwise
            // already-completed onboarding data stays invisible to this
            // check forever. Then wait for the initial pull to actually
            // finish before reading local state, so a genuinely new device
            // gets a chance to receive existing data first instead of the
            // wizard being triggered from a still-empty local DB.
            await repairOrphanedLocalRows(userId);
            await syncNow();

            // Merge duplicate default categories left over from repeated
            // onboarding runs across devices/sessions while sync was broken
            // (see repairOrphanedLocalRows above) — after the pull above, so
            // it sees whatever the server already has. Then, on the
            // now-consolidated bucket set, repair any expense category whose
            // distribution_category_id is missing/dangling (a separate
            // historical seeding bug — same root cause: it never used to
            // reach Supabase, so nothing caught it). Sync once more so both
            // corrections push out right away.
            await mergeDuplicateCategories(userId);
            await repairDanglingExpenseCategories(userId);
            await syncNow();

            const catRepo = new LocalCategoryRepository();
            const cats = await catRepo.getDistributionCategories(userId);
            const expCats = await catRepo.getExpenseCategories(userId);

            if (cats.length === 0) {
              setWizardStartStep(1);
              setStep('onboarding-wizard');
            } else if (expCats.length === 0) {
              setWizardStartStep(3);
              setStep('onboarding-wizard');
            } else {
              setStep('app');
            }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_e) {
            setStep('app');
          }
        } else {
          setProfileId(null);
          setAvatarUrl(undefined);
          setStep('login');
        }
      };

      supabase.auth.getSession().then(({ data: { session } }) => {
        checkSessionAndCategories(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          checkSessionAndCategories(session);
        } else {
          setProfileId(null);
          setAvatarUrl(undefined);
          setStep('login');
        }
      });

      return () => subscription.unsubscribe();
    });
  }, [syncNow]);

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-pulse">🌿</span>
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (step === 'login') {
    return <LoginScreen />;
  }

  if (step === 'onboarding-wizard' && !isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center space-y-2">
          <p className="text-base font-medium text-destructive">
            Necesitás conexión a internet para completar la configuración inicial.
          </p>
          <p className="text-sm text-destructive">
            Tu progreso está guardado — apenas vuelva la conexión podés continuar donde quedaste.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'onboarding-wizard') {
    return (
      <OnboardingWizard
        profileId={profileId ?? ''}
        startStep={wizardStartStep}
        onComplete={(finalProfileId) => {
          setProfileId(finalProfileId);
          setStep('app');
        }}
      />
    );
  }

  // App Shell
  return (
    <Layout
      currentRoute={currentRoute}
      onNavigate={setCurrentRoute}
      onOpenMore={() => setShowMoreDrawer(true)}
      onNewMovement={() => setShowMovementForm(true)}
      avatarUrl={avatarUrl}
      onLogout={() => setStep('login')}
      onOpenNotifications={() => setShowNotifications(true)}
    >
      <MoreDrawer
        overflowNavItems={overflowNavItems}
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        open={showMoreDrawer}
        onOpenChange={setShowMoreDrawer}
      />
      <div className="p-5 space-y-6">
        {/* Mobile header */}
        <header className="flex justify-between items-center py-2 md:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight font-heading">ez-life</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(true)}
              aria-label="Ver notificaciones"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <Bell className="w-4 h-4" />
            </button>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Foto de perfil"
                className="w-8 h-8 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                U
              </div>
            )}
          </div>
        </header>

        {currentRoute === 'dashboard' && profileId && (
          <Dashboard userId={profileId} />
        )}

        {currentRoute === 'movements' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Historial</h2>
            </div>
            <MovementList userId={profileId} />
          </div>
        )}

        {currentRoute === 'analysis' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Análisis</h2>
            </div>
            <AnalysisScreen userId={profileId} />
          </div>
        )}

        {currentRoute === 'goals' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Mis Metas</h2>
              <Button size="sm" onClick={() => setShowGoalForm(true)}>
                + Nueva meta
              </Button>
            </div>
            <SavingsGoalList key={goalsRefreshKey} userId={profileId} />
          </div>
        )}

        {currentRoute === 'debts' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">Préstamos</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowInstallmentLoanForm(true)}>
                  + Con cuotas
                </Button>
                <Button size="sm" onClick={() => setShowDebtForm(true)}>
                  + Nuevo préstamo
                </Button>
              </div>
            </div>
            <InstallmentLoanList key={installmentLoansRefreshKey} userId={profileId} />
            <DebtList key={debtsRefreshKey} userId={profileId} />
          </div>
        )}

        {currentRoute === 'shared-space' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Espacio Compartido</h2>
            </div>
            <SharedSpaceScreen
              userId={profileId}
              refreshKey={sharedSpacesRefreshKey}
              onCreate={() => setShowSharedSpaceCreate(true)}
              onJoin={() => setShowSharedSpaceJoin(true)}
              onAddMovement={(spaceId, members) => setAddMovementTarget({ spaceId, members })}
            />
          </div>
        )}

        {currentRoute === 'control' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Control</h2>
            </div>
            <ControlPage userId={profileId} />
          </div>
        )}

        {currentRoute === 'create' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Crear</h2>
            </div>
            <CreatePage userId={profileId} />
          </div>
        )}

        {currentRoute === 'settings' && profileId && (
          <SettingsScreen
            userId={profileId}
            onEditDistribution={() => { setWizardStartStep(2); setStep('onboarding-wizard'); }}
            onEditCategories={() => { setWizardStartStep(3); setStep('onboarding-wizard'); }}
            onLogout={() => setStep('login')}
          />
        )}
      </div>

      {/* FAB — mobile only, visible on all routes except settings */}
      {currentRoute !== 'settings' && profileId && (
        <>
          <div className="fixed bottom-[4.5rem] right-5 z-50 md:hidden">
            <button
              onClick={() => setShowMovementForm(true)}
              aria-label="Registrar nuevo movimiento"
              className="bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors active:scale-95"
            >
              <span className="text-2xl font-light leading-none">+</span>
            </button>
          </div>

          <Dialog open={showMovementForm} onOpenChange={(open) => !open && setShowMovementForm(false)}>
            <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
              <MovementForm
                userId={profileId}
                onComplete={() => setShowMovementForm(false)}
                onCancel={() => setShowMovementForm(false)}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {profileId && (
        <Dialog open={showGoalForm} onOpenChange={(open) => !open && setShowGoalForm(false)}>
          <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
            <SavingsGoalForm
              userId={profileId}
              onComplete={() => {
                setShowGoalForm(false);
                setGoalsRefreshKey(k => k + 1);
              }}
              onCancel={() => setShowGoalForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {profileId && (
        <Dialog open={showInstallmentLoanForm} onOpenChange={(open) => !open && setShowInstallmentLoanForm(false)}>
          <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
            <InstallmentLoanForm
              userId={profileId}
              onComplete={() => {
                setShowInstallmentLoanForm(false);
                setInstallmentLoansRefreshKey(k => k + 1);
              }}
              onCancel={() => setShowInstallmentLoanForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {profileId && (
        <Dialog open={showDebtForm} onOpenChange={(open) => !open && setShowDebtForm(false)}>
          <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
            <DebtForm
              userId={profileId}
              onComplete={() => {
                setShowDebtForm(false);
                setDebtsRefreshKey(k => k + 1);
              }}
              onCancel={() => setShowDebtForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {profileId && (
        <Dialog open={showSharedSpaceCreate} onOpenChange={(open) => !open && setShowSharedSpaceCreate(false)}>
          <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
            <SharedSpaceCreate
              onComplete={() => {
                setShowSharedSpaceCreate(false);
                setSharedSpacesRefreshKey(k => k + 1);
              }}
              onCancel={() => setShowSharedSpaceCreate(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {profileId && (
        <Dialog open={showSharedSpaceJoin} onOpenChange={(open) => !open && setShowSharedSpaceJoin(false)}>
          <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
            <SharedSpaceJoin
              onComplete={() => {
                setShowSharedSpaceJoin(false);
                setSharedSpacesRefreshKey(k => k + 1);
              }}
              onCancel={() => setShowSharedSpaceJoin(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {profileId && addMovementTarget && (
        <Dialog open={!!addMovementTarget} onOpenChange={(open) => !open && setAddMovementTarget(null)}>
          <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
            <SharedMovementForm
              spaceId={addMovementTarget.spaceId}
              currentUserId={profileId}
              members={addMovementTarget.members}
              onComplete={() => {
                setAddMovementTarget(null);
                setSharedSpacesRefreshKey(k => k + 1);
              }}
              onCancel={() => setAddMovementTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {profileId && (
        <Dialog open={showNotifications} onOpenChange={(open) => !open && setShowNotifications(false)}>
          <DialogContent showCloseButton={false} className={SHEET_DIALOG_CONTENT_CLASS}>
            <NotificationHistory
              userId={profileId}
              onClose={() => setShowNotifications(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
