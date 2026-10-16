'use client';
import PersonalProgress from './PersonalProgress';
import { usePersonalProgress } from '../hooks/usePersonalProgress';

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
import { useTaskRecurrenceEvaluator } from '../hooks/useTaskRecurrenceEvaluator';
import { observeAccountSession } from '../../infrastructure/auth/observeAccountSession';
import { forgetLocalAccount } from '../../infrastructure/auth/localAccount';

// Shared chrome for the app's dialogs (movement form, goal form,
// notification history) — always centered on the viewport, never a
// bottom sheet, with a single padding layer (the form/list content
// inside renders chrome-less so it doesn't double up with this).
const SHEET_DIALOG_CONTENT_CLASS =
  'bg-card max-w-md rounded-xl border border-border p-5 shadow-xl max-h-[85vh] overflow-y-auto sm:p-6';

// FR-004: per-page browser tab titles. The app has a single real Next.js
// route (`src/app/page.tsx`) — every "page" below is client-side routing
// inside this component's `currentRoute` state, so Next.js's file-based
// `generateMetadata` can't produce a per-page title (research.md §1). This
// mutates `document.title` directly instead, keyed off `currentRoute`.
const routeTitles: Record<string, string> = {
  progress: 'Mi progreso',
  dashboard: 'Resumen',
  movements: 'Historial',
  analysis: 'Análisis',
  goals: 'Mis Metas',
  debts: 'Préstamos',
  'shared-space': 'Espacio Compartido',
  control: 'Control',
  create: 'Crear',
  settings: 'Ajustes',
};

export default function MainFlow() {
  const [step, setStep] = useState<'loading' | 'login' | 'onboarding-wizard' | 'app'>('loading');
  const [wizardStartStep, setWizardStartStep] = useState<1 | 2 | 3>(1);
  const [wizardMode, setWizardMode] = useState<'setup' | 'settings'>('setup');
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementsRefreshKey, setMovementsRefreshKey] = useState(0);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalsRefreshKey, setGoalsRefreshKey] = useState(0);
  // FR-003: shared between the 'create' and 'control' routes — a habit/task
  // saved from CreatePage bumps the counter ControlPage forwards as `key` to
  // its own HabitList/TaskList, same refresh-by-key pattern as goalsRefreshKey.
  const [habitsRefreshKey, setHabitsRefreshKey] = useState(0);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  // FR-003: same pattern, dedicated to the generic Goal checklist/numeric
  // entity shown in Control's GoalList/GoalDashboard — distinct from
  // `goalsRefreshKey` above, which belongs to the unrelated SavingsGoal
  // ("Metas de Ahorro") route.
  const [goalsControlRefreshKey, setGoalsControlRefreshKey] = useState(0);
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
  const celebration = useNotificationEvaluator(profileId);
  const progress = usePersonalProgress(profileId ?? '');
  useTaskRecurrenceEvaluator(profileId);
  const isOnline = useOnlineStatus();

  React.useEffect(() => {
    document.title = routeTitles[currentRoute]
      ? `${routeTitles[currentRoute]} · ez-life`
      : 'ez-life';
  }, [currentRoute]);

  React.useEffect(() => observeAccountSession(syncNow, state => {
    setProfileId(state.account?.id ?? null);
    setAvatarUrl(state.account?.avatarUrl);
    setWizardStartStep(state.startStep);
    setWizardMode('setup');
    setStep(!state.account ? 'login' : state.completed ? 'app' : 'onboarding-wizard');
  }), [syncNow]);

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">

          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (step === 'login') {
    return <LoginScreen />;
  }

  if (step === 'onboarding-wizard') {
    return (
      <OnboardingWizard
        profileId={profileId ?? ''}
        startStep={wizardStartStep}
        mode={wizardMode}
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
      gamificationEnabled={progress.visible}
      currentRoute={currentRoute}
      onNavigate={setCurrentRoute}
      onOpenMore={() => setShowMoreDrawer(true)}
      onNewMovement={() => setShowMovementForm(true)}
      avatarUrl={avatarUrl}
      onLogout={() => { forgetLocalAccount(); setProfileId(null); setAvatarUrl(undefined); setStep('login'); }}
      onOpenNotifications={() => setShowNotifications(true)}
    >
      <MoreDrawer
        overflowNavItems={overflowNavItems.filter(item => item.id !== 'progress' || progress.visible)}
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        open={showMoreDrawer}
        onOpenChange={setShowMoreDrawer}
      />
      <div className="p-5 space-y-6">
        {!isOnline && <p role="status" className="text-sm text-muted-foreground">Sin conexión · tus cambios se guardan en este dispositivo.</p>}
        {/* Mobile header */}
        <header className="flex justify-between items-center py-2 md:hidden">
          <div className="flex items-center gap-2">

            <h1 className="text-2xl font-extrabold text-foreground tracking-tight font-heading">ez-life</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(true)}
              aria-label="Ver notificaciones"
              className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
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
          <Dashboard userId={profileId} onOpenProgress={() => setCurrentRoute('progress')} />
        )}

        {currentRoute === 'progress' && profileId && <PersonalProgress userId={profileId} />}
        {celebration && progress.visible && <div role="status" className="fixed top-4 left-4 right-4 md:left-auto md:w-80 z-50 bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold">Un nuevo logro personal</p><button className="text-sm text-primary min-h-11" onClick={() => setCurrentRoute('progress')}>Ver mi progreso</button>
        </div>}

        {currentRoute === 'movements' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Historial</h2>
            </div>
            <MovementList key={movementsRefreshKey} userId={profileId} />
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
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">Préstamos</h2>
              <div className="flex flex-wrap gap-2">
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
            <ControlPage
              userId={profileId}
              habitsRefreshKey={habitsRefreshKey}
              tasksRefreshKey={tasksRefreshKey}
              goalsControlRefreshKey={goalsControlRefreshKey}
            />
          </div>
        )}

        {currentRoute === 'create' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Crear</h2>
            </div>
            <CreatePage
              userId={profileId}
              onHabitSaved={() => setHabitsRefreshKey(k => k + 1)}
              onTaskSaved={() => setTasksRefreshKey(k => k + 1)}
              onGoalSaved={() => setGoalsControlRefreshKey(k => k + 1)}
            />
          </div>
        )}

        {currentRoute === 'settings' && profileId && (
          <SettingsScreen
            userId={profileId}
            onEditDistribution={() => { setWizardMode('settings'); setWizardStartStep(2); setStep('onboarding-wizard'); }}
            onEditCategories={() => { setWizardMode('settings'); setWizardStartStep(3); setStep('onboarding-wizard'); }}
            onLogout={() => { forgetLocalAccount(); setProfileId(null); setAvatarUrl(undefined); setStep('login'); }}
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
              className="bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-none hover:bg-primary/90 transition-colors active:scale-95"
            >
              <span className="text-2xl font-light leading-none">+</span>
            </button>
          </div>

          <Dialog open={showMovementForm} onOpenChange={(open) => !open && setShowMovementForm(false)}>
            <DialogContent className={SHEET_DIALOG_CONTENT_CLASS}>
              <MovementForm
                userId={profileId}
                onComplete={() => {
                  setShowMovementForm(false);
                  setMovementsRefreshKey(k => k + 1);
                }}
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
