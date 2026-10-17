'use client';

import React from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_CATEGORIES, type CategoryOption, type MovementFilter, type MovementSelection } from '../../../core/use-cases/filterMovements';
import { cn } from '@/lib/utils';

interface Props {
  selection: MovementSelection;
  onChange: (next: MovementSelection) => void;
  counts: Record<MovementFilter, number>;
  categories: CategoryOption[];
  /** Dense desktop styling for the tabs. */
  desktop: boolean;
  /** Renders only the search box (the desktop header places it next to the title). */
  part?: 'all' | 'search' | 'filters';
  className?: string;
}

const FILTER_LABELS: Array<{ value: MovementFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transferencias' },
  { value: 'shared', label: 'Compartido' },
];

export function SearchField({ selection, onChange, className }: Pick<Props, 'selection' | 'onChange' | 'className'>) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        aria-label="Buscar movimientos"
        placeholder="Buscar concepto, cuenta o monto…"
        value={selection.query}
        onChange={event => onChange({ ...selection, query: event.target.value })}
        className="pl-9"
      />
    </div>
  );
}

/** Filter tabs, category filter and date-sort toggle of the movement history. */
export default function MovementToolbar({ selection, onChange, counts, categories, desktop, part = 'all', className }: Props) {
  const newestFirst = selection.sort === 'desc';
  const showSearch = part === 'all' || part === 'search';
  const showFilters = part === 'all' || part === 'filters';

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      {showSearch && <SearchField selection={selection} onChange={onChange} />}
      {showFilters && (
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Segmented
            ariaLabel="Filtrar movimientos"
            size={desktop ? 'sm' : 'md'}
            value={selection.filter}
            onValueChange={value => onChange({ ...selection, filter: value as MovementFilter })}
            options={FILTER_LABELS.map(option => ({ ...option, count: counts[option.value] }))}
            className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={selection.categoryId}
              onValueChange={value => onChange({ ...selection, categoryId: value ?? ALL_CATEGORIES })}
            >
              <SelectTrigger aria-label="Filtrar por categoría" className="min-w-0 flex-1 md:w-56 md:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange({ ...selection, sort: newestFirst ? 'asc' : 'desc' })}
              title={newestFirst ? 'Más recientes primero' : 'Más antiguos primero'}
              className="shrink-0"
            >
              {newestFirst ? <ArrowDownWideNarrow aria-hidden="true" /> : <ArrowUpNarrowWide aria-hidden="true" />}
              <span className="max-sm:sr-only">Fecha</span>
              <span className="sr-only">{newestFirst ? ': más recientes primero' : ': más antiguos primero'}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
