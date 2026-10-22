'use client';

import React, { useState } from 'react';
import { AlignLeft, ListChecks, PencilLine, Plus, Target, X } from 'lucide-react';
import { LocalGoalRepository } from '../../infrastructure/repositories/local/LocalGoalRepository';
import { Goal, GoalKind, GoalMilestone } from '../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from './quickRecordUi';
import { FormShell, RadioChips } from './formUi';

interface Props {
  userId: string;
  existing?: Goal;
  /** Hides the form's own title (the host sheet already shows one). */
  embedded?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const KINDS: { value: GoalKind; label: string }[] = [
  { value: 'numeric', label: 'Numérica' },
  { value: 'checklist', label: 'Checklist' },
];

export default function GoalForm({ userId, existing, embedded, onComplete, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
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
      setError('Agrega al menos un hito.');
      return;
    }

    setIsSubmitting(true);
    try {
      const repo = new LocalGoalRepository();
      await repo.save({
        id: existing?.id ?? '',
        user_id: userId,
        name,
        description: description || undefined,
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
    <FormShell
      title={existing ? 'Editar Meta' : 'Nueva Meta'}
      embedded={embedded}
      testId="goal-form"
      onSubmit={handleSubmit}
      error={error}
      submitLabel={existing ? 'Guardar cambios' : 'Crear meta'}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
    >
      <div>
        <FieldLabel icon={PencilLine} htmlFor="goalName">Nombre</FieldLabel>
        <Input type="text" id="goalName" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <FieldLabel icon={Target} id="goal-kind-label">Tipo</FieldLabel>
        <RadioChips name="kind" labelId="goal-kind-label" value={kind} options={KINDS} onChange={setKind} />
      </div>

      {kind === 'numeric' && (
        <div>
          <FieldLabel htmlFor="targetValue">Valor objetivo</FieldLabel>
          <Input
            type="text"
            inputMode="decimal"
            id="targetValue"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </div>
      )}

      {kind === 'checklist' && (
        <div>
          <FieldLabel icon={ListChecks} htmlFor="newMilestone">Nuevo hito</FieldLabel>
          <div className="flex gap-2">
            <Input
              type="text"
              id="newMilestone"
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMilestone();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addMilestone}>
              <Plus />
              Agregar hito
            </Button>
          </div>
          <ul className="mt-2 space-y-1">
            {milestones.map(m => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-3 px-3 py-1.5 text-body-md">
                <span className="min-w-0 truncate">{m.label}</span>
                <button
                  type="button"
                  aria-label={`Quitar hito ${m.label}`}
                  onClick={() => setMilestones(prev => prev.filter(x => x.id !== m.id))}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details open={Boolean(existing?.description)} className="border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-mono text-label-mono-xs uppercase text-muted-foreground">Opciones adicionales</summary>
        <div className="pt-2">
          <FieldLabel icon={AlignLeft} htmlFor="goalDescription" hint="Opcional">Descripción</FieldLabel>
          <Input
            type="text"
            id="goalDescription"
            placeholder="Notas adicionales"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </details>
    </FormShell>
  );
}
