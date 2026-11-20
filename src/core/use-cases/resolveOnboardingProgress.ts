import type { Profile } from '../domain/models/types';

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ResolvedOnboardingProgress {
  step: OnboardingStep;
  completed: boolean;
}

/**
 * Resolves a profile's onboarding progress onto the 6-step scale (spec 013 R10).
 * Legacy v1 profiles (without `onboarding_version === 2`) follow a fixed
 * compatibility table so existing users never repeat onboarding:
 *   v1 0 -> 0 (not started)
 *   v1 1 -> 1 (resume at "¿Dónde tienes tu dinero?")
 *   v1 2 -> 5 (resume at Categorías; cards/loans stay pending in checklist)
 *   v1 3 -> 6 (completed)
 */
export function resolveOnboardingProgress(
  profile?: Pick<Profile, 'onboarding_step' | 'onboarding_version'> | null,
): ResolvedOnboardingProgress {
  if (!profile || profile.onboarding_step === undefined) {
    return { step: 0, completed: false };
  }

  if (profile.onboarding_version === 2) {
    const raw = profile.onboarding_step;
    const step = (raw < 0 ? 0 : raw > 6 ? 6 : raw) as OnboardingStep;
    return { step, completed: step === 6 };
  }

  // Legacy v1 compatibility table (R10)
  switch (profile.onboarding_step) {
    case 0:
      return { step: 0, completed: false };
    case 1:
      return { step: 1, completed: false };
    case 2:
      return { step: 5, completed: false };
    default:
      return { step: 6, completed: true };
  }
}
