'use client';

import React, { useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { LocalSharedSpaceRepository } from '../../infrastructure/repositories/local/LocalSharedSpaceRepository';
import { LocalSharedInviteRepository } from '../../infrastructure/repositories/local/LocalSharedInviteRepository';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function SharedSpaceCreate({ onComplete, onCancel }: Props) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard?.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts; code remains visible to copy manually.
    }
  };

  if (inviteCode) {
    return (
      <div className="w-full space-y-5 text-center">
        <h2 className="font-fredoka text-headline-md text-foreground">¡Espacio creado!</h2>
        <p className="text-body-md text-muted-foreground">
          Comparte este código con la persona que quieres invitar (vence en 48 h):
        </p>
        <div className="space-y-3 rounded-2xl bg-surface-2/80 p-5">
          <p className="font-fredoka text-headline-lg-mobile tracking-widest text-foreground">
            {inviteCode}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? 'Código copiado' : 'Copiar código'}
          </Button>
        </div>
        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-border/60 bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button onClick={onComplete} size="lg" className="w-full">Listo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="mb-4 font-fredoka text-headline-md text-foreground">Nuevo espacio compartido</h2>
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

        {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}

        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex gap-3 border-t border-border/60 bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="animate-spin" />}
            Crear
          </Button>
        </div>
      </form>
    </div>
  );
}
