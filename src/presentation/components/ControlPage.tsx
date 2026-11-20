'use client';

import React, { useEffect, useState } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Goal, Habit, SavingsGoal, Task } from '../../core/domain/models/types';
import { useControlData } from '../hooks/useControlData';
import { useRevealTarget } from '../hooks/useRevealTarget';
import type { ControlFocus } from '../../core/use-cases/paletteCommand';
import type { QuickRecordKind, QuickRecordTab } from './QuickRecordSheet';
import HabitForm from './HabitForm';
import TaskForm from './TaskForm';
import GoalForm from './GoalForm';
import SavingsGoalForm from './SavingsGoalForm';
import ControlHeader from './control/ControlHeader';
import TodayFocusCard from './control/TodayFocusCard';
import HabitsPanel from './control/HabitsPanel';
import TasksPanel from './control/TasksPanel';
import GoalsPanel from './control/GoalsPanel';
import AnalyticsSection from './control/AnalyticsSection';

export type ControlTab = 'habits' | 'tasks' | 'goals';

const CONTROL_TAB_OPTIONS = [
  { value: 'habits', label: 'Hábitos' },
  { value: 'tasks', label: 'Tareas' },
  { value: 'goals', label: 'Metas' },
];

interface Props {
  userId: string;
  onOpenQuickRecord?: (tab?: QuickRecordTab, kind?: QuickRecordKind) => void;
  onOpenProgress?: () => void;
  focus?: ControlFocus;
  focusNonce?: number;
  onFocusHandled?: () => void;
}

type Editing =
  | { kind: 'habit'; item: Habit }
  | { kind: 'task'; item: Task }
  | { kind: 'goal'; item: Goal }
  | { kind: 'savings-goal'; item: SavingsGoal };

const EDIT_TITLE: Record<Editing['kind'], string> = {
  habit: 'Editar hábito',
  task: 'Editar tarea',
  goal: 'Editar meta',
  'savings-goal': 'Editar meta de ahorro',
};

function tabForFocus(focus: ControlFocus | undefined): ControlTab | null {
  if (!focus) return null;
  if (focus.kind === 'habit') return 'habits';
  if (focus.kind === 'task') return 'tasks';
  return 'goals';
}

/**
 * Control y hábitos (spec 014): single centered column prioritizing today's score and
 * "Foco de Hoy", followed by a Segmented selector (Hábitos / Tareas / Metas) keeping the
 * three domain concepts distinct (Principle XIII) and collapsed-by-default analytics below.
 */
export default function ControlPage({ userId, onOpenQuickRecord, focus, focusNonce, onFocusHandled }: Props) {
  const data = useControlData(userId);
  const [tab, setTab] = useState<ControlTab>(() => tabForFocus(focus) ?? 'habits');
  const [editing, setEditing] = useState<Editing | null>(null);

  useEffect(() => {
    const nextTab = tabForFocus(focus);
    if (nextTab) setTab(nextTab);
  }, [focus, focusNonce]);

  useRevealTarget(focus ? `${focus.kind}-card-${focus.id}` : undefined, focusNonce, !data.loading, onFocusHandled);

  if (data.loading) {
    return (
      <div className="space-y-4" aria-busy="true" data-testid="control-loading">
        <Skeleton className="h-44 w-full rounded-card" />
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const { view } = data;
  const open = (recordTab?: QuickRecordTab, kind?: QuickRecordKind) => (kind ? onOpenQuickRecord?.(recordTab, kind) : onOpenQuickRecord?.(recordTab));
  const closeEditor = () => setEditing(null);

  const confirmDelete = async (message: string, action: () => Promise<void>) => {
    if (!window.confirm(message)) return;
    try {
      await action();
    } catch (error) {
      if (error instanceof Error) window.alert(error.message);
    }
  };

  return (
    <div className="space-y-4" data-testid="control-page">
      <ControlHeader view={view} />

      <TodayFocusCard
        view={view}
        onCompleteHabit={(id) => void data.completeHabit(id)}
        onCompleteTask={(id) => void data.completeTask(id)}
      />

      <Segmented
        ariaLabel="Secciones de control"
        idPrefix="control-sections"
        fullWidth
        value={tab}
        onValueChange={(value) => setTab(value as ControlTab)}
        options={CONTROL_TAB_OPTIONS}
      />

      <div
        role="tabpanel"
        id={`control-sections-panel-${tab}`}
        aria-labelledby={`control-sections-tab-${tab}`}
      >
        {tab === 'habits' && (
          <HabitsPanel
            cards={view.habits}
            adherence={view.adherence}
            onComplete={id => void data.completeHabit(id)}
            onNew={() => open('habit', 'habit')}
            onEdit={habit => setEditing({ kind: 'habit', item: habit })}
            onDelete={habit => void confirmDelete('¿Seguro que deseas eliminar este hábito?', () => data.deleteHabit(habit.id))}
          />
        )}

        {tab === 'tasks' && (
          <TasksPanel
            windows={view.tasks}
            today={view.today}
            urgentCount={view.load.urgentTasks}
            onAdd={data.addQuickTask}
            onDone={id => void data.completeTask(id)}
            onNew={() => open('habit', 'task')}
            onEdit={task => setEditing({ kind: 'task', item: task })}
            onDelete={task => void confirmDelete('¿Seguro que deseas eliminar esta tarea?', () => data.deleteTask(task.id))}
            onStopRecurrence={task => void data.stopTaskRecurrence(task)}
            revealTaskId={focus?.kind === 'task' ? focus.id : undefined}
            revealNonce={focusNonce}
          />
        )}

        {tab === 'goals' && (
          <GoalsPanel
            goals={view.goals}
            savingsGoals={view.savingsGoals}
            activeCount={view.load.activeGoals}
            onNew={() => open('goal', 'goal')}
            onIncrement={goal => void data.incrementGoal(goal)}
            onToggleMilestone={(goal, milestoneId, done) => void data.toggleMilestone(goal, milestoneId, done)}
            onEditGoal={goal => setEditing({ kind: 'goal', item: goal })}
            onDeleteGoal={goal => void confirmDelete('¿Seguro que deseas eliminar esta meta?', () => data.deleteGoal(goal.id))}
            onEditSavings={goal => setEditing({ kind: 'savings-goal', item: goal })}
            onDeleteSavings={goal => void confirmDelete('¿Seguro que deseas eliminar esta meta?', () => data.deleteSavingsGoal(goal.id))}
            onAllocate={() => open('expense')}
          />
        )}
      </div>

      <AnalyticsSection userId={userId} />

      <Sheet open={editing !== null} onOpenChange={next => { if (!next) closeEditor(); }}>
        <SheetContent>
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle className="font-fredoka text-headline-sm font-semibold">{EDIT_TITLE[editing.kind]}</SheetTitle>
                <SheetDescription className="sr-only">Modifica los datos y guarda los cambios.</SheetDescription>
              </SheetHeader>
              {editing.kind === 'habit' && <HabitForm userId={userId} existing={editing.item} embedded onComplete={closeEditor} onCancel={closeEditor} />}
              {editing.kind === 'task' && <TaskForm userId={userId} existing={editing.item} embedded onComplete={closeEditor} onCancel={closeEditor} />}
              {editing.kind === 'goal' && <GoalForm userId={userId} existing={editing.item} embedded onComplete={closeEditor} onCancel={closeEditor} />}
              {editing.kind === 'savings-goal' && <SavingsGoalForm userId={userId} existing={editing.item} embedded onComplete={closeEditor} onCancel={closeEditor} />}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
