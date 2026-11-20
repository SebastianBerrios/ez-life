'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Flag, Repeat, TrendingDown, TrendingUp } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import MovementForm, { type MovementInitialValues, type MovementLinks, type SharedExpenseDraft } from './MovementForm';
import TransferForm, { type TransferInitialValues } from './TransferForm';
import InstallmentPaymentQuickForm from './InstallmentPaymentQuickForm';
import HabitForm from './HabitForm';
import TaskForm from './TaskForm';
import GoalForm from './GoalForm';
import SavingsGoalForm from './SavingsGoalForm';
import SharedMovementForm from './SharedMovementForm';
import { useActiveSharedSpaces } from '../hooks/useActiveSharedSpaces';
import type { RegistrationPrefill } from '../../core/use-cases/buildRegistrationPrefill';

export type QuickRecordTab = 'expense' | 'income' | 'transfer' | 'habit' | 'goal';
export type QuickRecordSavedKind = 'movement' | 'transfer' | 'habit' | 'task' | 'goal' | 'savings-goal';
/** Sub-form of the Hábito / Meta tabs a caller can deep-link to (Control's "+ Nuevo" buttons). */
export type QuickRecordKind = 'habit' | 'task' | 'goal' | 'savings-goal';

function tabForKind(kind: QuickRecordKind | undefined): QuickRecordTab | undefined {
  if (kind === 'habit' || kind === 'task') return 'habit';
  if (kind === 'goal' || kind === 'savings-goal') return 'goal';
  return undefined;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Tab shown each time the sheet opens. Defaults to the tab of `initialKind`, else "Gasto". */
  initialTab?: QuickRecordTab;
  /** Sub-form to open inside the Hábito / Meta tabs (hábito, tarea, meta, meta de ahorro). */
  initialKind?: QuickRecordKind;
  /** Optional prefill built from a "Por registrar" item (spec 013 FR-016). */
  prefill?: RegistrationPrefill;
  /** Called after every successful save (also "Guardar y registrar otro"), so the host can refresh its lists. */
  onSaved: (kind: QuickRecordSavedKind) => void;
}

const TAB_OPTIONS = [
  { value: 'expense', label: 'Gasto', icon: <TrendingDown /> },
  { value: 'income', label: 'Ingreso', icon: <TrendingUp /> },
  { value: 'transfer', label: 'Mover', icon: <ArrowLeftRight /> },
  { value: 'habit', label: 'Hábito', icon: <Repeat /> },
  { value: 'goal', label: 'Meta', icon: <Flag /> },
];

const HABIT_OPTIONS = [
  { value: 'habit', label: 'Hábito' },
  { value: 'task', label: 'Tarea' },
];

const GOAL_OPTIONS = [
  { value: 'goal', label: 'Meta' },
  { value: 'savings', label: 'Ahorro' },
];

/**
 * "Nuevo Registro": the single entry point to create a movement, a transfer, a habit/task or a
 * goal. The body is a separate component rendered only while the sheet is open, so every piece of
 * tab/draft state resets when it closes. Everything saves to local storage (works offline).
 */
export default function QuickRecordSheet({ open, onOpenChange, userId, initialTab, initialKind, prefill, onSaved }: Props) {
  const resolvedInitialTab: QuickRecordTab =
    prefill && prefill.tab !== 'loan'
      ? prefill.tab
      : initialTab ?? tabForKind(initialKind) ?? 'expense';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* initialFocus=false: the body puts focus on the amount (or the first field) itself. */}
      <SheetContent initialFocus={false}>
        <QuickRecordBody
          userId={userId}
          initialTab={resolvedInitialTab}
          initialKind={initialKind}
          prefill={prefill}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function QuickRecordBody({
  userId,
  initialTab,
  initialKind,
  prefill,
  onSaved,
  onClose,
}: {
  userId: string;
  initialTab: QuickRecordTab;
  initialKind?: QuickRecordKind;
  prefill?: RegistrationPrefill;
  onSaved: (kind: QuickRecordSavedKind) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<QuickRecordTab>(initialTab);
  const [habitKind, setHabitKind] = useState<'habit' | 'task'>(initialKind === 'task' ? 'task' : 'habit');
  const [goalKind, setGoalKind] = useState<'goal' | 'savings'>(initialKind === 'savings-goal' ? 'savings' : 'goal');
  const [sharedDraft, setSharedDraft] = useState<SharedExpenseDraft | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const spaces = useActiveSharedSpaces(userId);

  // Amount forms focus their own amount input; the other tabs focus their first field once, on open
  // (never on tab changes, which would steal focus from the tablist while arrowing through it).
  useEffect(() => {
    if (prefill?.tab === 'loan') return;
    if (initialTab !== 'habit' && initialTab !== 'goal') return;
    panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea')?.focus();
  }, [initialTab, prefill?.tab]);

  const saved = (kind: QuickRecordSavedKind) => {
    onSaved(kind);
    onClose();
  };

  if (prefill?.tab === 'loan' && prefill.loanId) {
    return (
      <>
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" />
            <SheetTitle className="text-headline-sm font-semibold">Registrar cuota</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Confirma el pago de una cuota de tu préstamo y la cuenta de origen.
          </SheetDescription>
        </SheetHeader>
        <InstallmentPaymentQuickForm
          userId={userId}
          loanId={prefill.loanId}
          initialAccountId={prefill.accountId}
          amountCents={prefill.amountCents}
          description={prefill.description}
          onComplete={() => saved('movement')}
          onCancel={onClose}
        />
      </>
    );
  }

  const movementInitialValues: MovementInitialValues | undefined =
    prefill && (prefill.tab === 'expense' || prefill.tab === 'income')
      ? {
          amountCents: prefill.amountCents,
          description: prefill.description,
          accountId: prefill.accountId,
          incomeSourceId: prefill.incomeSourceId,
          distributionCategoryId: prefill.distributionCategoryId,
          expenseCategoryId: prefill.expenseCategoryId,
          expenseSubcategoryId: prefill.expenseSubcategoryId,
        }
      : undefined;

  const movementLinks: MovementLinks | undefined =
    prefill && (prefill.tab === 'expense' || prefill.tab === 'income')
      ? {
          recurrence_rule_id: prefill.recurrenceRuleId,
          recurrence_month: prefill.recurrenceMonth,
          income_source_id: prefill.incomeSourceId,
        }
      : undefined;

  const transferInitialValues: TransferInitialValues | undefined =
    prefill?.tab === 'transfer'
      ? {
          amountCents: prefill.amountCents,
          fromAccountId: prefill.accountId,
          toAccountId: prefill.toAccountId,
          description: prefill.description,
        }
      : undefined;

  const sharedSpace = sharedDraft ? spaces.find(space => space.id === sharedDraft.spaceId) : undefined;
  const isMovementTab = tab === 'expense' || tab === 'income';

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" />
          <SheetTitle className="font-fredoka text-headline-sm font-semibold">Nuevo registro</SheetTitle>
        </div>
        <SheetDescription className="sr-only">
          Registra un gasto, un ingreso, un movimiento entre cuentas, un hábito, una tarea o una meta.
        </SheetDescription>
      </SheetHeader>

      {sharedDraft && sharedSpace ? (
        <SharedMovementForm
          spaceId={sharedSpace.id}
          currentUserId={userId}
          members={sharedSpace.members}
          initial={{ amount: sharedDraft.amount }}
          onComplete={() => saved('movement')}
          onCancel={() => setSharedDraft(null)}
        />
      ) : null}

      {/* Stays mounted (just hidden) while the shared-expense form is shown, so "Cancelar" returns to the draft. */}
      <div className={sharedDraft && sharedSpace ? 'hidden' : 'grid gap-4'}>
        <Segmented
          ariaLabel="Tipo de registro"
          idPrefix="quick-record"
          fullWidth
          value={tab}
          onValueChange={value => setTab(value as QuickRecordTab)}
          options={TAB_OPTIONS}
          className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />

        <div
          ref={panelRef}
          role="tabpanel"
          id={`quick-record-panel-${tab}`}
          aria-labelledby={`quick-record-tab-${tab}`}
          className="grid gap-4"
        >
          {isMovementTab && (
            <MovementForm
              userId={userId}
              type={tab === 'expense' ? 'EXPENSE' : 'INCOME'}
              initialValues={movementInitialValues}
              links={movementLinks}
              autoFocusAmount
              sharedSpaces={spaces.map(({ id, name }) => ({ id, name }))}
              onContinueShared={setSharedDraft}
              onSavedAndNew={() => onSaved('movement')}
              onComplete={() => saved('movement')}
              onCancel={onClose}
            />
          )}

          {tab === 'transfer' && (
            <TransferForm
              userId={userId}
              initialValues={transferInitialValues}
              autoFocusAmount
              onComplete={() => saved('transfer')}
            />
          )}

          {tab === 'habit' && (
            <>
              <Segmented ariaLabel="Qué quieres crear" size="sm" value={habitKind} onValueChange={value => setHabitKind(value as 'habit' | 'task')} options={HABIT_OPTIONS} />
              {habitKind === 'habit'
                ? <HabitForm userId={userId} embedded onComplete={() => saved('habit')} onCancel={onClose} />
                : <TaskForm userId={userId} embedded onComplete={() => saved('task')} onCancel={onClose} />}
            </>
          )}

          {tab === 'goal' && (
            <>
              <Segmented ariaLabel="Qué tipo de meta" size="sm" value={goalKind} onValueChange={value => setGoalKind(value as 'goal' | 'savings')} options={GOAL_OPTIONS} />
              {goalKind === 'goal'
                ? <GoalForm userId={userId} embedded onComplete={() => saved('goal')} onCancel={onClose} />
                : <SavingsGoalForm userId={userId} embedded onComplete={() => saved('savings-goal')} onCancel={onClose} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
