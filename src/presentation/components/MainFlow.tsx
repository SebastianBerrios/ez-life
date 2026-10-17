'use client';
import PersonalProgress from './PersonalProgress';
import { usePersonalProgress } from '../hooks/usePersonalProgress';

import React, { useCallback, useState } from 'react';
import LoginScreen from './LoginScreen';
import OnboardingWizard from './OnboardingWizard';
import Layout from './Layout';
import Dashboard from './Dashboard';
import QuickRecordSheet, { type QuickRecordKind, type QuickRecordSavedKind, type QuickRecordTab } from './QuickRecordSheet';
import FinancesScreen, { type FinancesTab } from './FinancesScreen';
import MobileRouteLinks from './MobileRouteLinks';
import { FORM_DIALOG_CONTENT_CLASS } from './dialogChrome';
import SharedSpaceScreen from './SharedSpaceScreen';
import SharedSpaceCreate from './SharedSpaceCreate';
import SharedSpaceJoin from './SharedSpaceJoin';
import SharedMovementForm from './SharedMovementForm';
import ControlPage from './ControlPage';
import { Membership } from '../../core/domain/models/types';
import SettingsScreen from './SettingsScreen';
import NotificationHistory from './NotificationHistory';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import CommandPalette from './CommandPalette';
import { isAccountFocus, isControlFocus, isMovementFocus, type FocusTarget, type NavigateOptions } from '../../core/use-cases/paletteCommand';
import { useHotkey } from '../hooks/useHotkey';
import { shiftMonth } from '../../core/use-cases/calendar';
import { useHasUnreadNotifications } from '../hooks/useHasUnreadNotifications';
import { useRecurrenceEvaluator } from '../hooks/useRecurrenceEvaluator';
import { useSyncManager } from '../hooks/useSyncManager';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useNotificationEvaluator } from '../hooks/useNotificationEvaluator';
import { useTaskRecurrenceEvaluator } from '../hooks/useTaskRecurrenceEvaluator';
import { observeAccountSession } from '../../infrastructure/auth/observeAccountSession';
import { forgetLocalAccount } from '../../infrastructure/auth/localAccount';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';

// FR-004: per-page browser tab titles. The app has a single real Next.js
// route (`src/app/page.tsx`) — every "page" below is client-side routing
// inside this component's `currentRoute` state, so Next.js's file-based
// `generateMetadata` can't produce a per-page title (research.md §1). This
// mutates `document.title` directly instead, keyed off `currentRoute`.
const routeTitles: Record<string, string> = {
  progress: 'Mi progreso',
  dashboard: 'Resumen',
  finances: 'Finanzas',
  'shared-space': 'Espacio Compartido',
  control: 'Control & Hábitos',
  settings: 'Ajustes',
};

export default function MainFlow() {
  const [step, setStep] = useState<'loading' | 'login' | 'onboarding-wizard' | 'app'>('loading');
  const [wizardStartStep, setWizardStartStep] = useState<1 | 2 | 3>(1);
  const [wizardMode, setWizardMode] = useState<'setup' | 'settings'>('setup');
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  // Sub-tab Finanzas opens on; set by deep links (Inicio -> Préstamos), reset by any other navigation.
  const [financesTab, setFinancesTab] = useState<FinancesTab>('movements');
  const [profileId, setProfileId] = useState<string | null>(null);
  // Single entry point of "Nuevo Registro" (central "+", sidebar button, Finanzas, Inicio quick actions).
  const [quickRecord, setQuickRecord] = useState<{ open: boolean; tab: QuickRecordTab; kind?: QuickRecordKind }>({ open: false, tab: 'expense' });
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

  // Background Jobs
  useRecurrenceEvaluator(profileId);
  const { syncNow } = useSyncManager();
  const celebration = useNotificationEvaluator(profileId);
  const progress = usePersonalProgress(profileId ?? '');
  useTaskRecurrenceEvaluator(profileId);
  const isOnline = useOnlineStatus();
  const hasUnreadNotifications = useHasUnreadNotifications(profileId, progress.visible);

  const clearFocus = useCallback(() => setFocus(null), []);

  // ⌘K / Ctrl+K toggles the palette from anywhere inside the app (never over the login or onboarding).
  useHotkey('mod+k', () => setPaletteOpen(open => !open), { enabled: step === 'app', allowInDialog: '[data-command-palette]' });

  React.useEffect(() => {
    document.title = routeTitles[currentRoute]
      ? `${routeTitles[currentRoute]} · ez-life`
      : 'ez-life';
  }, [currentRoute]);

  // Spec 011: every user owns an "Efectivo" account. Runs when the app shell is
  // reached — both on a normal start and right after onboarding completes.
  React.useEffect(() => {
    if (step !== 'app' || !profileId) return;
    new LocalPaymentAccountRepository().ensureDefault(profileId).catch(error => console.error(error));
  }, [step, profileId]);

  React.useEffect(() => observeAccountSession(syncNow, state => {
    setProfileId(state.account?.id ?? null);
    setAvatarUrl(state.account?.avatarUrl);
    setAccountName(state.account?.name);
    setAccountEmail(state.account?.email);
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

  const openQuickRecord = (tab: QuickRecordTab = 'expense', kind?: QuickRecordKind) => setQuickRecord({ open: true, tab, kind });
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
              onOpenProgress={() => navigate('progress')}
              onOpenQuickRecord={openQuickRecord}
              onNavigate={navigate}
            />
            {/* Mi Progreso already has its own card on Inicio; only the Espacio compartido row remains. */}
            <MobileRouteLinks onNavigate={navigate} showProgress={false} />
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
            movementsRefreshKey={movementsRefreshKey}
          />
        )}

        {currentRoute === 'shared-space' && profileId && (
          <div className="space-y-4">
            <h2 className="text-headline-lg-mobile md:text-headline-lg text-foreground">Espacio Compartido</h2>
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
              onEditDistribution={() => { setWizardMode('settings'); setWizardStartStep(2); setStep('onboarding-wizard'); }}
              onEditCategories={() => { setWizardMode('settings'); setWizardStartStep(3); setStep('onboarding-wizard'); }}
              onLogout={resetSession}
              accountName={accountName}
              accountEmail={accountEmail}
              focus={isAccountFocus(focus?.target) ? focus?.target : undefined}
              focusNonce={focus?.nonce}
              onFocusHandled={clearFocus}
            />
          </>
        )}
      </div>

      {profileId && (
        <QuickRecordSheet
          open={quickRecord.open}
          onOpenChange={open => setQuickRecord(current => ({ ...current, open }))}
          userId={profileId}
          initialTab={quickRecord.tab}
          initialKind={quickRecord.kind}
          onSaved={handleQuickRecordSaved}
        />
      )}

      {profileId && (
        <Dialog open={showSharedSpaceCreate} onOpenChange={(open) => !open && setShowSharedSpaceCreate(false)}>
          <DialogContent className={FORM_DIALOG_CONTENT_CLASS}>
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
          <DialogContent className={FORM_DIALOG_CONTENT_CLASS}>
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
        <Dialog open={!!addMovementTarget} onOpenChange={(open) => !open && setAddMovementTarget(null)}>
          <DialogContent className={FORM_DIALOG_CONTENT_CLASS}>
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
          <DialogContent showCloseButton={false} className={FORM_DIALOG_CONTENT_CLASS}>
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
