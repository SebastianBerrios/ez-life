import { useEffect } from 'react';
import { LocalMovementRecurrenceRepository } from '../../infrastructure/repositories/local/LocalMovementRecurrenceRepository';
import { onLocalChanges } from '../../infrastructure/db/localChanges';

export function useRecurrenceEvaluator(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let running = false;
    
    const run = async () => {
      try {
        if (running) return;
        running = true;
        await new LocalMovementRecurrenceRepository().generate(userId, new Date());
      } catch (err) {
        console.error('Error evaluating recurrence:', err);
      } finally {
        running = false;
      }
    };

    run();
    const unsubscribe = onLocalChanges(['movement_recurrences'], run);
    const interval = setInterval(run, 60_000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, [userId]);
}
