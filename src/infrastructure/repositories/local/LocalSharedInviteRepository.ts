import { db } from '../../db/db';
import { getSupabaseBrowserClient } from '../../supabase/client';
import { ISharedInviteRepository } from '../../../core/domain/repositories/IRepositories';
import { Membership, SharedInvite, SharedSpace, UUID } from '../../../core/domain/models/types';

/**
 * Both operations go through RPCs (contracts/rpc-functions.md) — creation is
 * gated on being an existing member, and redemption is the only place a
 * Membership row is ever created for someone other than a space's creator
 * (Principio IX).
 */
export class LocalSharedInviteRepository implements ISharedInviteRepository {
  async create(spaceId: UUID): Promise<SharedInvite> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('create_shared_invite', { p_space_id: spaceId });
    if (error || !data) {
      throw new Error(error?.message ?? 'No se pudo crear la invitación.');
    }

    const invite = data as SharedInvite;
    await db.shared_invites.put(invite);
    return invite;
  }

  async redeem(code: string): Promise<Membership> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('redeem_shared_invite', { p_code: code });
    if (error || !data) {
      throw new Error(error?.message ?? 'La invitación no es válida o ya venció.');
    }

    const membership = data as Membership;
    await db.memberships.put(membership);

    // Also cache the space itself so it appears immediately, without
    // waiting for the next sync pull.
    const { data: spaceRow } = await supabase
      .from('shared_spaces')
      .select('*')
      .eq('id', membership.shared_space_id)
      .single();
    if (spaceRow) {
      await db.shared_spaces.put(spaceRow as SharedSpace);
    }

    return membership;
  }
}
