import { useEffect, useRef } from 'react';
import { db } from '../../infrastructure/db/db';
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
          // Atomic: clone movements and bump the profile's evaluated month inside a
          // single Dexie transaction. If the app is interrupted mid-way, IndexedDB
          // rolls back everything, so the next run either sees no clones (and
          // regenerates them) or sees the fully-updated profile — never a state
          // where movements were cloned but the profile still points at the old
          // month, which would duplicate them on the next evaluation (RF-12).
          // sync_queue is included because Local*Repository writes trigger Dexie's
          // creating/updating hooks, which enqueue into sync_queue as part of the
          // same transaction.
          await db.transaction('rw', [db.movements, db.profiles, db.sync_queue], async () => {
            for (const clone of result.clonedMovements) {
              await moveRepo.save({ ...clone, id: '' });
            }

            // Update profile
            await profileRepo.save({
              ...profile,
              last_recurrence_eval_month: result.newEvalMonth
            });
          });
        }
      } catch (err) {
        console.error('Error evaluating recurrence:', err);
      }
    };

    run();
  }, [userId]);
}
