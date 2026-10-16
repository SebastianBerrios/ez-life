'use client';
import { Award, Check, ChevronRight } from 'lucide-react';
import type { AchievementId } from '../../core/use-cases/evaluateAchievements';
import { usePersonalProgress } from '../hooks/usePersonalProgress';

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
  if (loading) return compact ? null : <p role="status">Cargando tu progreso…</p>;
  if (error) return compact ? null : <p role="alert">No pudimos cargar tu progreso. Vuelve a abrir esta sección.</p>;
  if (!visible) return compact ? null : <p className="text-muted-foreground">Tu progreso está oculto. Puedes mostrarlo desde Ajustes; tus datos se conservan.</p>;
  const earned = items.filter(item => item.earned).length;
  if (compact) return <button onClick={onOpen} className="w-full flex items-center gap-3 border-y border-border py-4 text-left">
    <Award className="h-5 w-5 text-primary" aria-hidden="true" />
    <span className="flex-1"><span className="block text-sm font-semibold">Mi progreso</span><span className="text-sm text-muted-foreground">{earned} de 6 logros personales</span></span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
  </button>;
  return <section aria-label="Mi progreso" className="space-y-6">
    <header className="space-y-2"><h2 className="font-heading text-3xl">Mi progreso</h2><p className="text-muted-foreground text-sm">Pequeños pasos que cuentan. {earned} de 6 logros obtenidos.</p></header>
    <ul className="divide-y divide-border border-y border-border">{items.map(item => {
      const copy = achievementCopy[item.id];
      return <li key={item.id} className="py-5 flex gap-4">
        <span className={`mt-1 ${item.earned ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true">{item.earned ? <Check className="h-5 w-5" /> : <Award className="h-5 w-5" />}</span>
        <div className="flex-1 min-w-0"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-sm">{copy.title}</h3><span className="text-xs text-muted-foreground">{item.earned ? 'Obtenido' : 'Pendiente'}</span></div>
          <p className="text-sm text-muted-foreground mt-1 mb-3">{copy.description}</p>
          <progress aria-label={copy.title} className="personal-progress w-full h-1" value={item.current} max={item.target} />
          <p className="text-xs text-muted-foreground mt-2">{Math.floor(item.current)} / {item.target} {copy.unit}</p>
        </div>
      </li>;
    })}</ul><p className="text-xs text-muted-foreground">El progreso refleja tus datos actuales. Puedes ocultarlo en Ajustes.</p>
  </section>;
}
