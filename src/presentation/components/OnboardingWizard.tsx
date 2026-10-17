'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { cn } from '@/lib/utils';
import OnboardingStep1 from './OnboardingStep1';
import OnboardingStep2 from './OnboardingStep2';
import OnboardingStep3 from './OnboardingStep3';

interface Props {
  profileId: string;
  startStep?: 1 | 2 | 3;
  mode?: 'setup' | 'settings';
  onComplete: (profileId: string) => void;
}

const STEPS = [
  { number: 1, label: 'Ingresos' },
  { number: 2, label: 'Distribución' },
  { number: 3, label: 'Categorías' },
] as const;

// ---------------------------------------------------------------------------
// Progress indicator: numbered dots joined by hairlines, current step marked for assistive tech.
// ---------------------------------------------------------------------------
function ProgressDots({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Progreso de la configuración" className="mb-6 flex items-start justify-center px-4">
      {STEPS.map((step, idx) => {
        const isCompleted = step.number < currentStep;
        const isActive = step.number === currentStep;
        return (
          <li
            key={step.number}
            aria-current={isActive ? 'step' : undefined}
            className="flex items-start"
          >
            <div className="flex w-20 flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border font-mono text-label-mono-sm transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isActive && 'border-primary bg-primary/10 text-primary shadow-focus',
                  !isCompleted && !isActive && 'border-border bg-card text-muted-foreground',
                )}
              >
                {isCompleted ? <Check aria-hidden="true" className="size-4" /> : step.number}
              </span>
              <span className={cn('font-mono text-label-mono-xs uppercase', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
              <span className="sr-only">
                {isCompleted ? 'Completado' : isActive ? `Paso ${step.number} de ${STEPS.length}, actual` : `Paso ${step.number} de ${STEPS.length}`}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('mt-4 h-px w-8 transition-colors sm:w-12', isCompleted ? 'bg-primary' : 'bg-border')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------
export default function OnboardingWizard({ profileId, startStep = 1, mode = 'setup', onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(startStep);
  const [wizardProfileId, setWizardProfileId] = useState<string>(profileId);

  const handleStep1Complete = (newProfileId: string) => {
    setWizardProfileId(newProfileId);
    setCurrentStep(2);
  };

  const handleStep2Complete = async () => {
    // Entered directly to edit distribution (e.g. from Settings) — return
    // right away instead of dragging the user into category management too.
    if (mode === 'settings') {
      onComplete(wizardProfileId);
      return;
    }
    await new LocalOnboardingRepository().completeStep(wizardProfileId, 2);
    setCurrentStep(3);
  };

  const handleStep3Complete = async () => {
    if (mode === 'setup') await new LocalOnboardingRepository().completeStep(wizardProfileId, 3);
    onComplete(wizardProfileId);
  };

  return (
    <main className="flex min-h-screen flex-col justify-center bg-background py-12 sm:px-6 lg:px-8">
      <div className="mb-2 sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mb-6 text-center text-headline-lg-mobile tracking-tight text-foreground">
          ez<span className="text-primary">·</span>life
        </h1>
        <ProgressDots currentStep={currentStep} />
      </div>

      <div key={currentStep} className="animate-fade-slide-up">
        {currentStep === 1 && (
          <OnboardingStep1 profileId={wizardProfileId} onComplete={handleStep1Complete} />
        )}

        {currentStep === 2 && (
          <OnboardingStep2 profileId={wizardProfileId} onComplete={handleStep2Complete} />
        )}

        {currentStep === 3 && (
          <OnboardingStep3 profileId={wizardProfileId} onComplete={handleStep3Complete} />
        )}
      </div>
    </main>
  );
}
