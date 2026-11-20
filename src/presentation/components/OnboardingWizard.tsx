'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { cn } from '@/lib/utils';
import OnboardingStep1 from './OnboardingStep1';
import OnboardingStep2 from './OnboardingStep2';
import OnboardingStep3 from './OnboardingStep3';
import OnboardingStep4 from './OnboardingStep4';
import OnboardingStep5 from './OnboardingStep5';
import OnboardingStep6 from './OnboardingStep6';

export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6;

interface Props {
  profileId: string;
  startStep?: WizardStepNumber;
  mode?: 'setup' | 'settings';
  onComplete: (profileId: string) => void;
}

const STEPS: readonly { number: WizardStepNumber; label: string }[] = [
  { number: 1, label: 'Ingresos' },
  { number: 2, label: 'Dinero' },
  { number: 3, label: 'Tarjetas' },
  { number: 4, label: 'Préstamos' },
  { number: 5, label: 'Distribución' },
  { number: 6, label: 'Categorías' },
] as const;

function ProgressDots({ currentStep }: { currentStep: WizardStepNumber }) {
  return (
    <ol aria-label="Progreso de la configuración" className="mb-6 flex flex-wrap items-start justify-center gap-y-2 px-2">
      {STEPS.map((step, idx) => {
        const isCompleted = step.number < currentStep;
        const isActive = step.number === currentStep;
        return (
          <li
            key={step.number}
            aria-current={isActive ? 'step' : undefined}
            className="flex items-start"
          >
            <div className="flex w-14 flex-col items-center gap-1 sm:w-16">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isActive && 'border-primary bg-primary/15 text-foreground shadow-focus',
                  !isCompleted && !isActive && 'border-border bg-card text-muted-foreground',
                )}
              >
                {isCompleted ? <Check aria-hidden="true" className="size-4" /> : step.number}
              </span>
              <span className={cn('text-center text-xs', isActive ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
              <span className="sr-only">
                {isCompleted ? 'Completado' : isActive ? `Paso ${step.number} de ${STEPS.length}, actual` : `Paso ${step.number} de ${STEPS.length}`}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('mt-4 hidden h-px w-4 transition-colors sm:block', isCompleted ? 'bg-primary' : 'bg-border')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function OnboardingWizard({ profileId, startStep = 1, mode = 'setup', onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<WizardStepNumber>(startStep);
  const [wizardProfileId, setWizardProfileId] = useState<string>(profileId);

  const finishOrAdvance = (nextStep: WizardStepNumber, newProfileId?: string) => {
    const id = newProfileId ?? wizardProfileId;
    if (newProfileId) setWizardProfileId(newProfileId);
    if (mode === 'settings') {
      onComplete(id);
      return;
    }
    setCurrentStep(nextStep);
  };

  const handleStep5Complete = async () => {
    if (mode === 'settings') {
      onComplete(wizardProfileId);
      return;
    }
    await new LocalOnboardingRepository().completeStep(wizardProfileId, 5);
    setCurrentStep(6);
  };

  const handleStep6Complete = async () => {
    if (mode === 'setup') {
      await new LocalOnboardingRepository().completeStep(wizardProfileId, 6);
    }
    onComplete(wizardProfileId);
  };

  return (
    <main className="flex min-h-screen flex-col justify-center bg-background py-10 sm:px-6 lg:px-8">
      <div className="mb-2 sm:mx-auto sm:w-full sm:max-w-lg">
        <h1 className="mb-5 text-center font-fredoka text-headline-lg-mobile tracking-tight text-foreground">
          ez<span className="text-primary">·</span>life
        </h1>
        <ProgressDots currentStep={currentStep} />
      </div>

      <div key={currentStep} className="animate-fade-slide-up">
        {currentStep === 1 && (
          <OnboardingStep1
            profileId={wizardProfileId}
            onComplete={(newId) => finishOrAdvance(2, newId)}
          />
        )}

        {currentStep === 2 && (
          <OnboardingStep2
            profileId={wizardProfileId}
            onComplete={() => finishOrAdvance(3)}
          />
        )}

        {currentStep === 3 && (
          <OnboardingStep3
            profileId={wizardProfileId}
            onComplete={() => finishOrAdvance(4)}
          />
        )}

        {currentStep === 4 && (
          <OnboardingStep4
            profileId={wizardProfileId}
            onComplete={() => finishOrAdvance(5)}
          />
        )}

        {currentStep === 5 && (
          <OnboardingStep5
            profileId={wizardProfileId}
            onComplete={handleStep5Complete}
          />
        )}

        {currentStep === 6 && (
          <OnboardingStep6
            profileId={wizardProfileId}
            onComplete={handleStep6Complete}
          />
        )}
      </div>
    </main>
  );
}
