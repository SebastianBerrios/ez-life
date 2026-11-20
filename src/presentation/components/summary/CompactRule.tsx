'use client';

import React from 'react';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';
import type { CompactBucketKind, CompactRule } from '../../../core/use-cases/buildCompactRule';
import { SUMMARY_MASKED_AMOUNT } from './HideAmountsToggle';

const PILL_STYLES: Record<CompactBucketKind, string> = {
  needs: 'bg-pill-needs text-pill-needs-foreground',
  wants: 'bg-pill-wants text-pill-wants-foreground',
  savings: 'bg-pill-savings text-pill-savings-foreground',
};

const BAR_STYLES: Record<CompactBucketKind, string> = {
  needs: 'bg-pill-needs-foreground/75',
  wants: 'bg-pill-wants-foreground/75',
  savings: 'bg-pill-savings-foreground/75',
};

function maskMoneyInPhrase(phrase: string): string {
  return phrase.replace(/-?S\/\s*[\d,]+(?:\.\d{2})?/g, SUMMARY_MASKED_AMOUNT);
}

interface Props {
  rule: CompactRule;
  hidden?: boolean;
}

/**
 * Section 4 of the minimalist Summary: compact 50/30/20 bar with neutral phrases
 * (spec 013 FR-034, FR-010). Negative savings renders as neutral information with
 * a floor-0 progress bar (no error tone).
 */
export default function CompactRuleView({ rule, hidden = false }: Props) {
  return (
    <Panel aria-label="Regla 50/30/20" className="gap-4 p-5" data-testid="compact-rule">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-fredoka text-lg font-semibold text-foreground">50/30/20</h2>
      </div>

      {!rule.hasBuckets ? (
        <p className="text-sm text-muted-foreground">Configura tu distribución 50/30/20 en Ajustes.</p>
      ) : (
        <div className="space-y-3">
          {rule.buckets.map(bucket => (
            <div
              key={bucket.id}
              data-testid={`compact-rule-bucket-${bucket.id}`}
              data-bucket-kind={bucket.kind}
              data-negative-savings={bucket.negativeSavings ? 'true' : 'false'}
              className="space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    PILL_STYLES[bucket.kind],
                  )}
                >
                  {`${bucket.name} · ${bucket.percentage}%`}
                </span>
                <span className="text-xs text-muted-foreground">{`${bucket.barPercent}%`}</span>
              </div>

              <div
                role="progressbar"
                aria-label={bucket.name}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={bucket.barPercent}
                className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className={cn('h-full rounded-full transition-[width] duration-300', BAR_STYLES[bucket.kind])}
                  style={{ width: `${bucket.barPercent}%` }}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                {hidden ? maskMoneyInPhrase(bucket.phrase) : bucket.phrase}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
