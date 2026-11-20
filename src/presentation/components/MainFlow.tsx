'use client';
import PersonalProgress from './PersonalProgress';
import { usePersonalProgress } from '../hooks/usePersonalProgress';

import React, { useCallback, useState } from 'react';
import LoginScreen from './LoginScreen';
import OnboardingWizard, { type WizardStepNumber } from './OnboardingWizard';
import Layout from './Layout';
import Dashboard from './Dashboard';
import QuickRecordSheet, { type QuickRecordKind, type QuickRecordSavedKind, type QuickRecordTab } from './QuickRecordSheet';
import type { RegistrationPrefill } from '../../core/use-cases/buildRegistrationPrefill';
import FinancesScreen, { type FinancesTab } from './FinancesScreen';
import MobileRouteLinks from './MobileRouteLinks';
import { FORM_DIALOG_CONTENT_CLASS } from './dialogChrome';
import SharedSpaceScreen from './SharedSpaceScreen';
import SharedSpaceCreate from './SharedSpaceCreate';
import SharedSpaceJoin from './SharedSpaceJoin';
import SharedMovementForm from './SharedMovementForm';
import ControlPage from './ControlPage';
import { Membership, type SetupChecklistKey } from '../../core/domain/models/types';
import SettingsScreen from './SettingsScreen';
import NotificationHistory from './NotificationHistory';
import GuidedTour from './summary/GuidedTour';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CommandPalette from './CommandPalette';
import { isAccountFocus, isControlFocus, isMovementFocus, type FocusTarget, type NavigateOptions } from '../../core/use-cases/paletteCommand';
import { buildSetupChecklist } from '../../core/use-cases/buildSetupChecklist';
import { useHotkey } from '../hooks/useHotkey';
import { useGuidedTour } from '../hooks/useGuidedTour';
import { shiftMonth } from '../../core/use-cases/calendar';
import { useHasUnreadNotifications } from '../hooks/useHasUnreadNotifications';
import { useSyncManager } from '../hooks/useSyncManager';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useNotificationEvaluator } from '../hooks/useNotificationEvaluator';
import { useTaskRecurrenceEvaluator } from '../hooks/useTaskRecurrenceEvaluator';
import { observeAccountSession } from '../../infrastructure/auth/observeAccountSession';
import { forgetLocalAccount } from '../../infrastructure/auth/localAccount';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalMovementRecurrenceRepository } from '../../infrastructure/repositories/local/LocalMovementRecurrenceRepository';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalRegistrationRepository } from '../../infrastructure/repositories/local/LocalRegistrationRepository';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';

// FR-004: per-page browser tab titles. The app has a single real Next.js
// route (`src/app/page.tsx`) — every "page" below is client-side routing
// inside this component's `currentRoute` state, so Next.js's file-based
// `generateMetadata` can't produce a per-page title (research.md §1). This
// mutates `document.title` directly instead, keyed off `currentRoute`.
const SETUP_STEP_BY_KEY: Record<SetupChecklistKey, WizardStepNumber> = {
  income: 1,
  accounts: 2,
  cards: 3,
  loans: 4,
};

const routeTitles: Record<string, string> = {
  progress: 'Mi progreso',
  dashboard: 'Resumen',
  finances: 'Finanzas',
  'shared-space': 'Espacio compartido',
  control: 'Control y hábitos',
  settings: 'Ajustes',
};

export default function MainFlow() {
  const [step, setStep] = useState<'loading' | 'login' | 'sync-error' | 'onboarding-wizard' | 'app'>('loading');
  const [sessionRetryKey, setSessionRetryKey] = useState(0);
  const [wizardStartStep, setWizardStartStep] = useState<WizardStepNumber>(1);
  const [wizardMode, setWizardMode] = useState<'setup' | 'settings'>('setup');
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  // Sub-tab Finanzas opens on; set by deep links (Inicio -> Préstamos), reset by any other navigation.
  const [financesTab, setFinancesTab] = useState<FinancesTab>('movements');
  const [profileId, setProfileId] = useState<string | null>(null);
  // Single entry point of "Nuevo Registro" (central "+", sidebar button, Finanzas, Inicio quick actions).
  const [quickRecord, setQuickRecord] = useState<{
    open: boolean;
    tab: QuickRecordTab;
    kind?: QuickRecordKind;
    prefill?: RegistrationPrefill;
  }>({ open: false, tab: 'expense' });
  const [movementsRefreshKey, setMovementsRefreshKey] = useState(0);
  const [showSharedSpaceCreate, setShowSharedSpaceCreate] = useState(false);
  const [showSharedSpaceJoin, setShowSharedSpaceJoin] = useState(false);
  const [sharedSpacesRefreshKey, setSharedSpacesRefreshKey] = useState(0);
  const [addMovementTarget, setAddMovementTarget] = useState<{ spaceId: string; members: Membership[] } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [accountName, setAccountName] = useState<string | undefined>(undefined);
  const [accountEmail, setAccountEmail] = useState<string | undefined>(undefined);
  // First day of the month shown by the shared selector (dashboard + finances).
  const [refDate, setRefDate] = useState(() => shiftMonth(new Date(), 0));
  const [showNotifications, setShowNotifications] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Item a palette selection asks the destination screen to reveal; `nonce` re-triggers the same target.
  const [focus, setFocus] = useState<{ target: FocusTarget; nonce: number } | null>(null);
  // Card selected via Resumen's "Agregar línea de crédito" -> opens edit sheet in Settings.
  const [editAccountTarget, setEditAccountTarget] = useState<{ id: string; nonce: number } | null>(null);

  // Background Jobs
  const { syncNow } = useSyncManager();
  const celebration = useNotificationEvaluator(profileId);
  const progress = usePersonalProgress(profileId ?? '');
  useTaskRecurrenceEvaluator(profileId);
  const isOnline = useOnlineStatus();
  const hasUnreadNotifications = useHasUnreadNotifications(profileId, progress.visible);
  const tour = useGuidedTour(profileId, step === 'app');

  const clearFocus = useCallback(() => setFocus(null), []);
  const clearEditAccount = useCallback(() => setEditAccountTarget(null), []);

  // ⌘K / Ctrl+K toggles the palette from anywhere inside the app (never over the login or onboarding).
  useHotkey('mod+k', () => setPaletteOpen(open => !open), { enabled: step === 'app', allowInDialog: '[data-command-palette]' });

  React.useEffect(() => {
    document.title = routeTitles[currentRoute]
      ? `${routeTitles[currentRoute]} · ez-life`
      : 'ez-life';
  }, [currentRoute]);

  // Spec 011: every user owns an "Efectivo" account; spec 013: adopt legacy
  // recurring movements into rules once (never generates occurrences, FR-014)
  // and fix `balance_since` once for existing profiles without creating a stub.
  React.useEffect(() => {
    if (step !== 'app' || !profileId) return;
    new LocalPaymentAccountRepository().ensureDefault(profileId).catch(error => console.error(error));
    new LocalMovementRecurrenceRepository().adoptLegacySources(profileId).catch(error => console.error(error));
    new LocalProfileRepository().ensureBalanceSince(profileId, new Date()).catch(error => console.error(error));
  }, [step, profileId]);

  React.useEffect(() => observeAccountSession(syncNow, state => {
    setProfileId(state.account?.id ?? null);
    setAvatarUrl(state.account?.avatarUrl);
    setAccountName(state.account?.name);
    setAccountEmail(state.account?.email);
    setWizardStartStep(state.startStep);
    setWizardMode('setup');
    setStep(!state.account ? 'login' : state.syncError ? 'sync-error' : state.completed ? 'app' : 'onboarding-wizard');
  }), [syncNow, sessionRetryKey]);

  if (step === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Panel className="w-full max-w-xs items-center gap-2 p-6 text-center">
          <p className="font-fredoka text-headline-md text-foreground">
            ez<span className="text-primary">·</span>life
          </p>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </Panel>
      </div>
    );
  }

  if (step === 'login') {
    return <LoginScreen />;
  }

  if (step === 'sync-error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Panel className="w-full max-w-sm items-center gap-4 p-6 text-center">
          <p className="font-fredoka text-headline-md text-foreground">
            ez<span className="text-primary">·</span>life
          </p>
          <div className="space-y-1.5">
            <h1 className="text-base font-medium text-foreground">No pudimos sincronizar tu cuenta</h1>
            <p className="text-sm text-muted-foreground">
              Hubo un problema al cargar tus datos desde el servidor. Reintenta para evitar empezar una configuración desde cero.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button
              type="button"
              onClick={() => {
                setStep('loading');
                setSessionRetryKey(k => k + 1);
              }}
            >
              Reintentar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                try {
                  await getSupabaseBrowserClient().auth.signOut();
                } catch (error) {
                  console.error(error);
                }
                forgetLocalAccount();
                setProfileId(null);
                setAvatarUrl(undefined);
                setAccountName(undefined);
                setAccountEmail(undefined);
                setStep('login');
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </Panel>
      </div>
    );
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

  const openQuickRecord = (tab: QuickRecordTab = 'expense', kind?: QuickRecordKind) =>
    setQuickRecord({ open: true, tab, kind, prefill: undefined });
  const openPendingRegistration = (prefill: RegistrationPrefill) =>
    setQuickRecord({ open: true, tab: prefill.tab === 'loan' ? 'expense' : prefill.tab, prefill });
  const openEditCreditCard = (accountId: string) => {
    setEditAccountTarget({ id: accountId, nonce: Date.now() });
    setCurrentRoute('settings');
  };
  const openCompleteSetup = async (key?: SetupChecklistKey) => {
    let targetKey: SetupChecklistKey = key ?? 'income';
    if (!key && profileId) {
      try {
        const [regInputs, debts, profile] = await Promise.all([
          new LocalRegistrationRepository().getInputs(profileId, new Date()),
          new LocalDebtRepository().getAll(profileId),
          new LocalProfileRepository().get(profileId),
        ]);
        const checklist = buildSetupChecklist({
          incomeSources: regInputs.incomeSources,
          accounts: regInputs.accounts,
          loans: regInputs.loans,
          debts,
          profile,
        });
        targetKey = checklist.nextPending ?? 'income';
      } catch (error) {
        console.error(error);
      }
    }
    setWizardMode('settings');
    setWizardStartStep(SETUP_STEP_BY_KEY[targetKey]);
    setStep('onboarding-wizard');
  };
  const handleReplayTour = () => {
    setCurrentRoute('dashboard');
    tour.replay();
  };
  const navigate = (route: string, options?: NavigateOptions) => {
    setFinancesTab(options?.financesTab ?? 'movements');
    const target = options?.focus;
    setFocus(target ? { target, nonce: Date.now() } : null);
    // A movement from another month is only visible once the shared selector shows that month.
    if (target?.kind === 'movement' && target.date) setRefDate(shiftMonth(target.date, 0));
    setCurrentRoute(route);
  };

  // Each save refreshes what the matching screens show; the sheet itself decides whether it closes.
  // Habits, tasks and goals need nothing here: Control reads them through `useControlData`, which
  // refreshes on every local change by itself.
  const handleQuickRecordSaved = (kind: QuickRecordSavedKind) => {
    switch (kind) {
      case 'movement':
        setMovementsRefreshKey(k => k + 1);
        setSharedSpacesRefreshKey(k => k + 1); // a shared expense also creates a linked personal movement
        break;
      case 'transfer':
        setMovementsRefreshKey(k => k + 1);
        break;
    }
  };

  const resetSession = () => {
    forgetLocalAccount();
    setProfileId(null);
    setAvatarUrl(undefined);
    setAccountName(undefined);
    setAccountEmail(undefined);
    setStep('login');
  };

  // App Shell
  return (
    <Layout
      gamificationEnabled={progress.visible}
      currentRoute={currentRoute}
      onNavigate={navigate}
      onNewMovement={() => openQuickRecord('expense')}
      avatarUrl={avatarUrl}
      accountName={accountName}
      accountEmail={accountEmail}
      onLogout={resetSession}
      onOpenNotifications={() => setShowNotifications(true)}
      onOpenSearch={() => setPaletteOpen(true)}
      hasUnreadNotifications={hasUnreadNotifications}
      refDate={refDate}
      onShiftMonth={delta => setRefDate(current => shiftMonth(current, delta))}
    >
      <div className="space-y-6">
        {!isOnline && (
          <div role="status">
            <Badge variant="warning" className="h-auto whitespace-normal py-1.5">
              Sin conexión · tus cambios se guardan en este dispositivo.
            </Badge>
          </div>
        )}

        {currentRoute === 'dashboard' && profileId && (
          <>
            <Dashboard
              userId={profileId}
              refDate={refDate}
              onOpenQuickRecord={openQuickRecord}
              onRegisterPending={openPendingRegistration}
              onAddCreditLimit={openEditCreditCard}
              onCompleteSetup={key => void openCompleteSetup(key)}
            />
            {/* Mobile-only navigation shortcuts (not a Summary section, FR-034). */}
            <MobileRouteLinks onNavigate={navigate} showProgress={progress.visible} />
          </>
        )}

        {currentRoute === 'progress' && profileId && <PersonalProgress userId={profileId} />}
        {celebration && progress.visible && <div role="status" className="fixed top-4 left-4 right-4 md:left-auto md:w-80 z-50 bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold">Un nuevo logro personal</p><button className="text-sm text-primary min-h-11" onClick={() => navigate('progress')}>Ver mi progreso</button>
        </div>}

        {currentRoute === 'finances' && profileId && (
          <FinancesScreen
            userId={profileId}
            refDate={refDate}
            initialTab={financesTab}
            focus={isMovementFocus(focus?.target) ? focus?.target : undefined}
            focusNonce={focus?.nonce}
            onFocusHandled={clearFocus}
            onNewMovement={() => openQuickRecord('expense')}
            onAddCreditLimit={openEditCreditCard}
            movementsRefreshKey={movementsRefreshKey}
          />
        )}

        {currentRoute === 'shared-space' && profileId && (
          <div className="space-y-4">
            <h2 className="font-fredoka text-headline-lg-mobile md:text-headline-lg text-foreground">Espacio compartido</h2>
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
          <ControlPage
            userId={profileId}
            onOpenQuickRecord={openQuickRecord}
            onOpenProgress={() => navigate('progress')}
            focus={isControlFocus(focus?.target) ? focus?.target : undefined}
            focusNonce={focus?.nonce}
            onFocusHandled={clearFocus}
          />
        )}

        {currentRoute === 'settings' && profileId && (
          <>
            <MobileRouteLinks onNavigate={navigate} showProgress={progress.visible} />
            <SettingsScreen
              userId={profileId}
              onEditDistribution={() => { setWizardMode('settings'); setWizardStartStep(5); setStep('onboarding-wizard'); }}
              onEditCategories={() => { setWizardMode('settings'); setWizardStartStep(6); setStep('onboarding-wizard'); }}
              onCompleteSetup={() => void openCompleteSetup()}
              onReplayTour={handleReplayTour}
              onLogout={resetSession}
              accountName={accountName}
              accountEmail={accountEmail}
              focus={isAccountFocus(focus?.target) ? focus?.target : undefined}
              focusNonce={focus?.nonce}
              onFocusHandled={clearFocus}
              editAccountId={editAccountTarget?.id}
              editAccountNonce={editAccountTarget?.nonce}
              onEditAccountHandled={clearEditAccount}
            />
          </>
        )}
      </div>

      {profileId && (
        <QuickRecordSheet
          open={quickRecord.open}
          onOpenChange={open => setQuickRecord(current => ({ ...current, open, ...(open ? {} : { prefill: undefined }) }))}
          userId={profileId}
          initialTab={quickRecord.tab}
          initialKind={quickRecord.kind}
          prefill={quickRecord.prefill}
          onSaved={handleQuickRecordSaved}
        />
      )}

      {profileId && (
        <Sheet open={showSharedSpaceCreate} onOpenChange={(open) => !open && setShowSharedSpaceCreate(false)}>
          <SheetContent>
            <SharedSpaceCreate
              onComplete={() => {
                setShowSharedSpaceCreate(false);
                setSharedSpacesRefreshKey(k => k + 1);
              }}
              onCancel={() => setShowSharedSpaceCreate(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      {profileId && (
        <Sheet open={showSharedSpaceJoin} onOpenChange={(open) => !open && setShowSharedSpaceJoin(false)}>
          <SheetContent>
            <SharedSpaceJoin
              onComplete={() => {
                setShowSharedSpaceJoin(false);
                setSharedSpacesRefreshKey(k => k + 1);
              }}
              onCancel={() => setShowSharedSpaceJoin(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      {profileId && (
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          userId={profileId}
          gamificationVisible={progress.visible}
          onNavigate={navigate}
          onOpenQuickRecord={openQuickRecord}
        />
      )}

      {profileId && addMovementTarget && (
        <Sheet open={!!addMovementTarget} onOpenChange={(open) => !open && setAddMovementTarget(null)}>
          <SheetContent>
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
          </SheetContent>
        </Sheet>
      )}

      {profileId && (
        <Dialog open={showNotifications} onOpenChange={(open) => !open && setShowNotifications(false)}>
          <DialogContent showCloseButton={false} className={FORM_DIALOG_CONTENT_CLASS}>
            <NotificationHistory
              userId={profileId}
              onClose={() => setShowNotifications(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {profileId && currentRoute === 'dashboard' && (
        <GuidedTour
          active={tour.active}
          step={tour.step}
          onNext={tour.next}
          onSkip={tour.skip}
          onFinish={tour.finish}
        />
      )}
    </Layout>
  );
}
