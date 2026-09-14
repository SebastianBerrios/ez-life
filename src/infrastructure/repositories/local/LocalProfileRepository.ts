import { db } from '../../db/db';
import { IProfileRepository } from '../../../core/domain/repositories/IRepositories';
import { Profile, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

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
}
