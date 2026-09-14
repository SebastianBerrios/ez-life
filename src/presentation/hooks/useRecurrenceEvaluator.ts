import { useEffect, useRef } from 'react';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { evaluateRecurrence } from '../../core/use-cases/evaluateRecurrence';

export function useRecurrenceEvaluator(userId: string | null) {
  const evaluated = useRef(false);

  useEffect(() => {
    if (!userId || evaluated.current) return;
    
    const run = async () => {
      try {
        evaluated.current = true;
        const profileRepo = new LocalProfileRepository();
        const moveRepo = new LocalMovementRepository();

        const profile = await profileRepo.get(userId);
        if (!profile) return;

        const allMoves = await moveRepo.getAll(userId);
        
        const result = evaluateRecurrence(
          profile.last_recurrence_eval_month,
          new Date(),
          allMoves
        );

        if (result.shouldUpdate) {
          // Clone movements
          for (const clone of result.clonedMovements) {
            await moveRepo.save(clone);
          }
          
          // Update profile
          await profileRepo.save({
            ...profile,
            last_recurrence_eval_month: result.newEvalMonth
          });
        }
      } catch (err) {
        console.error('Error evaluating recurrence:', err);
      }
    };

    run();
  }, [userId]);
}
