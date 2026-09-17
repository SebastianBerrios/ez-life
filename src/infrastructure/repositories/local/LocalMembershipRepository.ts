import { db } from '../../db/db';
import { getSupabaseBrowserClient } from '../../supabase/client';
import { IMembershipRepository } from '../../../core/domain/repositories/IRepositories';
import { Membership, UUID } from '../../../core/domain/models/types';

export class LocalMembershipRepository implements IMembershipRepository {
  async getMembers(spaceId: UUID): Promise<Membership[]> {
    return await db.memberships.where('shared_space_id').equals(spaceId).filter(m => !m.left_at).toArray();
  }

  async leave(spaceId: UUID): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc('leave_shared_space', { p_space_id: spaceId });
    if (error) {
      throw new Error(error.message);
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const now = new Date();
    const rows = await db.memberships
      .where('shared_space_id').equals(spaceId)
      .filter(m => m.user_id === userId && !m.left_at)
      .toArray();

    for (const row of rows) {
      await db.memberships.put({ ...row, left_at: now, updated_at: now });
    }
  }
}
