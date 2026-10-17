'use client';
import { Award, Check, ChevronRight } from 'lucide-react';
import type { AchievementId } from '../../core/use-cases/evaluateAchievements';
import { usePersonalProgress } from '../hooks/usePersonalProgress';
import { Badge } from '@/components/ui/badge';
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
  if (compact) return <button type="button" onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left outline-none transition-colors hover:border-border-strong focus-visible:shadow-focus">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary"><Award className="size-5" aria-hidden="true" /></span>
    <span className="min-w-0 flex-1"><span className="block text-headline-sm text-foreground">Mi Progreso</span>{' '}<span className="block font-mono text-label-mono-sm text-muted-foreground">{earned} de 6 logros personales</span></span>
    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
  </button>;
  return <section aria-label="Mi progreso" className="space-y-4">
    <header className="space-y-1">
      <p className="font-mono text-label-mono-xs uppercase text-muted-foreground">Logros personales</p>
      <h2 className="text-headline-lg-mobile text-foreground md:text-headline-lg">Mi progreso</h2>
      <p className="text-body-md text-muted-foreground">Pequeños pasos que cuentan. {earned} de 6 logros obtenidos.</p>
    </header>
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(item => {
      const copy = achievementCopy[item.id];
      return <li key={item.id} data-testid={`achievement-${item.id}`} data-earned={item.earned} className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4', item.earned ? 'border-primary/40' : 'border-border')}>
        <div className="flex items-start gap-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', item.earned ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-muted-foreground')} aria-hidden="true">{item.earned ? <Check className="size-5" /> : <Award className="size-5" />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-headline-sm text-foreground">{copy.title}</h3>
              <Badge variant={item.earned ? 'positive' : 'neutral'}>{item.earned ? 'Obtenido' : 'Pendiente'}</Badge>
            </div>
            <p className="mt-1 text-body-md text-muted-foreground">{copy.description}</p>
          </div>
        </div>
        <div className="mt-auto space-y-2">
          <progress aria-label={copy.title} className="personal-progress h-1 w-full" value={item.current} max={item.target} />
          <p className="font-mono text-label-mono-sm tabular-nums text-muted-foreground">{Math.floor(item.current)} / {item.target} {copy.unit}</p>
        </div>
      </li>;
    })}</ul>
    <p className="text-body-sm text-muted-foreground">El progreso refleja tus datos actuales. Puedes ocultarlo en Ajustes.</p>
  </section>;
}
