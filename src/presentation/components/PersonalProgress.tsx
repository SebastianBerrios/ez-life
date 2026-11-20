'use client';

import { Award, Check, ChevronRight } from 'lucide-react';
import type { AchievementId } from '../../core/use-cases/evaluateAchievements';
import { usePersonalProgress } from '../hooks/usePersonalProgress';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

export const achievementCopy: Record<AchievementId, { title: string; description: string; unit: string }> = {
  registration: { title: 'Registro constante', description: 'Registra movimientos personales en 7 fechas distintas.', unit: 'fechas' },
  tasks: { title: 'Tareas cumplidas', description: 'Completa 10 tareas, a tu ritmo.', unit: 'tareas' },
  goal: { title: 'Objetivo alcanzado', description: 'Completa una meta personal.', unit: 'meta' },
  consistency: { title: 'Constancia', description: 'Cumple la programación de un hábito durante 4 semanas completas consecutivas, sin comodines.', unit: 'semanas' },
  savings_half: { title: 'A medio camino', description: 'Llega al 50% de una meta de ahorro.', unit: '%' },
  savings_full: { title: 'Ahorro logrado', description: 'Alcanza el 100% de una meta de ahorro.', unit: '%' },
};

export default function PersonalProgress({ userId, compact = false, onOpen }: { userId: string; compact?: boolean; onOpen?: () => void }) {
  const { items, visible, loading, error } = usePersonalProgress(userId);
  if (loading) return compact ? null : <p role="status" className="text-body-md text-muted-foreground">Cargando tu progreso…</p>;
  if (error) return compact ? null : <p role="alert" className="text-body-md text-destructive">No pudimos cargar tu progreso. Vuelve a abrir esta sección.</p>;
  if (!visible) return compact ? null : <p className="text-body-md text-muted-foreground">Tu progreso está oculto. Puedes mostrarlo desde Ajustes; tus datos se conservan.</p>;
  const earned = items.filter(item => item.earned).length;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 w-full items-center gap-3 rounded-card bg-card p-4 text-left shadow-card outline-none transition-colors hover:bg-surface-2/60 focus-visible:shadow-focus"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
          <Award className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-fredoka text-headline-sm text-foreground">Mi progreso</span>
          <span className="block text-sm text-muted-foreground">{earned} de 6 logros</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section aria-label="Mi progreso" className="space-y-4">
      <Panel className="gap-1.5 p-5" data-testid="progress-hero">
        <p className="text-sm font-medium text-muted-foreground">Mi progreso</p>
        <h2 className="font-fredoka text-display-hero-mobile text-foreground">
          {earned} de 6 logros
        </h2>
        <p className="text-sm text-muted-foreground">
          Pequeños pasos que cuentan. Puedes ocultar esta sección desde Ajustes cuando quieras.
        </p>
      </Panel>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(item => {
          const copy = achievementCopy[item.id];
          return (
            <li
              key={item.id}
              data-testid={`achievement-${item.id}`}
              data-earned={item.earned}
              className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-card"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    item.earned ? 'bg-pill-savings text-pill-savings-foreground' : 'bg-surface-2 text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {item.earned ? <Check className="size-5" /> : <Award className="size-5" />}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-fredoka text-headline-sm text-foreground">{copy.title}</h3>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        item.earned
                          ? 'bg-pill-savings text-pill-savings-foreground'
                          : 'bg-surface-2 text-muted-foreground',
                      )}
                    >
                      {item.earned ? 'Logrado' : 'En curso'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{copy.description}</p>
                </div>
              </div>
              <div className="mt-auto space-y-1.5">
                <progress aria-label={copy.title} className="personal-progress h-1.5 w-full" value={item.current} max={item.target} />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {Math.floor(item.current)} / {item.target} {copy.unit}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
