import { useEffect, useState } from 'react';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalMembershipRepository } from '../../infrastructure/repositories/local/LocalMembershipRepository';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { Membership } from '../../core/domain/models/types';

export interface ActiveSharedSpace {
  id: string;
  name: string;
  members: Membership[];
}

/**
 * Shared spaces the user still belongs to (with their active members), read from local storage so
 * it works offline. Spaces the user left are not included. Disabled -> empty list, no reads.
 */
export function useActiveSharedSpaces(userId: string | null, enabled = true): ActiveSharedSpace[] {
  const [spaces, setSpaces] = useState<ActiveSharedSpace[]>([]);

  useEffect(() => {
    if (!userId || !enabled) return;
    let active = true;
    const load = async () => {
      try {
        const spaceRepo = new LocalSharedSpaceRepository();
        const membershipRepo = new LocalMembershipRepository();
        const all = await spaceRepo.getAllForUser(userId);
        const memberLists = await Promise.all(all.map(space => membershipRepo.getMembers(space.id)));
        if (active) setSpaces(all.map((space, index) => ({ id: space.id, name: space.name, members: memberLists[index] })));
      } catch (error) {
        console.error(error);
      }
    };
    void load();
    const unsubscribe = onLocalChanges(['shared_spaces', 'memberships'], load);
    return () => { active = false; unsubscribe(); };
  }, [userId, enabled]);

  return userId && enabled ? spaces : [];
}
