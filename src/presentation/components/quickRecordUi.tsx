import React from 'react';
import {
  Bus, GraduationCap, Gamepad2, HeartPulse, House, PiggyBank, Shirt, Tag, Utensils, Zap,
  type LucideIcon,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PaymentAccount } from '../../core/domain/models/types';

/** Pill used by the payment-account radios (native radio inside, visually hidden). */
export const choiceChipClass = (checked: boolean) =>
  cn(
    'flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-body-md transition-colors has-[:focus-visible]:shadow-focus',
    checked
      ? 'border-primary/40 bg-surface-3 font-medium text-primary'
      : 'border-border bg-card text-muted-foreground hover:bg-surface-3 hover:text-foreground'
  );

/** Payment account chips as a radio group; `labelId` points at the visible group label. */
export function AccountChips({
  labelId,
  name,
  accounts,
  value,
  onChange,
}: {
  labelId: string;
  name: string;
  accounts: PaymentAccount[];
  value: string;
  onChange: (accountId: string) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {accounts.map(account => (
        <label key={account.id} className={choiceChipClass(account.id === value)}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={account.id === value}
            onChange={() => onChange(account.id)}
          />
          <span className="truncate">{account.name}</span>
        </label>
      ))}
    </div>
  );
}

/** Date + time inputs styled as one row with a status dot (labels are screen-reader only). */
export function DateTimeRow({
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:border-primary focus-within:shadow-focus">
      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <Label htmlFor="movement-date" className="sr-only">Fecha</Label>
      <input
        id="movement-date"
        type="date"
        required
        value={date}
        onChange={event => onDateChange(event.target.value)}
        className="min-h-11 min-w-0 flex-1 bg-transparent text-body-lg tabular-nums text-foreground outline-none md:text-body-md"
      />
      <Label htmlFor="movement-time" className="sr-only">Hora</Label>
      <input
        id="movement-time"
        type="time"
        required
        value={time}
        onChange={event => onTimeChange(event.target.value)}
        className="min-h-11 w-24 bg-transparent text-body-lg tabular-nums text-foreground outline-none md:text-body-md"
      />
    </div>
  );
}

/**
 * Mono uppercase micro-label with an icon, used above every field group of the quick-record forms.
 * Renders a real `<label>` when `htmlFor` is given, otherwise a `<span>` (id-able, for aria-labelledby).
 */
export function FieldLabel({
  icon: Icon,
  htmlFor,
  id,
  hint,
  className,
  children,
}: {
  icon?: LucideIcon;
  htmlFor?: string;
  id?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const Wrapper = htmlFor ? 'label' : 'span';
  return (
    <div className={cn('mb-1.5 flex items-center justify-between gap-2', className)}>
      <Wrapper
        id={id}
        {...(htmlFor ? { htmlFor } : {})}
        className="flex items-center gap-1.5 font-mono text-label-mono-xs uppercase text-muted-foreground"
      >
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {children}
      </Wrapper>
      {hint && <span className="font-mono text-label-mono-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

const CATEGORY_ICONS: Array<[RegExp, LucideIcon]> = [
  [/aliment|comida|restaur|supermerc|mercado/i, Utensils],
  [/transporte|combustible|movilidad|taxi|gasolina/i, Bus],
  [/entretenim|salidas|ocio|diversi|juego/i, Gamepad2],
  [/ahorro|inversi|fondo|futuro/i, PiggyBank],
  [/salud|medic|farmacia|bienestar/i, HeartPulse],
  [/vivienda|casa|hogar|alquiler|renta/i, House],
  [/educaci|estudio|curso|maestr/i, GraduationCap],
  [/servicio|luz|agua|internet|telefon/i, Zap],
  [/ropa|vestimenta|compras/i, Shirt],
  [/necesid|esencial/i, House],
  [/deseo|gusto/i, Gamepad2],
];

/** Decorative icon for an expense category, picked from its name (the data model has no icon). */
export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Tag;
}
