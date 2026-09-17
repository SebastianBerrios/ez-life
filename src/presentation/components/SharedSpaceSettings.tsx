'use client';

import React, { useState } from 'react';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalMembershipRepository } from '../../infrastructure/repositories/local/LocalMembershipRepository';
import { SharedSpace } from '../../core/domain/models/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  space: SharedSpace;
  onChanged: () => void;
  onLeft: () => void;
}

export default function SharedSpaceSettings({ space, onChanged, onLeft }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleMode = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const repo = new LocalSharedSpaceRepository();
      const nextMode = space.permission_mode === 'strict' ? 'open' : 'strict';
      await repo.setPermissionMode(space.id, nextMode);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el modo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('¿Seguro que querés abandonar este espacio? Las deudas pendientes quedan visibles en tu historial.')) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const repo = new LocalMembershipRepository();
      await repo.leave(space.id);
      onLeft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abandonar el espacio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-warm-sm px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Modo de permisos</p>
          <p className="text-xs text-muted-foreground">
            {space.permission_mode === 'strict'
              ? 'Cada quien edita/borra solo lo suyo'
              : 'Cualquiera puede editar/borrar cualquier movimiento'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleToggleMode} disabled={isSubmitting}>
          Cambiar a {space.permission_mode === 'strict' ? 'abierto' : 'estricto'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10" onClick={handleLeave} disabled={isSubmitting}>
        Abandonar espacio
      </Button>
    </Card>
  );
}
