'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GuidedTourStep } from '../../hooks/useGuidedTour';

interface StepConfig {
  anchors: readonly string[];
  title: string;
  body: string;
}

const TOUR_STEPS: Record<GuidedTourStep, StepConfig> = {
  1: {
    anchors: ['balance'],
    title: 'Tu balance del mes',
    body: 'Aquí ves cuánto dinero tienes este mes.',
  },
  2: {
    anchors: ['accounts'],
    title: 'Tus cuentas y deudas',
    body: 'Revisa dónde está tu dinero y cuánto debes.',
  },
  3: {
    anchors: ['add'],
    title: 'Registrar',
    body: 'Toca el botón + para anotar un gasto o un ingreso.',
  },
  4: {
    anchors: ['setup', 'settings'],
    title: 'Completa tu configuración',
    body: 'Desde aquí (o en Ajustes) agregas lo que te falta.',
  },
};

function findVisibleTarget(anchors: readonly string[]): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  for (const anchor of anchors) {
    const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`);
    for (const node of Array.from(nodes)) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return node;
    }
  }
  return null;
}

interface Props {
  active: boolean;
  step: GuidedTourStep;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

/**
 * Hand-written 4-step guided tour (spec 013 FR-030..FR-032; no third-party tour library).
 * Highlights the first visible `[data-tour="..."]` target for each step and degrades
 * gracefully to a centered card if a target is absent.
 */
export default function GuidedTour({ active, step, onNext, onSkip, onFinish }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const config = TOUR_STEPS[step];

  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let scrolled = false;
    const measure = () => {
      const target = findVisibleTarget(config.anchors);
      if (!target) {
        setRect(null);
        return false;
      }
      if (!scrolled && typeof target.scrollIntoView === 'function') {
        scrolled = true;
        target.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
      setRect(target.getBoundingClientRect());
      return true;
    };

    const foundNow = measure();
    let observer: MutationObserver | null = null;
    if (!foundNow && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (measure()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, { capture: true });
    };
  }, [active, step, config.anchors]);

  useEffect(() => {
    if (!active) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, step, onSkip]);

  if (!active) return null;

  const isLast = step === 4;
  const pad = 8;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 motion-safe:transition-opacity sm:items-center"
      data-testid="guided-tour"
      data-tour-step={step}
    >
      {rect && (
        <div
          aria-hidden="true"
          data-testid="guided-tour-highlight"
          className="pointer-events-none fixed rounded-3xl ring-2 ring-primary ring-offset-2 ring-offset-background motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: Math.max(4, rect.top - pad),
            left: Math.max(4, rect.left - pad),
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-body"
        tabIndex={-1}
        className="relative z-10 w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none focus-visible:shadow-focus"
      >
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{`Paso ${step} de 4`}</p>
          <h2 id="guided-tour-title" className="font-fredoka text-xl font-semibold text-foreground">
            {config.title}
          </h2>
          <p id="guided-tour-body" className="text-sm text-muted-foreground">
            {config.body}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="ghost" className="min-h-11" onClick={onSkip}>
            Omitir
          </Button>
          <Button
            type="button"
            variant="default"
            className="min-h-11"
            onClick={isLast ? onFinish : onNext}
          >
            {isLast ? 'Listo' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </div>
  );
}
