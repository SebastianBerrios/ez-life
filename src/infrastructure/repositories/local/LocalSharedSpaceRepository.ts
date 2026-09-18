import { db } from '../../db/db';
import { getSupabaseBrowserClient } from '../../supabase/client';
import { ISharedSpaceRepository } from '../../../core/domain/repositories/IRepositories';
import { Membership, SharedSpace, SharedSpacePermissionMode, UUID } from '../../../core/domain/models/types';

/**
 * Creation goes through the `create_shared_space` RPC only (contracts/
 * rpc-functions.md) — never a direct client insert into `memberships`, which
 * is exactly the self-insert pattern Principio IX forbids. Reads/permission
 * changes are safe as direct table operations because they don't create
 * membership.
 */
export class LocalSharedSpaceRepository implements ISharedSpaceRepository {
  async getAllForUser(userId: UUID): Promise<SharedSpace[]> {
    const memberships = await db.memberships.where('user_id').equals(userId).filter(m => !m.left_at).toArray();
    const spaceIds = memberships.map(m => m.shared_space_id);
    if (spaceIds.length === 0) return [];

    return await db.shared_spaces.where('id').anyOf(spaceIds).filter(s => !s.deleted_at).toArray();
  }

  async getLeftForUser(userId: UUID): Promise<SharedSpace[]> {
    const allMemberships = await db.memberships.where('user_id').equals(userId).toArray();
    const activeSpaceIds = new Set(allMemberships.filter(m => !m.left_at).map(m => m.shared_space_id));
    // A user can rejoin a space after leaving (a new Membership row, the old
    // one is never reactivated) — only surface it here if there's no active
    // membership for it, so it isn't shown twice.
    const leftSpaceIds = Array.from(new Set(allMemberships.filter(m => !!m.left_at).map(m => m.shared_space_id)))
      .filter(id => !activeSpaceIds.has(id));
    if (leftSpaceIds.length === 0) return [];

    return await db.shared_spaces.where('id').anyOf(leftSpaceIds).filter(s => !s.deleted_at).toArray();
  }

  async create(name: string): Promise<SharedSpace> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('create_shared_space', { p_name: name });
    if (error || !data) {
      throw new Error(error?.message ?? 'No se pudo crear el espacio.');
    }

    const space = data as SharedSpace;
    await db.shared_spaces.put(space);

    // The RPC only returns the space; fetch the real (server-generated)
    // membership row so the creator sees themselves as a member immediately,
    // without waiting for the next sync pull.
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userId) {
      const { data: membershipRow } = await supabase
        .from('memberships')
        .select('*')
        .eq('shared_space_id', space.id)
        .eq('user_id', userId)
        .single();
      if (membershipRow) {
        await db.memberships.put(membershipRow as Membership);
      }
    }

    return space;
  }

  async setPermissionMode(spaceId: UUID, mode: SharedSpacePermissionMode): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const now = new Date();
    const { error } = await supabase
      .from('shared_spaces')
      .update({ permission_mode: mode, updated_at: now.toISOString() })
      .eq('id', spaceId);
    if (error) {
      throw new Error(error.message);
    }

    const existing = await db.shared_spaces.get(spaceId);
    if (existing) {
      await db.shared_spaces.put({ ...existing, permission_mode: mode, updated_at: now });
    }
  }
}
