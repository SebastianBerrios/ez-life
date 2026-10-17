import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DayOfWeek } from '../../core/domain/models/types';
import { choiceChipClass } from './quickRecordUi';

/**
 * Shared chrome of the Hábito / Tarea / Meta / Ahorro forms (same look as the quick-record forms):
 * an optional own title (standalone use; the sheet header supplies it when `embedded`), the fields,
 * an inline error and a sticky full-width primary action with an optional secondary one.
 */
export function FormShell({
  title,
  embedded,
  testId,
  onSubmit,
  error,
  submitLabel,
  isSubmitting,
  onCancel,
  children,
}: {
  title: string;
  /** Hides the own title: the host (QuickRecordSheet / edit sheet) already shows one. */
  embedded?: boolean;
  testId: string;
  onSubmit: (event: React.FormEvent) => void;
  error: string | null;
  submitLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      {!embedded && <h2 className="mb-4 text-headline-sm text-foreground">{title}</h2>}
      <form onSubmit={onSubmit} data-testid={testId} className="space-y-4">
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">{children}</div>

        {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}

        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t border-border bg-popover px-4 pb-4 pt-3">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="w-full">
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Native radio group dressed as chips: the visible text labels each (screen-reader-only) input. */
export function RadioChips<T extends string>({
  name,
  labelId,
  value,
  options,
  onChange,
}: {
  name: string;
  /** Id of the visible group label (`FieldLabel id=...`). */
  labelId: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(option => (
        <label key={option.value} className={choiceChipClass(option.value === value)}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className="truncate">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export const WEEKDAYS: { value: DayOfWeek; short: string; label: string }[] = [
  { value: 'mon', short: 'Lun', label: 'Lunes' },
  { value: 'tue', short: 'Mar', label: 'Martes' },
  { value: 'wed', short: 'Mié', label: 'Miércoles' },
  { value: 'thu', short: 'Jue', label: 'Jueves' },
  { value: 'fri', short: 'Vie', label: 'Viernes' },
  { value: 'sat', short: 'Sáb', label: 'Sábado' },
  { value: 'sun', short: 'Dom', label: 'Domingo' },
];

/** Weekday toggle chips: a real checkbox per day (accessible name = the full day) inside a chip. */
export function WeekdayChips({ value, onToggle }: { value: DayOfWeek[]; onToggle: (day: DayOfWeek) => void }) {
  return (
    <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1.5">
      {WEEKDAYS.map(({ value: day, short, label }) => {
        const checked = value.includes(day);
        return (
          <label
            key={day}
            className={cn(choiceChipClass(checked), 'px-0 font-mono text-label-mono-sm uppercase')}
          >
            <input type="checkbox" className="sr-only" aria-label={label} checked={checked} onChange={() => onToggle(day)} />
            <span aria-hidden="true">{short}</span>
          </label>
        );
      })}
    </div>
  );
}
