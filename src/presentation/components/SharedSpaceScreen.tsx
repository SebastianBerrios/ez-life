'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalMembershipRepository } from '../../infrastructure/repositories/local/LocalMembershipRepository';
import { Membership, SharedSpace } from '../../core/domain/models/types';
import SharedSpaceBalances from './SharedSpaceBalances';
import SharedSpaceSettings from './SharedSpaceSettings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
  onCreate: () => void;
  onJoin: () => void;
  onAddMovement: (spaceId: string, members: Membership[]) => void;
  refreshKey: number;
}

/**
 * First-time-per-section onboarding for the shared space (FR-024) plus, once
 * a space exists, the balances/settings view (User Story 3). Spaces the user
 * left keep their frozen balance visible, read-only (FR-016).
 */
export default function SharedSpaceScreen({ userId, onCreate, onJoin, onAddMovement, refreshKey }: Props) {
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [leftSpaces, setLeftSpaces] = useState<SharedSpace[]>([]);
  const [membersBySpace, setMembersBySpace] = useState<Record<string, Membership[]>>({});
  const [loading, setLoading] = useState(true);

  const loadSpaces = useCallback(async () => {
    try {
      const spaceRepo = new LocalSharedSpaceRepository();
      const membershipRepo = new LocalMembershipRepository();

      const [allSpaces, allLeftSpaces] = await Promise.all([
        spaceRepo.getAllForUser(userId),
        spaceRepo.getLeftForUser(userId),
      ]);
      setSpaces(allSpaces);
      setLeftSpaces(allLeftSpaces);

      const memberLists = await Promise.all(allSpaces.map(s => membershipRepo.getMembers(s.id)));
      setMembersBySpace(Object.fromEntries(allSpaces.map((s, i) => [s.id, memberLists[i]])));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces, refreshKey]);

  if (loading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  if (spaces.length === 0 && leftSpaces.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm space-y-4">
        <p className="text-muted-foreground px-5">
          Todavía no tenés un espacio compartido. Creá uno para tu pareja o familia, o unite a uno existente con un código.
        </p>
        <div className="flex gap-3 px-5">
          <Button variant="outline" onClick={onJoin} className="flex-1">Unirme con código</Button>
          <Button onClick={onCreate} className="flex-1">Crear espacio</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="animate-fade-slide-up space-y-4">
      {spaces.map(space => (
        <div key={space.id} className="space-y-3">
          <Card className="shadow-warm-sm px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground">{space.name}</h3>
              <Button size="sm" onClick={() => onAddMovement(space.id, membersBySpace[space.id] ?? [])}>
                + Movimiento
              </Button>
            </div>
          </Card>
          <SharedSpaceBalances spaceId={space.id} currentUserId={userId} refreshKey={refreshKey} />
          <SharedSpaceSettings space={space} onChanged={loadSpaces} onLeft={loadSpaces} />
        </div>
      ))}

      {leftSpaces.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-sm font-medium text-muted-foreground">Espacios que abandonaste</h3>
          {leftSpaces.map(space => (
            <div key={space.id} className="space-y-2">
              <Card className="shadow-warm-sm px-5 py-4">
                <h4 className="font-heading font-bold text-foreground">{space.name}</h4>
                <p className="text-xs text-muted-foreground">Saldo congelado — ya no sos miembro de este espacio.</p>
              </Card>
              <SharedSpaceBalances spaceId={space.id} currentUserId={userId} refreshKey={refreshKey} />
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={onJoin} className="w-full">Unirme a otro espacio</Button>
    </div>
  );
}
