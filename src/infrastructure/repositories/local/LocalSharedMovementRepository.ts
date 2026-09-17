import { db } from '../../db/db';
import { getSupabaseBrowserClient } from '../../supabase/client';
import { CreateSharedMovementParams, ISharedMovementRepository } from '../../../core/domain/repositories/IRepositories';
import { SharedMovement, UUID } from '../../../core/domain/models/types';

/**
 * `create`/`delete` go through RPCs (contracts/rpc-functions.md) — creating
 * writes a Movement row for OTHER members too, and deleting must remove
 * every linked Movement atomically, neither of which a plain "own rows
 * only" RLS policy can allow as a direct client operation (Principio IX).
 */
export class LocalSharedMovementRepository implements ISharedMovementRepository {
  async getAllForSpace(spaceId: UUID): Promise<SharedMovement[]> {
    return await db.shared_movements.where('shared_space_id').equals(spaceId).filter(m => !m.deleted_at).toArray();
  }

  async create(params: CreateSharedMovementParams): Promise<SharedMovement> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('create_shared_movement', {
      p_space_id: params.sharedSpaceId,
      p_type: params.type,
      p_total_amount_cents: params.totalAmountCents,
      p_split_mode: params.splitMode,
      p_splits: params.splits,
      p_date: params.date.toISOString(),
    });
    if (error || !data) {
      throw new Error(error?.message ?? 'No se pudo registrar el gasto compartido.');
    }

    const sharedMovement = data as SharedMovement;
    await db.shared_movements.put(sharedMovement);

    // Cache the linked personal movements too, so they appear immediately
    // for the creator without waiting for the next sync pull (other
    // members get them via that pull / the Realtime-triggered one, T032).
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const ownLink = sharedMovement.linked_movement_ids.find(l => l.user_id === userId);
    if (ownLink) {
      const { data: movementRow } = await supabase.from('movements').select('*').eq('id', ownLink.movement_id).single();
      if (movementRow) {
        await db.movements.put(movementRow as never);
      }
    }

    return sharedMovement;
  }

  async delete(id: UUID): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc('delete_shared_movement', { p_id: id });
    if (error) {
      throw new Error(error.message);
    }

    const now = new Date();
    const existing = await db.shared_movements.get(id);
    if (existing) {
      await db.shared_movements.put({ ...existing, deleted_at: now, updated_at: now });
      for (const link of existing.linked_movement_ids) {
        const movement = await db.movements.get(link.movement_id);
        if (movement) {
          await db.movements.put({ ...movement, deleted_at: now, updated_at: now });
        }
      }
    }
  }
}
