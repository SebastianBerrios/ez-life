'use client';

import React, { useState } from 'react';
import { LocalSharedInviteRepository } from '../../infrastructure/repositories/local/LocalSharedInviteRepository';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export default function SharedSpaceJoin({ onComplete, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const repo = new LocalSharedInviteRepository();
      await repo.redeem(code.trim().toUpperCase());
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo canjear el código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">Unirme a un Espacio</h2>
      <form onSubmit={handleSubmit} data-testid="shared-space-join-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="inviteCode">Código de invitación</Label>
          <Input
            type="text"
            id="inviteCode"
            required
            placeholder="Ej. ABC12345"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unirme
          </Button>
        </div>
      </form>
    </div>
  );
}
