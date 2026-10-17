'use client';

import React, { useState } from 'react';
import { CalendarDays, Flag, PencilLine, Repeat, Tag, AlignLeft } from 'lucide-react';
import { LocalTaskRepository } from '../../infrastructure/repositories/local/LocalTaskRepository';
import { DayOfWeek, Task, TaskPriority, TaskScheduleMode } from '../../core/domain/models/types';
import { calendarKey, parseCalendarDate } from '../../core/use-cases/calendar';
import { uuidv7 } from 'uuidv7';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { FieldLabel } from './quickRecordUi';
import { FormShell, RadioChips, WeekdayChips } from './formUi';

interface Props {
  userId: string;
  existing?: Task;
  /** Hides the form's own title (the host sheet already shows one). */
  embedded?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

const MODES: { value: TaskScheduleMode; label: string }[] = [
  { value: 'fixed_days', label: 'Días fijos' },
  { value: 'frequency', label: 'Frecuencia libre' },
];

export default function TaskForm({ userId, existing, embedded, onComplete, onCancel }: Props) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [dueDate, setDueDate] = useState(existing ? calendarKey(existing.due_date) : '');
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? 'medium');
  const [tag, setTag] = useState(existing?.tag ?? '');
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

    let dueDateValue: Date;
    try {
      dueDateValue = parseCalendarDate(dueDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La fecha no es válida.');
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
        due_date: dueDateValue,
        priority,
        tag: tag.trim() || undefined,
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
    <FormShell
      title={existing ? 'Editar Tarea' : 'Nueva Tarea'}
      embedded={embedded}
      testId="task-form"
      onSubmit={handleSubmit}
      error={error}
      submitLabel={existing ? 'Guardar cambios' : 'Crear tarea'}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
    >
      <div>
        <FieldLabel icon={PencilLine} htmlFor="taskTitle">Título</FieldLabel>
        <Input type="text" id="taskTitle" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <FieldLabel icon={CalendarDays} htmlFor="dueDate">Fecha límite</FieldLabel>
        <Input type="date" id="dueDate" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      <div>
        <FieldLabel icon={Flag}>Prioridad</FieldLabel>
        <Segmented
          ariaLabel="Prioridad"
          fullWidth
          value={priority}
          onValueChange={(value) => setPriority(value as TaskPriority)}
          options={PRIORITIES}
        />
      </div>

      <div>
        <FieldLabel icon={Tag} htmlFor="taskTag" hint="Opcional">Etiqueta</FieldLabel>
        <Input type="text" id="taskTag" placeholder="Ej. Maestría / Estudio" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <FieldLabel icon={Repeat} className="mb-0">Repetir tarea</FieldLabel>
        <Switch aria-label="Repetir tarea" checked={isRecurring} onCheckedChange={setIsRecurring} />
      </div>

      {isRecurring && (
        <div className="space-y-3">
          <div>
            <FieldLabel id="task-recurrence-label">Repetición</FieldLabel>
            <RadioChips name="taskScheduleMode" labelId="task-recurrence-label" value={scheduleMode} options={MODES} onChange={setScheduleMode} />
          </div>

          {scheduleMode === 'fixed_days' && <WeekdayChips value={fixedDays} onToggle={toggleDay} />}

          {scheduleMode === 'frequency' && (
            <div>
              <FieldLabel htmlFor="taskFrequencyTarget">Veces por semana</FieldLabel>
              <Input
                type="text"
                inputMode="numeric"
                id="taskFrequencyTarget"
                value={frequencyTarget}
                onChange={(e) => setFrequencyTarget(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
          )}
        </div>
      )}

      <details open={Boolean(existing?.description)} className="border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-mono text-label-mono-xs uppercase text-muted-foreground">Opciones adicionales</summary>
        <div className="pt-2">
          <FieldLabel icon={AlignLeft} htmlFor="taskDescription" hint="Opcional">Descripción</FieldLabel>
          <Input
            type="text"
            id="taskDescription"
            placeholder="Notas adicionales"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </details>
    </FormShell>
  );
}
