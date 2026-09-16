'use client';

import React, { useState } from 'react';
import LoginScreen from './LoginScreen';
import OnboardingWizard from './OnboardingWizard';
import Layout from './Layout';
import Dashboard from './Dashboard';
import MovementList from './MovementList';
import MovementForm from './MovementForm';
import SavingsGoalList from './SavingsGoalList';
import SettingsScreen from './SettingsScreen';
import { useRecurrenceEvaluator } from '../hooks/useRecurrenceEvaluator';
import { useSyncManager } from '../hooks/useSyncManager';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';

export default function MainFlow() {
  const [step, setStep] = useState<'loading' | 'login' | 'onboarding-wizard' | 'app'>('loading');
  const [wizardStartStep, setWizardStartStep] = useState<1 | 2 | 3>(1);
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  // Background Jobs
  useRecurrenceEvaluator(profileId);
  useSyncManager();

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
    return (
      <LoginScreen
        onSkip={() => {
          setWizardStartStep(1);
          setStep('onboarding-wizard');
        }}
      />
    );
  }

  if (step === 'onboarding-wizard') {
    return (
      <OnboardingWizard
        profileId={profileId ?? ''}
        startStep={wizardStartStep}
        onComplete={() => setStep('app')}
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
    >
      <div className="p-4 space-y-6">
        {/* Mobile header */}
        <header className="flex justify-between items-center py-2 md:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">ez-life</h1>
          </div>
          <div className="flex items-center gap-2">
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

        {currentRoute === 'goals' && profileId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Mis Metas</h2>
            </div>
            <SavingsGoalList userId={profileId} />
          </div>
        )}

        {currentRoute === 'settings' && profileId && (
          <SettingsScreen
            userId={profileId}
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

          {showMovementForm && (
            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-card w-full md:max-w-lg md:rounded-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl p-4 md:p-6 shadow-xl border border-border">
                <MovementForm
                  userId={profileId}
                  onComplete={() => setShowMovementForm(false)}
                  onCancel={() => setShowMovementForm(false)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
