'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ListChecks, Plus, Repeat } from 'lucide-react';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import type { Task, TaskPriority } from '../../../core/domain/models/types';
import type { TaskWindowItem, TaskWindows } from '../../../core/use-cases/groupTasksByWindow';
import type { QuickTaskResult } from '../../../core/use-cases/buildQuickTask';
import { QUICK_TASK_MAX_LENGTH } from '../../../core/use-cases/buildQuickTask';
import { describeTaskDue, type TaskDueTone } from '../../../core/use-cases/describeTaskDue';
import { CheckButton, EmptyState, SectionHeader } from './controlUi';
import ItemMenu from './ItemMenu';

type TaskTab = 'today' | 'week' | 'done';

/** Completed tasks shown at once (most recent first); the full history lives in the analytics. */
export const DONE_TASKS_SHOWN = 20;

interface Props {
  windows: TaskWindows;
  today: Date;
  urgentCount: number;
  onAdd: (title: string) => Promise<QuickTaskResult>;
  onDone: (taskId: string) => void;
  onNew: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStopRecurrence: (task: Task) => void;
  /** Task a ⌘K navigation wants visible: the panel switches to the window that holds it. */
  revealTaskId?: string;
  /** Changes every time the same task is requested again. */
  revealNonce?: number;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
const PRIORITY_BADGE: Record<TaskPriority, 'negative' | 'positive' | 'neutral'> = { high: 'negative', medium: 'positive', low: 'neutral' };
const PRIORITY_BORDER: Record<TaskPriority, string> = { high: 'border-l-expense', medium: 'border-l-primary', low: 'border-l-border-strong' };
const DUE_TONE: Record<TaskDueTone, string> = { overdue: 'text-expense', today: 'text-primary', upcoming: 'text-muted-foreground', done: 'text-muted-foreground' };

function isRecurring(task: Task): boolean {
  return Boolean(task.schedule_mode) && task.recurrence_active !== false;
}

function TaskRow({
  item,
  today,
  onDone,
  onEdit,
  onDelete,
  onStopRecurrence,
}: { item: TaskWindowItem; today: Date } & Pick<Props, 'onDone' | 'onEdit' | 'onDelete' | 'onStopRecurrence'>) {
  const { task } = item;
  const priority = task.priority ?? 'medium';
  const done = task.status === 'done';
  const due = describeTaskDue(task, today);
  return (
    <li
      className={cn('rounded-lg border-l-2 bg-surface-2 p-3', PRIORITY_BORDER[priority], done && 'opacity-80')}
      data-testid={`task-card-${task.id}`}
      data-priority={priority}
    >
      <div className="flex items-start gap-3">
        <CheckButton done={done} label={`Marcar "${task.title}" como hecha`} onToggle={() => onDone(task.id)} />
        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={PRIORITY_BADGE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
            {task.tag && <Badge variant="neutral" className="max-w-full truncate">{task.tag}</Badge>}
            {isRecurring(task) && (
              <Badge variant="neutral">
                <Repeat aria-hidden="true" />
                Recurrente
              </Badge>
            )}
          </div>
          <p className={cn('break-words text-body-lg font-medium text-foreground', done && 'text-muted-foreground line-through')}>{task.title}</p>
          {task.description && <p className="line-clamp-2 text-body-md text-muted-foreground">{task.description}</p>}
          <p className={cn('font-mono text-label-mono-xs', DUE_TONE[due.tone])} data-testid={`task-due-${task.id}`}>{due.text}</p>
        </div>
        <ItemMenu
          label={task.title}
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task)}
          extra={isRecurring(task) && !done ? { label: 'Detener recurrencia', onSelect: () => onStopRecurrence(task) } : undefined}
        />
      </div>
    </li>
  );
}

/** "Dashboard de tareas": Para hoy / Esta semana / Hechas, with a quick-add field. */
export default function TasksPanel({ windows, today, urgentCount, onAdd, onDone, onNew, onEdit, onDelete, onStopRecurrence, revealTaskId, revealNonce }: Props) {
  const desktop = useIsDesktop();
  const [tab, setTab] = useState<TaskTab>('today');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // Only a new request moves the tab: later data refreshes must never override the user's own choice.
  const latestWindows = useRef(windows);
  latestWindows.current = windows;
  useEffect(() => {
    if (!revealTaskId) return;
    const holds = (items: TaskWindowItem[]) => items.some(item => item.task.id === revealTaskId);
    const current = latestWindows.current;
    if (holds(current.today)) setTab('today');
    else if (holds(current.week) || holds(current.later)) setTab('week');
    else if (current.done.some(task => task.id === revealTaskId)) setTab('done');
  }, [revealTaskId, revealNonce]);

  const weekCount = windows.week.length + windows.later.length;
  const pending = windows.today.length + weekCount;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      const result = await onAdd(title);
      if (!result.ok) {
        setError(result.error);
        setNotice('');
      } else {
        setTitle('');
        setError(null);
        setTab('today'); // the new task is due today
        setNotice('Tarea añadida');
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(''), 2500);
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar la tarea.');
    } finally {
      setAdding(false);
      inputRef.current?.focus(); // keep typing: add several in a row
    }
  };

  const rows = (items: TaskWindowItem[]) => items.map(item => (
    <TaskRow key={item.task.id} item={item} today={today} onDone={onDone} onEdit={onEdit} onDelete={onDelete} onStopRecurrence={onStopRecurrence} />
  ));

  return (
    <Panel aria-labelledby="control-tasks-title" data-testid="tasks-section">
      <SectionHeader
        titleId="control-tasks-title"
        icon={<ListChecks />}
        title="Dashboard de tareas"
        subtitle="Priorización dinámica y sprints"
        action={
          <>
            {urgentCount > 0 && <Badge variant="negative">{urgentCount} {urgentCount === 1 ? 'Urgente' : 'Urgentes'}</Badge>}
            <Button variant="secondary" size="sm" onClick={onNew}>
              <Plus />
              <span className="sr-only md:not-sr-only">Nueva</span>
              <span className="sr-only">tarea</span>
            </Button>
          </>
        }
      />
      <PanelBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            ariaLabel="Ventana de tareas"
            idPrefix="control-tasks"
            size={desktop ? 'sm' : 'md'}
            mono
            value={tab}
            onValueChange={value => setTab(value as TaskTab)}
            options={[
              { value: 'today', label: 'Para hoy', count: windows.today.length },
              { value: 'week', label: 'Esta semana', count: weekCount },
              { value: 'done', label: 'Hechas', count: windows.done.length },
            ]}
          />
          <span className="font-mono text-label-mono-xs text-primary" data-testid="pending-count">
            {pending} {pending === 1 ? 'pendiente' : 'pendientes'}
          </span>
        </div>

        <div role="tabpanel" id={`control-tasks-panel-${tab}`} aria-labelledby={`control-tasks-tab-${tab}`} className="flex flex-col gap-2">
          {tab === 'today' && (
            windows.today.length === 0
              ? <EmptyState>No tienes tareas para hoy. Añade una abajo.</EmptyState>
              : <ul className="flex flex-col gap-2">{rows(windows.today)}</ul>
          )}
          {tab === 'week' && (
            weekCount === 0
              ? <EmptyState>No hay tareas para el resto de la semana.</EmptyState>
              : (
                <>
                  {windows.week.length > 0 && <ul className="flex flex-col gap-2">{rows(windows.week)}</ul>}
                  {windows.later.length > 0 && (
                    <>
                      <p className="mt-1 font-mono text-label-mono-xs uppercase text-muted-foreground">Más adelante</p>
                      <ul className="flex flex-col gap-2">{rows(windows.later)}</ul>
                    </>
                  )}
                </>
              )
          )}
          {tab === 'done' && (
            windows.done.length === 0
              ? <EmptyState>Todavía no completaste ninguna tarea.</EmptyState>
              : (
                <>
                  <ul className="flex flex-col gap-2">
                    {rows(windows.done.slice(0, DONE_TASKS_SHOWN).map(task => ({ task, overdue: false })))}
                  </ul>
                  {windows.done.length > DONE_TASKS_SHOWN && (
                    <p className="font-mono text-label-mono-xs text-muted-foreground">
                      Mostrando las {DONE_TASKS_SHOWN} más recientes de {windows.done.length}.
                    </p>
                  )}
                </>
              )
          )}
        </div>

        <form onSubmit={submit} className="mt-1">
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-card pl-3 pr-2 focus-within:border-primary focus-within:shadow-focus">
            <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              aria-label="Añadir tarea rápida"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'quick-task-error' : undefined}
              placeholder="Añadir tarea rápida…"
              maxLength={QUICK_TASK_MAX_LENGTH}
              value={title}
              onChange={event => { setTitle(event.target.value); if (error) setError(null); }}
              className="h-10 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
            />
            <Kbd className="hidden md:inline-flex" aria-hidden="true">Enter ↵</Kbd>
          </div>
          {error && <p id="quick-task-error" role="alert" className="mt-1 text-body-md text-destructive">{error}</p>}
          <p role="status" aria-live="polite" className={notice ? 'mt-1 font-mono text-label-mono-xs text-primary' : 'sr-only'}>{notice}</p>
        </form>
      </PanelBody>
    </Panel>
  );
}
