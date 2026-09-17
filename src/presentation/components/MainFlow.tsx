'use client';

import React, { useState } from 'react';
import LoginScreen from './LoginScreen';
import OnboardingWizard from './OnboardingWizard';
import Layout from './Layout';
import Dashboard from './Dashboard';
import MovementList from './MovementList';
import MovementForm from './MovementForm';
import SavingsGoalList from './SavingsGoalList';
import SavingsGoalForm from './SavingsGoalForm';
import AnalysisScreen from './AnalysisScreen';
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
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalsRefreshKey, setGoalsRefreshKey] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [showNotifications, setShowNotifications] = useState(false);

  // Background Jobs
  useRecurrenceEvaluator(profileId);
  useSyncManager();
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

          try {
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
  }, []);

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
          // The wizard may have created/edited data under its own locally
          // generated profileId (Step 1 skip-login path) — sync it back so
          // Dashboard/MovementForm query the right user, not a stale one.
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
      onNewMovement={() => setShowMovementForm(true)}
      avatarUrl={avatarUrl}
      onLogout={() => setStep('login')}
      onOpenNotifications={() => setShowNotifications(true)}
    >
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
