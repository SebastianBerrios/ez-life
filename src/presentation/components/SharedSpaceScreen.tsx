'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalMembershipRepository } from '../../infrastructure/repositories/local/LocalMembershipRepository';
import { Membership, SharedSpace } from '../../core/domain/models/types';
import SharedSpaceBalances from './SharedSpaceBalances';
import SharedSpaceSettings from './SharedSpaceSettings';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
  onCreate: () => void;
  onJoin: () => void;
  onAddMovement: (spaceId: string, members: Membership[]) => void;
  refreshKey: number;
}

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
    return <Skeleton className="h-28 w-full rounded-card" />;
  }

  if (spaces.length === 0 && leftSpaces.length === 0) {
    return (
      <EmptyState
        testId="shared-space-empty"
        icon={<Users className="size-6" />}
        title="Aún no tienes un espacio compartido"
        description="Crea uno para dividir gastos con tu pareja o familia, o únete con un código de invitación."
        actionLabel="Crear espacio"
        onAction={onCreate}
        secondaryActionLabel="Unirme con código"
        onSecondaryAction={onJoin}
      />
    );
  }

  return (
    <div className="space-y-4">
      {spaces.map(space => (
        <div key={space.id} className="space-y-3">
          <Panel>
            <PanelHeader
              eyebrow="Espacio compartido"
              title={space.name}
              action={
                <Button size="sm" onClick={() => onAddMovement(space.id, membersBySpace[space.id] ?? [])}>
                  + Movimiento
                </Button>
              }
              className="pb-4"
            />
          </Panel>
          <SharedSpaceBalances spaceId={space.id} currentUserId={userId} refreshKey={refreshKey} />
          <SharedSpaceSettings space={space} onChanged={loadSpaces} onLeft={loadSpaces} />
        </div>
      ))}

      {leftSpaces.length > 0 && (
        <div className="space-y-3">
          <h3 className="px-1 text-xs font-medium text-muted-foreground">Espacios que abandonaste</h3>
          {leftSpaces.map(space => (
            <div key={space.id} className="space-y-2">
              <Panel>
                <PanelBody className="pt-4">
                  <h4 className="font-fredoka text-headline-sm text-foreground">{space.name}</h4>
                  <p className="text-body-sm text-muted-foreground">Saldo congelado — ya no eres miembro de este espacio.</p>
                </PanelBody>
              </Panel>
              <SharedSpaceBalances spaceId={space.id} currentUserId={userId} refreshKey={refreshKey} />
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={onJoin} className="w-full">Unirme a otro espacio</Button>
    </div>
  );
}
