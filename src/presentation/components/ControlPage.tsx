'use client';

import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Goal, Habit, SavingsGoal, Task } from '../../core/domain/models/types';
import { useControlData } from '../hooks/useControlData';
import { useIsDesktop, useMediaQuery } from '../hooks/useMediaQuery';
import { useRevealTarget } from '../hooks/useRevealTarget';
import type { ControlFocus } from '../../core/use-cases/paletteCommand';
import type { QuickRecordKind, QuickRecordTab } from './QuickRecordSheet';
import PersonalProgress from './PersonalProgress';
import HabitForm from './HabitForm';
import TaskForm from './TaskForm';
import GoalForm from './GoalForm';
import SavingsGoalForm from './SavingsGoalForm';
import ControlHeader from './control/ControlHeader';
import HabitsPanel from './control/HabitsPanel';
import TasksPanel from './control/TasksPanel';
import GoalsPanel from './control/GoalsPanel';
import AnalyticsSection from './control/AnalyticsSection';

interface Props {
  userId: string;
  /** Opens the app-level "Nuevo Registro" sheet on a tab, optionally on one of its sub-forms. */
  onOpenQuickRecord?: (tab?: QuickRecordTab, kind?: QuickRecordKind) => void;
  /** Opens the full "Mi progreso" route (the compact card is hidden when gamification is off). */
  onOpenProgress?: () => void;
  /** Item a ⌘K selection wants revealed (scrolled to, highlighted and focused). */
  focus?: ControlFocus;
  /** Changes every time the same item is requested again. */
  focusNonce?: number;
  /** Called once the item was revealed (or could not be found), so the shell can forget the request. */
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

/** Two columns only when the content area is wide enough for them (the sidebar takes 240px). */
const WIDE_QUERY = '(min-width: 1280px)';

/**
 * Control y Metas (spec 010): command-center header, daily habits, task dashboard, goals and a
 * collapsible analytics section. All data comes from `useControlData` (local store, auto-refreshing);
 * creation goes through the app-level "Nuevo Registro" sheet and editing through a sheet here.
 */
export default function ControlPage({ userId, onOpenQuickRecord, onOpenProgress, focus, focusNonce, onFocusHandled }: Props) {
  const data = useControlData(userId);
  const desktop = useIsDesktop();
  const wide = useMediaQuery(WIDE_QUERY);
  const [editing, setEditing] = useState<Editing | null>(null);
  useRevealTarget(focus ? `${focus.kind}-card-${focus.id}` : undefined, focusNonce, !data.loading, onFocusHandled);

  if (data.loading) {
    return (
      <div className="space-y-4" aria-busy="true" data-testid="control-loading">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const { view } = data;
  const open = (tab?: QuickRecordTab, kind?: QuickRecordKind) => (kind ? onOpenQuickRecord?.(tab, kind) : onOpenQuickRecord?.(tab));
  const closeEditor = () => setEditing(null);

  const confirmDelete = async (message: string, action: () => Promise<void>) => {
    if (!window.confirm(message)) return;
    try {
      await action();
    } catch (error) {
      if (error instanceof Error) window.alert(error.message);
    }
  };

  const habits = (
    <HabitsPanel
      key="habits"
      cards={view.habits}
      adherence={view.adherence}
      onComplete={id => void data.completeHabit(id)}
      onNew={() => open('habit', 'habit')}
      onEdit={habit => setEditing({ kind: 'habit', item: habit })}
      onDelete={habit => void confirmDelete('¿Seguro que deseas eliminar este hábito?', () => data.deleteHabit(habit.id))}
    />
  );
  const tasks = (
    <TasksPanel
      key="tasks"
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
  );
  const goals = (
    <GoalsPanel
      key="goals"
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
  );
  const progress = <PersonalProgress key="progress" userId={userId} compact onOpen={onOpenProgress} />;

  return (
    <div className="space-y-4" data-testid="control-page">
      <ControlHeader view={view} desktop={desktop} />

      {wide ? (
        <div className="grid grid-cols-2 items-start gap-4">
          <div className="flex flex-col gap-4">{habits}{goals}{progress}</div>
          <div className="flex flex-col gap-4">{tasks}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">{habits}{tasks}{goals}{progress}</div>
      )}

      <AnalyticsSection userId={userId} />

      <Sheet open={editing !== null} onOpenChange={next => { if (!next) closeEditor(); }}>
        <SheetContent>
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle className="text-headline-sm font-semibold">{EDIT_TITLE[editing.kind]}</SheetTitle>
                <SheetDescription className="sr-only">Modificá los datos y guardá los cambios.</SheetDescription>
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
