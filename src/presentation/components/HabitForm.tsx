'use client';

import React, { useState } from 'react';
import { CalendarDays, PencilLine, Smile } from 'lucide-react';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { DayOfWeek, Habit, HabitScheduleMode } from '../../core/domain/models/types';
import { Input } from '@/components/ui/input';
import { FieldLabel } from './quickRecordUi';
import { FormShell, RadioChips, WeekdayChips } from './formUi';

interface Props {
  userId: string;
  existing?: Habit;
  /** Hides the form's own title (the host sheet already shows one). */
  embedded?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const MODES: { value: HabitScheduleMode; label: string }[] = [
  { value: 'fixed_days', label: 'Días fijos' },
  { value: 'frequency', label: 'Frecuencia libre' },
];

export default function HabitForm({ userId, existing, embedded, onComplete, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [scheduleMode, setScheduleMode] = useState<HabitScheduleMode>(existing?.schedule_mode ?? 'fixed_days');
  const [fixedDays, setFixedDays] = useState<DayOfWeek[]>(existing?.fixed_days ?? []);
  const [frequencyTarget, setFrequencyTarget] = useState(existing?.frequency_target?.toString() ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: DayOfWeek) => {
    setFixedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (scheduleMode === 'fixed_days' && fixedDays.length === 0) {
      setError('Elige al menos un día de la semana.');
      return;
    }
    if (scheduleMode === 'frequency' && (!frequencyTarget || Number(frequencyTarget) < 1)) {
      setError('La frecuencia debe ser al menos 1 vez por semana.');
      return;
    }

    setIsSubmitting(true);
    try {
      const repo = new LocalHabitRepository();
      await repo.save({
        id: existing?.id ?? '',
        user_id: userId,
        name,
        icon: icon || undefined,
        schedule_mode: scheduleMode,
        fixed_days: scheduleMode === 'fixed_days' ? fixedDays : undefined,
        frequency_target: scheduleMode === 'frequency' ? Number(frequencyTarget) : undefined,
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el hábito.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormShell
      title={existing ? 'Editar Hábito' : 'Nuevo Hábito'}
      embedded={embedded}
      testId="habit-form"
      onSubmit={handleSubmit}
      error={error}
      submitLabel={existing ? 'Guardar cambios' : 'Crear hábito'}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
    >
      <div>
        <FieldLabel icon={PencilLine} htmlFor="habitName">Nombre</FieldLabel>
        <Input
          type="text"
          id="habitName"
          required
          placeholder="Ej. Correr"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <FieldLabel icon={CalendarDays} id="habit-schedule-label">Horario</FieldLabel>
        <RadioChips name="scheduleMode" labelId="habit-schedule-label" value={scheduleMode} options={MODES} onChange={setScheduleMode} />
      </div>

      {scheduleMode === 'fixed_days' && <WeekdayChips value={fixedDays} onToggle={toggleDay} />}

      {scheduleMode === 'frequency' && (
        <div>
          <FieldLabel htmlFor="frequencyTarget">Veces por semana</FieldLabel>
          <Input
            type="text"
            inputMode="numeric"
            id="frequencyTarget"
            value={frequencyTarget}
            onChange={(e) => setFrequencyTarget(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
      )}

      <details open={Boolean(existing?.icon)} className="border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-mono text-label-mono-xs uppercase text-muted-foreground">Opciones adicionales</summary>
        <div className="pt-2">
          <FieldLabel icon={Smile} htmlFor="habitIcon" hint="Opcional">Ícono</FieldLabel>
          <Input
            type="text"
            id="habitIcon"
            placeholder="Ej. 🏃"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
        </div>
      </details>
    </FormShell>
  );
}
