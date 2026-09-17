'use client';

import React, { useState } from 'react';
import { LocalHabitRepository } from '../../infrastructure/repositories/local/LocalHabitRepository';
import { DayOfWeek, HabitScheduleMode } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  userId: string;
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

export default function HabitForm({ userId, onComplete, onCancel }: Props) {
  const [name, setName] = useState('');
  const [scheduleMode, setScheduleMode] = useState<HabitScheduleMode>('fixed_days');
  const [fixedDays, setFixedDays] = useState<DayOfWeek[]>([]);
  const [frequencyTarget, setFrequencyTarget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: DayOfWeek) => {
    setFixedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (scheduleMode === 'fixed_days' && fixedDays.length === 0) {
      setError('Elegí al menos un día de la semana.');
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
        id: '',
        user_id: userId,
        name,
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
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">Nuevo Hábito</h2>
      <form onSubmit={handleSubmit} data-testid="habit-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="habitName">Nombre</Label>
          <Input
            type="text"
            id="habitName"
            required
            placeholder="Ej. Correr"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Horario</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scheduleMode"
                checked={scheduleMode === 'fixed_days'}
                onChange={() => setScheduleMode('fixed_days')}
              />
              Días fijos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scheduleMode"
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
            <Label htmlFor="frequencyTarget">Veces por semana</Label>
            <Input
              type="text"
              id="frequencyTarget"
              value={frequencyTarget}
              onChange={(e) => setFrequencyTarget(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        )}

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
