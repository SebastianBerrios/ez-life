import { describe, it, expect } from 'vitest';
import { resolveOnboardingProgress } from './resolveOnboardingProgress';

describe('resolveOnboardingProgress', () => {
  it('returns step 0 incomplete when profile or onboarding_step is missing', () => {
    expect(resolveOnboardingProgress(undefined)).toEqual({ step: 0, completed: false });
    expect(resolveOnboardingProgress(null)).toEqual({ step: 0, completed: false });
    expect(resolveOnboardingProgress({})).toEqual({ step: 0, completed: false });
  });

  describe('legacy v1 compatibility table (without onboarding_version = 2)', () => {
    it('maps v1 step 0 -> 0 (incomplete)', () => {
      expect(resolveOnboardingProgress({ onboarding_step: 0 })).toEqual({ step: 0, completed: false });
    });

    it('maps v1 step 1 -> 1 (resumes at "¿Dónde tienes tu dinero?")', () => {
      expect(resolveOnboardingProgress({ onboarding_step: 1 })).toEqual({ step: 1, completed: false });
    });

    it('maps v1 step 2 -> 5 (resumes at Categorías)', () => {
      expect(resolveOnboardingProgress({ onboarding_step: 2 })).toEqual({ step: 5, completed: false });
    });

    it('maps v1 step 3 -> 6 (completed, does not repeat onboarding)', () => {
      expect(resolveOnboardingProgress({ onboarding_step: 3 })).toEqual({ step: 6, completed: true });
    });
  });

  describe('v2 profiles (onboarding_version = 2)', () => {
    it('returns the step as-is and marks completed only at step 6', () => {
      expect(resolveOnboardingProgress({ onboarding_version: 2, onboarding_step: 0 })).toEqual({ step: 0, completed: false });
      expect(resolveOnboardingProgress({ onboarding_version: 2, onboarding_step: 1 })).toEqual({ step: 1, completed: false });
      expect(resolveOnboardingProgress({ onboarding_version: 2, onboarding_step: 2 })).toEqual({ step: 2, completed: false });
      expect(resolveOnboardingProgress({ onboarding_version: 2, onboarding_step: 3 })).toEqual({ step: 3, completed: false });
      expect(resolveOnboardingProgress({ onboarding_version: 2, onboarding_step: 4 })).toEqual({ step: 4, completed: false });
      expect(resolveOnboardingProgress({ onboarding_version: 2, onboarding_step: 5 })).toEqual({ step: 5, completed: false });
      expect(resolveOnboardingProgress({ onboarding_version: 2, onboarding_step: 6 })).toEqual({ step: 6, completed: true });
    });
  });
});
