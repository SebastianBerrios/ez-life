import { useEffect, useState } from 'react';
import { LocalAchievementRepository } from '../../infrastructure/repositories/local/LocalAchievementRepository';
import { evaluateAchievements, type AchievementProgress } from '../../core/use-cases/evaluateAchievements';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { onSyncCompleted } from '../../infrastructure/sync/syncEvents';

export const progressTables = ['movements', 'tasks', 'goals', 'habits', 'habit_completions', 'savings_goals', 'profiles', 'achievement_receipts'];
export function usePersonalProgress(userId: string) {
  const [state, setState] = useState<{ userId: string; items: AchievementProgress[]; visible: boolean; loading: boolean; error: boolean }>({ userId, items: [], visible: false, loading: true, error: false });
  useEffect(() => {
    let active = true;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const { data, profile } = await new LocalAchievementRepository().snapshot(userId);
        if (active && request === generation) setState({ userId, items: evaluateAchievements(data), visible: Boolean(profile) && profile?.gamification_enabled !== false, loading: false, error: false });
      } catch {
        if (active && request === generation) setState({ userId, items: [], visible: false, loading: false, error: true });
      }
    };
    void load();
    const local = onLocalChanges(progressTables, load);
    const sync = onSyncCompleted(load);
    return () => { active = false; local(); sync(); };
  }, [userId]);
  return state.userId === userId ? state : { items: [], visible: false, loading: true, error: false };
}
