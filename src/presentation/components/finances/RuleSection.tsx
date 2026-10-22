'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, PieChart } from 'lucide-react';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/money';
import { Progress } from '@/components/ui/progress';
import { RingProgress } from '@/components/ui/ring-progress';
import { cn } from '@/lib/utils';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { RuleBucket, RuleCategory, RuleView } from '../../../core/use-cases/buildRuleView';
import { STATUS_DOT_CLASS, STATUS_LABEL, STATUS_PROGRESS_CLASS, BucketBar } from '../dashboard/BudgetPanel';
import { categoryIcon } from '../quickRecordUi';

const MONO_XS = 'font-mono text-label-mono-xs text-muted-foreground';

interface CategoryProps {
  category: RuleCategory;
  bucketName: string;
  /** `list` shows an icon tile (mobile list); `column` is the dense desktop card row. */
  variant: 'list' | 'column';
}

/** One expense category: spent amount and share of its bucket; expands to its subcategories when it has any. */
function CategoryLine({ category, bucketName, variant }: CategoryProps) {
  const [open, setOpen] = useState(false);
  const expandable = category.subcategories.length > 0;
  const Icon = categoryIcon(category.name);

  const head = (
    <>
      <span className="min-w-0 truncate text-body-md font-medium text-foreground">{category.name}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Money cents={category.spent} size="sm" className="font-semibold" />
        {expandable && (open
          ? <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
          : <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />)}
      </span>
    </>
  );

  return (
    <li data-testid={`rule-category-${category.id}`} className={cn(variant === 'list' && 'rounded-lg border border-border bg-card')}>
      <div className="flex w-full items-start gap-3 p-2">
        {variant === 'list' && (
          <span aria-hidden="true" className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
            <Icon className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {expandable ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(value => !value)}
              className="-mx-1 flex min-h-11 items-center justify-between gap-3 rounded-md px-1 text-left outline-none hover:bg-foreground/[0.03] focus-visible:shadow-focus"
            >
              {head}
            </button>
          ) : (
            <div className="flex min-h-11 items-center justify-between gap-3">{head}</div>
          )}
          {variant === 'list' && <span className={MONO_XS}>{bucketName}</span>}
          <Progress value={category.share} aria-label={`Participación de ${category.name} en ${bucketName}`} />
          <span className={MONO_XS}>{category.share}% de {bucketName}</span>
        </div>
      </div>
      {expandable && open && (
        <ul className="mb-2 ml-4 flex flex-col gap-1 border-l border-border pl-3 sm:ml-6">
          {category.subcategories.map(sub => (
            <li key={sub.id} className="flex justify-between gap-3 text-body-sm text-muted-foreground">
              <span className="min-w-0 truncate">{sub.name}</span>
              <span className="shrink-0 tabular-nums">{formatMoney(sub.spent)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function UncategorizedLine({ cents, variant }: { cents: number; variant: 'list' | 'column' }) {
  return (
    <li className={cn('flex min-h-11 items-center justify-between gap-3 p-2', variant === 'list' && 'rounded-lg border border-border bg-card')}>
      <span className="text-body-md text-muted-foreground">Sin categoría</span>
      <Money cents={cents} size="sm" className="font-semibold" />
    </li>
  );
}

function BucketCard({ bucket }: { bucket: RuleBucket }) {
  const Icon = categoryIcon(bucket.name);
  return (
    <Panel aria-label={`Categoría de distribución ${bucket.name}`} data-testid={`rule-bucket-${bucket.id}`}>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{bucket.name}</span>
          </span>
        }
        titleAs="h3"
        action={<Badge>{bucket.percentage}%</Badge>}
      >
        <span className={MONO_XS}>Presupuesto {formatMoney(bucket.budget)}</span>
      </PanelHeader>
      <PanelBody className="flex flex-1 flex-col gap-3">
        {bucket.categories.length === 0 && bucket.uncategorized === 0 ? (
          <p className="text-body-sm text-muted-foreground">Sin categorías de gasto en esta categoría de distribución.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {bucket.categories.map(category => (
              <CategoryLine key={category.id} category={category} bucketName={bucket.name} variant="column" />
            ))}
            {bucket.uncategorized > 0 && <UncategorizedLine cents={bucket.uncategorized} variant="column" />}
          </ul>
        )}
        <div className="mt-auto flex flex-col gap-1 rounded-lg bg-foreground/[0.03] p-3 font-mono text-label-mono-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Usado</span>
            <span className="text-foreground">{formatMoney(bucket.spent)} / {formatMoney(bucket.budget)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-label-mono-xs text-muted-foreground">
            <span>{bucket.usedPercent}% usado</span>
            <span>{bucket.remaining >= 0 ? `Disponible ${formatMoney(bucket.remaining)}` : `Excedido por ${formatMoney(-bucket.remaining, { sign: 'never' })}`}</span>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function BucketTile({ bucket }: { bucket: RuleBucket }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-3" data-testid={`rule-tile-${bucket.id}`}>
      <p className="flex items-center gap-2 font-mono text-label-mono-sm text-foreground">
        <span
          data-testid={`budget-status-${bucket.id}`}
          role="status"
          aria-label={STATUS_LABEL[bucket.status]}
          className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[bucket.status])}
        />
        <span className="truncate">{bucket.percentage}% {bucket.name}</span>
      </p>
      <Money cents={bucket.spent} size="sm" className="font-semibold" />
      <p className={MONO_XS}>de {formatMoney(bucket.budget)}</p>
      <p className={cn('font-mono text-label-mono-xs', bucket.status === 'over' ? 'text-expense' : bucket.status === 'warning' ? 'text-warning' : 'text-success')}>
        {bucket.usedPercent}% usado
      </p>
    </li>
  );
}

function NoBase({ rule }: { rule: RuleView }) {
  if (rule.base > 0) return null;
  return (
    <p className="text-body-sm text-muted-foreground">
      Sin ingreso esperado configurado: cada presupuesto es {formatMoney(0)}. Defínelo en Ajustes.
    </p>
  );
}

function DesktopRule({ rule }: { rule: RuleView }) {
  const progress = rule.totalBudget > 0 ? (rule.totalSpent / rule.totalBudget) * 100 : 0;
  return (
    <div className="flex flex-col gap-4">
      <Panel aria-label="Ejecución del ciclo" data-testid="rule-execution">
        <PanelHeader
          eyebrow="Regla presupuestal 50/30/20"
          title="Ejecución del ciclo"
          titleAs="h3"
          action={<Badge>Base: {formatMoney(rule.base)}</Badge>}
        />
        <PanelBody className="flex flex-col gap-4">
          <NoBase rule={rule} />
          <div className="flex flex-col gap-3 rounded-lg bg-foreground/[0.03] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-body-md font-medium text-foreground">Distribución global en ejecución</p>
              <p className="font-mono text-label-mono-sm text-primary">
                {formatMoney(rule.totalSpent)} gastados{rule.spentPercentOfBase !== null && ` (${rule.spentPercentOfBase}%)`}
              </p>
            </div>
            <Progress value={Math.min(progress, 100)} className={STATUS_PROGRESS_CLASS[rule.status]} aria-label="Consumo global del presupuesto" />
            <ul className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              {rule.buckets.map(bucket => <BucketTile key={bucket.id} bucket={bucket} />)}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-foreground/[0.03] p-4">
            <RingProgress value={progress} size={64} strokeWidth={6} aria-label="Presupuesto ejecutado">
              <span className="font-mono text-label-mono-xs text-foreground">{rule.spentPercentOfBase ?? 0}%</span>
            </RingProgress>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-body-md font-medium text-foreground">Presupuesto ejecutado</p>
              <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                <Money cents={rule.totalSpent} size="md" />
                <span className="text-body-md text-muted-foreground">/ {formatMoney(rule.totalBudget)}</span>
              </p>
              <p className={MONO_XS}>
                {rule.remaining >= 0
                  ? `Margen restante disponible: ${formatMoney(rule.remaining)}`
                  : `Excedido por ${formatMoney(-rule.remaining, { sign: 'never' })}`}
              </p>
            </div>
            <Badge variant={rule.status === 'over' ? 'negative' : rule.status === 'warning' ? 'warning' : 'positive'}>
              {STATUS_LABEL[rule.status]}
            </Badge>
          </div>
        </PanelBody>
      </Panel>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">
        {rule.buckets.map(bucket => <BucketCard key={bucket.id} bucket={bucket} />)}
      </div>
    </div>
  );
}

function MobileRule({ rule }: { rule: RuleView }) {
  const rows = rule.buckets.flatMap(bucket => [
    ...bucket.categories.map(category => ({ key: category.id, bucket, category })),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <Panel aria-label="Distribución mensual" data-testid="rule-execution">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-5 pb-3">
          <h3 className="flex items-center gap-2 whitespace-nowrap text-headline-md text-foreground">
            <PieChart className="size-5 text-primary" aria-hidden="true" />
            Distribución mensual
          </h3>
          <span className="flex items-center gap-1.5 font-mono text-label-mono-xs text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[rule.status])} aria-hidden="true" />
            {STATUS_LABEL[rule.status]}
          </span>
        </div>
        <PanelBody className="flex flex-col gap-3">
          <NoBase rule={rule} />
          <BucketBar rows={rule.buckets} />
          <ul className="flex flex-col gap-2">
            {rule.buckets.map(bucket => (
              <li key={bucket.id} className="flex flex-col gap-0.5 font-mono text-label-mono-sm" data-testid={`rule-tile-${bucket.id}`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-foreground">
                    <span
                      data-testid={`budget-status-${bucket.id}`}
                      role="status"
                      aria-label={STATUS_LABEL[bucket.status]}
                      className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[bucket.status])}
                    />
                    <span className="truncate">{bucket.percentage}% {bucket.name}</span>
                  </span>
                  <span className="shrink-0 text-foreground">{formatMoney(bucket.spent)}</span>
                </span>
                <span className="pl-4 text-label-mono-xs text-muted-foreground">
                  de {formatMoney(bucket.budget)} · {bucket.usedPercent}% usado
                </span>
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>

      <section aria-label="Gastos por categoría" className="flex flex-col gap-2">
        <h3 className="font-mono text-label-mono-xs uppercase text-muted-foreground">Gastos por categoría</h3>
        {rows.length === 0 && rule.buckets.every(bucket => bucket.uncategorized === 0) ? (
          <p className="text-body-md text-muted-foreground">Sin categorías de gasto todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(({ key, bucket, category }) => (
              <CategoryLine key={key} category={category} bucketName={bucket.name} variant="list" />
            ))}
            {rule.buckets.filter(bucket => bucket.uncategorized > 0).map(bucket => (
              <UncategorizedLine key={`uncategorized-${bucket.id}`} cents={bucket.uncategorized} variant="list" />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface Props {
  rule: RuleView;
  desktop: boolean;
}

/** Regla 50/30/20: execution of the cycle plus the spending of each expense category per bucket. */
export default function RuleSection({ rule, desktop }: Props) {
  if (!rule.hasBuckets) {
    return (
      <Panel aria-label="Regla 50/30/20" data-testid="rule-section">
        <PanelBody className="pt-5">
          <p className="text-body-md text-muted-foreground">No hay categorías de distribución configuradas todavía.</p>
        </PanelBody>
      </Panel>
    );
  }
  return (
    <div aria-label="Regla 50/30/20" role="group" data-testid="rule-section">
      {desktop ? <DesktopRule rule={rule} /> : <MobileRule rule={rule} />}
    </div>
  );
}
