import type { AchievementData, AchievementReceipt, AchievementId } from '../../use-cases/evaluateAchievements';
import type { Profile } from '../models/types';

export interface IAchievementRepository {
  snapshot(userId: string): Promise<{ data: AchievementData; receipts: AchievementReceipt[]; profile?: Profile }>;
  reconcile(userId: string, now?: Date): Promise<AchievementId[]>;
}
