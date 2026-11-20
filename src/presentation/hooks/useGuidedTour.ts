import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';

export type GuidedTourStep = 1 | 2 | 3 | 4;

export interface GuidedTourState {
  active: boolean;
  step: GuidedTourStep;
  next: () => void;
  skip: () => void;
  finish: () => void;
  replay: () => void;
}

/**
 * Manages the 4-step guided tour (spec 013 FR-030..FR-032).
 * Activates automatically once when onboarding is complete and `profile.tour_seen`
 * is falsy (covering both new users and existing v1 users). Replaying from Settings
 * restarts the tour without mutating `tour_seen`.
 */
export function useGuidedTour(userId: string | null, onboardingComplete = true): GuidedTourState {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<GuidedTourStep>(1);
  const isReplayRef = useRef(false);
  const checkedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !onboardingComplete) {
      setActive(false);
      checkedUserRef.current = null;
      return;
    }

    if (checkedUserRef.current === userId) return;
    checkedUserRef.current = userId;

    let cancelled = false;
    new LocalProfileRepository()
      .get(userId)
      .then(profile => {
        if (cancelled) return;
        if (!profile?.tour_seen) {
          isReplayRef.current = false;
          setStep(1);
          setActive(true);
        }
      })
      .catch(error => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [userId, onboardingComplete]);

  const markSeenIfFirstRun = useCallback(() => {
    if (!userId || isReplayRef.current) return;
    void new LocalProfileRepository()
      .save({ id: userId, tour_seen: true })
      .catch(error => console.error(error));
  }, [userId]);

  const finish = useCallback(() => {
    setActive(false);
    setStep(1);
    markSeenIfFirstRun();
    isReplayRef.current = false;
  }, [markSeenIfFirstRun]);

  const skip = useCallback(() => {
    setActive(false);
    setStep(1);
    markSeenIfFirstRun();
    isReplayRef.current = false;
  }, [markSeenIfFirstRun]);

  const next = useCallback(() => {
    setStep(current => {
      if (current >= 4) {
        return 4;
      }
      return (current + 1) as GuidedTourStep;
    });
  }, []);

  const replay = useCallback(() => {
    isReplayRef.current = true;
    setStep(1);
    setActive(true);
  }, []);

  return { active, step, next, skip, finish, replay };
}
