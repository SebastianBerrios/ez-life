import { db } from '../../db/db';
import { IProfileRepository } from '../../../core/domain/repositories/IRepositories';
import { Profile, UUID } from '../../../core/domain/models/types';

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export class LocalProfileRepository implements IProfileRepository {
  async get(id: UUID): Promise<Profile | undefined> {
    return await db.profiles.get(id);
  }

  async save(profileData: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile> {
    const now = new Date();
    const existing = await db.profiles.get(profileData.id);

    let profile: Profile;
    if (existing) {
      profile = { ...existing, ...profileData, updated_at: now };
    } else {
      profile = { ...profileData, created_at: now, updated_at: now };
    }

    await db.profiles.put(profile);
    return profile;
  }

  /**
   * Fixes `balance_since` once for an existing local profile without creating a
   * stub profile on a fresh device (R4: a stub would win LWW over remote pull).
   */
  async ensureBalanceSince(userId: UUID, now: Date): Promise<Profile | undefined> {
    const existing = await db.profiles.get(userId);
    if (!existing) return undefined;
    if (existing.balance_since) return existing;
    return await this.save({ ...existing, balance_since: toYearMonth(now) });
  }
}
