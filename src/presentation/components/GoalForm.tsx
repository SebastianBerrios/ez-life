'use client';

import React, { useState } from 'react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { Goal, GoalKind, GoalMilestone } from '../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';

interface Props {
  userId: string;
  existing?: Goal;
  onComplete: () => void;
  onCancel: () => void;
}

export default function GoalForm({ userId, existing, onComplete, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<GoalKind>(existing?.kind ?? 'numeric');
  const [targetValue, setTargetValue] = useState(existing?.target_value?.toString() ?? '');
  const [milestones, setMilestones] = useState<GoalMilestone[]>(existing?.milestones ?? []);
  const [newMilestone, setNewMilestone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    setMilestones(prev => [...prev, { id: uuidv7(), label: newMilestone.trim(), done: false }]);
    setNewMilestone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (kind === 'numeric' && (!targetValue || Number(targetValue) <= 0)) {
      setError('El valor objetivo debe ser mayor a 0.');
      return;
    }
    if (kind === 'checklist' && milestones.length === 0) {
      setError('Agregá al menos un hito.');
      return;
    }

    setIsSubmitting(true);
    try {
      const repo = new LocalGoalRepository();
      await repo.save({
        id: existing?.id ?? '',
        user_id: userId,
        name,
        kind,
        target_value: kind === 'numeric' ? Number(targetValue) : undefined,
        current_value: kind === 'numeric' ? (existing?.current_value ?? 0) : undefined,
        milestones: kind === 'checklist' ? milestones : undefined,
        status: existing?.status ?? 'active',
        completed_at: existing?.completed_at,
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la meta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">{existing ? 'Editar Meta' : 'Nueva Meta'}</h2>
      <form onSubmit={handleSubmit} data-testid="goal-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="goalName">Nombre</Label>
          <Input type="text" id="goalName" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Tipo</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="kind" checked={kind === 'numeric'} onChange={() => setKind('numeric')} />
              Numérica
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="kind" aria-label="Checklist" checked={kind === 'checklist'} onChange={() => setKind('checklist')} />
              Checklist
            </label>
          </div>
        </fieldset>

        {kind === 'numeric' && (
          <div className="space-y-2">
            <Label htmlFor="targetValue">Valor objetivo</Label>
            <Input
              type="text"
              id="targetValue"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
        )}

        {kind === 'checklist' && (
          <div className="space-y-2">
            <Label htmlFor="newMilestone">Nuevo hito</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                id="newMilestone"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
              />
              <Button type="button" onClick={addMilestone}>Agregar hito</Button>
            </div>
            <ul className="space-y-1">
              {milestones.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm bg-muted rounded-md px-3 py-1.5">
                  {m.label}
                  <button type="button" onClick={() => setMilestones(prev => prev.filter(x => x.id !== m.id))}>
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </form>
    </div>
  );
}
