'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, PieChart } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { RuleBucket, RuleCategory, RuleView } from '../../../core/use-cases/buildRuleView';
import { formatRuleBucketPhrase } from '../../../core/use-cases/formatFinancesPhrases';
import { STATUS_DOT_CLASS, STATUS_LABEL, STATUS_PROGRESS_CLASS } from './ruleStatusUi';

function bucketPillClass(bucket: RuleBucket, isSavings: boolean, index: number): string {
  if (isSavings) return 'bg-pill-savings text-pill-savings-foreground';
  const lower = bucket.name.toLowerCase();
  if (lower.includes('necesidad')) return 'bg-pill-needs text-pill-needs-foreground';
  if (lower.includes('deseo') || lower.includes('gusto')) return 'bg-pill-wants text-pill-wants-foreground';
  if (index === 0) return 'bg-pill-needs text-pill-needs-foreground';
  if (index === 1) return 'bg-pill-wants text-pill-wants-foreground';
  return 'bg-pill-savings text-pill-savings-foreground';
}

function CategoryRow({ category, bucketName }: { category: RuleCategory; bucketName: string }) {
  const [open, setOpen] = useState(false);
  const expandable = category.subcategories.length > 0;

  const head = (
    <>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{category.name}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Money cents={category.spent} size="sm" className="font-semibold" />
        {expandable && (
          open
            ? <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
            : <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
    </>
  );

  return (
    <li data-testid={`rule-category-${category.id}`} className="flex flex-col gap-1.5 py-1">
      {expandable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-1 text-left outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {head}
        </button>
      ) : (
        <div className="flex min-h-11 items-center justify-between gap-3 px-1">{head}</div>
      )}
      <Progress value={category.share} aria-label={`Participación de ${category.name} en ${bucketName}`} />
      <span className="text-xs text-muted-foreground">{category.share}% de {bucketName}</span>
      {expandable && open && (
        <ul className="ml-3 flex flex-col gap-1 pl-3">
          {category.subcategories.map(sub => (
            <li key={sub.id} className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{sub.name}</span>
              <span className="shrink-0 tabular-nums">{formatMoney(sub.spent)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface BucketCardProps {
  bucket: RuleBucket;
  isSavings: boolean;
  index: number;
}

function BucketCard({ bucket, isSavings, index }: BucketCardProps) {
  const phrase = formatRuleBucketPhrase(bucket, isSavings);
  const progressValue = Math.min(Math.max(bucket.progress, 0), 100);
  const categoryCount = bucket.categories.length + (bucket.uncategorized > 0 ? 1 : 0);

  return (
    <Panel
      aria-label={`Bloque ${bucket.name}`}
      data-testid={`rule-bucket-${bucket.id}`}
      className="gap-3 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
            bucketPillClass(bucket, isSavings, index),
          )}
        >
          {bucket.percentage}% · {bucket.name}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            data-testid={`budget-status-${bucket.id}`}
            role="status"
            aria-label={STATUS_LABEL[bucket.status]}
            className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[bucket.status])}
          />
          {bucket.usedPercent}% usado
        </span>
      </div>

      <p className="font-fredoka text-headline-sm text-foreground">{phrase}</p>

      <Progress
        value={progressValue}
        className={STATUS_PROGRESS_CLASS[bucket.status]}
        aria-label={`Avance de ${bucket.name}`}
      />

      {categoryCount > 0 ? (
        <CollapsibleSection
          variant="inline"
          defaultOpen={false}
          title={categoryCount === 1 ? 'Ver 1 categoría' : `Ver ${categoryCount} categorías`}
        >
          <ul className="flex flex-col gap-2">
            {bucket.categories.map(category => (
              <CategoryRow key={category.id} category={category} bucketName={bucket.name} />
            ))}
            {bucket.uncategorized > 0 && (
              <li className="flex min-h-11 items-center justify-between gap-3 px-1">
                <span className="text-sm text-muted-foreground">Sin categoría</span>
                <Money cents={bucket.uncategorized} size="sm" className="font-semibold" />
              </li>
            )}
          </ul>
        </CollapsibleSection>
      ) : (
        <p className="text-xs text-muted-foreground">Sin movimientos en este bloque todavía.</p>
      )}
    </Panel>
  );
}

interface Props {
  rule: RuleView;
  savingsBucketIds?: ReadonlySet<string>;
}

/** Regla 50/30/20: single hero % spent of monthly income + warm bucket cards with pastel pills. */
export default function RuleSection({ rule, savingsBucketIds }: Props) {
  if (!rule.hasBuckets) {
    return (
      <div aria-label="Regla 50/30/20" role="group" data-testid="rule-section">
        <EmptyState
          icon={<PieChart className="size-6" />}
          title="Aún no configuras tu regla 50/30/20"
          description="Define cómo quieres distribuir tu ingreso desde Ajustes para ver tu avance aquí."
        />
      </div>
    );
  }

  return (
    <div aria-label="Regla 50/30/20" role="group" data-testid="rule-section" className="flex flex-col gap-4">
      <Panel data-testid="rule-execution" className="gap-1.5 p-5">
        <p className="text-sm font-medium text-muted-foreground">Regla 50/30/20</p>
        {rule.spentPercentOfBase !== null ? (
          <>
            <p className="font-fredoka text-display-hero-mobile md:text-display-hero tabular-nums text-foreground">
              {rule.spentPercentOfBase}%
            </p>
            <p className="text-sm text-muted-foreground">
              Llevas {formatMoney(rule.totalSpent)} de {formatMoney(rule.base)} de tu ingreso mensual.
            </p>
          </>
        ) : (
          <>
            <p className="font-fredoka text-headline-lg text-foreground">Sin ingreso esperado</p>
            <p className="text-sm text-muted-foreground">
              Configura tu ingreso mensual en Ajustes para calcular tu presupuesto 50/30/20.
            </p>
          </>
        )}
      </Panel>

      <div className="flex flex-col gap-3">
        {rule.buckets.map((bucket, index) => (
          <BucketCard
            key={bucket.id}
            bucket={bucket}
            isSavings={savingsBucketIds?.has(bucket.id) ?? false}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
