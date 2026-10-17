'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  ArrowDown, ArrowUp, CornerDownLeft, Landmark, ListChecks, PiggyBank, Plus, Receipt, Repeat, Search, SunMoon, Target,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils';
import type { PaletteEntry, PaletteKind } from '../../core/use-cases/buildPaletteIndex';
import { paletteCommand, type NavigateOptions, type PaletteQuickRecordKind, type PaletteQuickRecordTab } from '../../core/use-cases/paletteCommand';
import { flattenPalette, searchPalette } from '../../core/use-cases/searchPalette';
import { usePaletteData } from '../hooks/usePaletteData';
import { navItems } from './BottomNav';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** "Mi Progreso" is only offered while gamification is on. */
  gamificationVisible?: boolean;
  onNavigate: (route: string, options?: NavigateOptions) => void;
  onOpenQuickRecord: (tab: PaletteQuickRecordTab, kind?: PaletteQuickRecordKind) => void;
}

const KIND_ICON: Record<Exclude<PaletteKind, 'route'>, React.ComponentType<{ className?: string }>> = {
  action: Plus,
  movement: Receipt,
  task: ListChecks,
  habit: Repeat,
  goal: Target,
  'savings-goal': PiggyBank,
  account: Landmark,
};

function EntryIcon({ entry }: { entry: PaletteEntry }) {
  let Icon = entry.kind === 'route'
    ? navItems.find(item => item.id === (entry.payload.type === 'route' ? entry.payload.route : ''))?.Icon ?? Search
    : KIND_ICON[entry.kind];
  if (entry.payload.type === 'action' && entry.payload.action === 'toggle-theme') Icon = SunMoon;
  return (
    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground group-aria-selected:text-primary">
      <Icon className="size-4" />
    </span>
  );
}

function EntryAmount({ entry }: { entry: PaletteEntry }) {
  if (entry.amount === undefined) return null;
  if (entry.movementKind === 'income') return <Money cents={entry.amount} sign="always" tone="income" size="sm" className="font-semibold" />;
  if (entry.movementKind === 'transfer') return <Money cents={entry.amount} sign="never" size="sm" className="font-semibold text-muted-foreground" />;
  return <Money cents={-entry.amount} sign="auto" tone="expense" size="sm" className="font-semibold" />;
}

function resultsAnnouncement(count: number): string {
  if (count === 0) return 'Sin resultados';
  return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
}

interface BodyProps extends Omit<Props, 'open'> {
  inputRef: React.RefObject<HTMLInputElement>;
  /** Set right before closing because an entry was activated: the target decides where focus goes. */
  activated: React.MutableRefObject<boolean>;
}

function PaletteBody({ onOpenChange, userId, gamificationVisible = true, onNavigate, onOpenQuickRecord, inputRef, activated }: BodyProps) {
  const { theme, setTheme } = useTheme();
  const { index } = usePaletteData(userId, gamificationVisible);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (position: number) => `${baseId}-option-${position}`;

  const groups = useMemo(() => searchPalette(index, query), [index, query]);
  const flat = useMemo(() => flattenPalette(groups), [groups]);
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // optionId is derived from baseId, which is stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const activate = (entry: PaletteEntry) => {
    const command = paletteCommand(entry);
    activated.current = true;
    onOpenChange(false);
    switch (command.type) {
      case 'quick-record':
        onOpenQuickRecord(command.tab, command.kind);
        break;
      case 'navigate':
        onNavigate(command.route, command.options);
        break;
      case 'toggle-theme':
        activated.current = false; // nothing else takes focus: give it back to where the user was
        setTheme(theme === 'light' ? 'dark' : 'light');
        break;
    }
  };

  const move = (next: number) => {
    if (flat.length === 0) return;
    setActive((next + flat.length) % flat.length);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); move(activeIndex + 1); break;
      case 'ArrowUp': event.preventDefault(); move(activeIndex < 0 ? 0 : activeIndex - 1); break;
      case 'Home': event.preventDefault(); move(0); break;
      case 'End': event.preventDefault(); move(flat.length - 1); break;
      case 'Enter':
        if (activeIndex >= 0) {
          event.preventDefault();
          activate(flat[activeIndex]);
        }
        break;
    }
  };

  let position = -1;

  return (
    <>
      <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
      <DialogDescription className="sr-only">
        Buscá movimientos, tareas, hábitos, metas y acciones. Usá las flechas para moverte y Enter para abrir.
      </DialogDescription>

      <div className="flex h-14 items-center gap-3 border-b border-border px-4 focus-within:border-primary">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Buscar en ez-life"
          aria-expanded="true"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Buscar en ez·life…"
          name="palette-search"
          className="h-full min-h-0 min-w-0 flex-1 bg-transparent text-body-lg text-foreground outline-none focus-visible:outline-none placeholder:text-subtle"
        />
        <Kbd aria-hidden="true">esc</Kbd>
      </div>

      <p role="status" aria-live="polite" className="sr-only">{resultsAnnouncement(flat.length)}</p>

      <div id={listboxId} role="listbox" aria-label="Resultados" className="max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain p-2">
        {flat.length === 0 && (
          <p className="px-3 py-8 text-center text-body-md text-muted-foreground">
            {query.trim() ? `Sin resultados para «${query.trim()}».` : 'Todavía no hay nada que buscar.'}
          </p>
        )}
        {groups.map(group => {
          const headingId = `${baseId}-group-${group.kind}`;
          return (
            <div key={group.kind} role="group" aria-labelledby={headingId} className="pb-1">
              <div id={headingId} className="px-3 pb-1 pt-2 font-mono text-label-mono-xs uppercase text-muted-foreground">{group.label}</div>
              {group.entries.map(entry => {
                position += 1;
                const mine = position;
                const selected = mine === activeIndex;
                return (
                  <div
                    key={entry.id}
                    id={optionId(mine)}
                    role="option"
                    aria-selected={selected}
                    data-testid={`palette-option-${entry.id}`}
                    onMouseMove={() => { if (!selected) setActive(mine); }}
                    onClick={() => activate(entry)}
                    className={cn(
                      'group flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5',
                      selected ? 'bg-surface-3 text-foreground' : 'text-foreground',
                    )}
                  >
                    <EntryIcon entry={entry} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-md font-medium">{entry.title}</span>
                      {entry.subtitle && <span className="block truncate font-mono text-label-mono-xs text-muted-foreground">{entry.subtitle}</span>}
                    </span>
                    <EntryAmount entry={entry} />
                    {selected && <CornerDownLeft aria-hidden="true" className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 font-mono text-label-mono-xs text-muted-foreground sm:flex" aria-hidden="true">
        <span className="flex items-center gap-1.5"><Kbd><ArrowUp className="size-3" /></Kbd><Kbd><ArrowDown className="size-3" /></Kbd> navegar</span>
        <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="size-3" /></Kbd> abrir</span>
        <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> cerrar</span>
      </div>
    </>
  );
}

/**
 * ⌘K command palette (spec 010): fixed centered overlay, 640 px wide (viewport - 32 px on phones), with
 * an integrated search field, grouped results and a hint bar. Built on the app's Dialog (focus trap,
 * Escape, overlay click, focus restore). Combobox/listbox semantics: the input keeps focus and points at
 * the highlighted option through `aria-activedescendant`. The data is read only while it is open.
 */
export default function CommandPalette({ open, onOpenChange, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activated = useRef(false);
  useEffect(() => { if (open) activated.current = false; }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-command-palette=""
        showCloseButton={false}
        initialFocus={inputRef}
        finalFocus={() => (activated.current ? false : true)}
        className="top-[12dvh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] -translate-y-0 gap-0 overflow-hidden rounded-xl border-border-strong bg-card p-0 sm:max-w-[640px]"
      >
        <PaletteBody {...rest} onOpenChange={onOpenChange} inputRef={inputRef} activated={activated} />
      </DialogContent>
    </Dialog>
  );
}
