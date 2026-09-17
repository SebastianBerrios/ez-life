'use client';

import React, { useState } from 'react';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalSharedInviteRepository } from '../../infrastructure/repositories/local/LocalSharedInviteRepository';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function SharedSpaceCreate({ onComplete, onCancel }: Props) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const spaceRepo = new LocalSharedSpaceRepository();
      const inviteRepo = new LocalSharedInviteRepository();

      const space = await spaceRepo.create(name);
      const invite = await inviteRepo.create(space.id);

      setInviteCode(invite.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el espacio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (inviteCode) {
    return (
      <div className="w-full space-y-5 text-center">
        <h2 className="font-heading text-base font-medium">¡Espacio creado!</h2>
        <p className="text-sm text-muted-foreground">
          Compartí este código con la persona que querés invitar (vence en 48hs):
        </p>
        <p className="text-2xl font-bold tracking-widest text-primary">{inviteCode}</p>
        <Button onClick={onComplete} className="w-full">Listo</Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">Nuevo Espacio Compartido</h2>
      <form onSubmit={handleSubmit} data-testid="shared-space-create-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="spaceName">Nombre del espacio</Label>
          <Input
            type="text"
            id="spaceName"
            required
            placeholder="Ej. Casa"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </div>
      </form>
    </div>
  );
}
