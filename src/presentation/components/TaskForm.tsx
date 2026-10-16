'use client';

import React, { useState } from 'react';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { DayOfWeek, Task, TaskScheduleMode } from '../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  existing?: Task;
  onComplete: () => void;
  onCancel: () => void;
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'mon', label: 'Lunes' },
  { value: 'tue', label: 'Martes' },
  { value: 'wed', label: 'Miércoles' },
  { value: 'thu', label: 'Jueves' },
  { value: 'fri', label: 'Viernes' },
  { value: 'sat', label: 'Sábado' },
  { value: 'sun', label: 'Domingo' },
];

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function TaskForm({ userId, existing, onComplete, onCancel }: Props) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [dueDate, setDueDate] = useState(existing ? toDateInputValue(existing.due_date) : '');
  const [isRecurring, setIsRecurring] = useState(Boolean(existing?.schedule_mode));
  const [scheduleMode, setScheduleMode] = useState<TaskScheduleMode>(existing?.schedule_mode ?? 'fixed_days');
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

    if (isRecurring && scheduleMode === 'fixed_days' && fixedDays.length === 0) {
      setError('Elegí al menos un día de la semana.');
      return;
    }
    if (isRecurring && scheduleMode === 'frequency' && (!frequencyTarget || Number(frequencyTarget) < 1)) {
      setError('La frecuencia debe ser al menos 1 vez por semana.');
      return;
    }

    setIsSubmitting(true);

    try {
      const repo = new LocalTaskRepository();
      await repo.save({
        id: existing?.id ?? '',
        user_id: userId,
        title,
        description: description || undefined,
        due_date: new Date(dueDate),
        status: existing?.status ?? 'pending',
        done_at: existing?.done_at,
        schedule_mode: isRecurring ? scheduleMode : undefined,
        fixed_days: isRecurring && scheduleMode === 'fixed_days' ? fixedDays : undefined,
        frequency_target: isRecurring && scheduleMode === 'frequency' ? Number(frequencyTarget) : undefined,
        recurrence_series_id: isRecurring ? (existing?.recurrence_series_id ?? uuidv7()) : undefined,
        recurrence_active: isRecurring ? true : undefined,
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">{existing ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
      <form onSubmit={handleSubmit} data-testid="task-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="taskTitle">Título</Label>
          <Input type="text" id="taskTitle" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Fecha límite</Label>
          <Input type="date" id="dueDate" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <details open={Boolean(existing?.description || existing?.schedule_mode)} className="border-t border-border pt-2"><summary className="text-sm font-medium">Opciones adicionales</summary><div className="space-y-4 pt-3">
        <div className="space-y-2">
          <Label htmlFor="taskDescription">Descripción (opcional)</Label>
          <Input
            type="text"
            id="taskDescription"
            placeholder="Notas adicionales"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Repetir tarea"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Repetir tarea
          </label>
        </div>

        {isRecurring && (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Repetición</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="taskScheduleMode"
                    checked={scheduleMode === 'fixed_days'}
                    onChange={() => setScheduleMode('fixed_days')}
                  />
                  Días fijos
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="taskScheduleMode"
                    aria-label="Frecuencia libre"
                    checked={scheduleMode === 'frequency'}
                    onChange={() => setScheduleMode('frequency')}
                  />
                  Frecuencia libre
                </label>
              </div>
            </fieldset>

            {scheduleMode === 'fixed_days' && (
              <div className="grid grid-cols-4 gap-2">
                {DAYS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      aria-label={label}
                      checked={fixedDays.includes(value)}
                      onChange={() => toggleDay(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {scheduleMode === 'frequency' && (
              <div className="space-y-2">
                <Label htmlFor="taskFrequencyTarget">Veces por semana</Label>
                <Input
                  type="text"
                  id="taskFrequencyTarget"
                  value={frequencyTarget}
                  onChange={(e) => setFrequencyTarget(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            )}
          </>
        )}

        </div></details>

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
