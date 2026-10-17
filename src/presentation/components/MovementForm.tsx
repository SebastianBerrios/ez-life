'use client';

import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { centsToAmountInput } from '../../core/use-cases/addQuickAmount';
import { calendarKey, combineDateAndTime, parseCalendarDate, timeKey } from '../../core/use-cases/calendar';
import { defaultCashAccountId } from '../../core/use-cases/defaultPaymentAccount';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { validateBalanceAdjustment } from '../../core/use-cases/validateBalanceAdjustment';
import { bucketLabel, canShareExpense, isLongCategoryList, validateMovementSelection } from '../../core/use-cases/quickRecordRules';
import { usableAccounts } from '../../core/use-cases/transferAccounts';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory, SavingsGoal, Movement, MovementType, IncomeSource, PaymentAccount } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, Check, CheckCircle2, ChevronDown, Loader2, PencilLine, PieChart, Users, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import AmountHero from './AmountHero';
import { AccountChips, DateTimeRow, FieldLabel, categoryIcon } from './quickRecordUi';

export interface SharedSpaceOption {
  id: string;
  name: string;
}

export interface SharedExpenseDraft {
  spaceId: string;
  /** Normalized amount ("123.45") typed in the form, to pre-fill the shared-expense form. */
  amount: string;
}

interface Props {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
  movement?: Movement;
  /** Fixes the movement type from outside (quick-record tabs). Without it the form shows its own Gasto/Ingreso switch. */
  type?: Extract<MovementType, 'EXPENSE' | 'INCOME'>;
  /** "Guardar y registrar otro" (create only): called after the record is saved and the form is reset. */
  onSavedAndNew?: () => void;
  /** Active shared spaces of the user: enables the "¿Afecta al Espacio Compartido?" toggle (new expenses only). */
  sharedSpaces?: SharedSpaceOption[];
  /** Called instead of saving when the shared toggle is on; the host switches to the shared-expense form. */
  onContinueShared?: (draft: SharedExpenseDraft) => void;
  autoFocusAmount?: boolean;
}

const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Gasto' },
  { value: 'INCOME', label: 'Ingreso' },
];

export default function MovementForm({
  userId, onComplete, onCancel, movement, type: typeProp, onSavedAndNew, sharedSpaces = [], onContinueShared, autoFocusAmount = false,
}: Props) {
  const editing = Boolean(movement);
  const [internalType, setInternalType] = useState<MovementType>(movement?.type ?? 'EXPENSE');
  const type: MovementType = typeProp ?? internalType;
  const [amount, setAmount] = useState<string>(movement ? centsToAmountInput(movement.amount) : '');
  const [description, setDescription] = useState<string>(movement?.description ?? '');
  const [date, setDate] = useState(calendarKey(movement?.date ?? new Date()));
  // Editing keeps the movement's own time; new movements default to "now".
  const [time, setTime] = useState(timeKey(movement?.date ?? new Date()));
  const [accountId, setAccountId] = useState<string>(movement?.account_id ?? '');
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [incomeSourceId, setIncomeSourceId] = useState(movement?.income_source_id ?? '');
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const submitting = useRef(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // Distribution category (bucket) is derived from the chosen expense category, but kept as its own
  // state so editing a movement whose category is no longer listed still saves its original links.
  const [distCategoryId, setDistCategoryId] = useState<string>(movement?.distribution_category_id ?? '');
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);

  // Expense category + subcategory
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(movement?.expense_category_id ?? '');
  const [allExpenseCategories, setAllExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenseSubcategoryId, setExpenseSubcategoryId] = useState<string>(movement?.expense_subcategory_id ?? '');
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, ExpenseSubcategory[]>>({});

  // Savings goal
  const [savingsGoalId, setSavingsGoalId] = useState<string>(movement?.savings_goal_id ?? '');
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  const [isRecurring, setIsRecurring] = useState(movement?.is_recurring ?? false);
  const [isAdjustment, setIsAdjustment] = useState(movement?.is_adjustment ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const [shareOn, setShareOn] = useState(false);
  const [shareSpaceId, setShareSpaceId] = useState('');

  // The "Registro guardado" confirmation belongs to the record just saved: drop it when switching Gasto/Ingreso.
  useEffect(() => { setSavedNotice(false); }, [type]);

  const categoryLabelId = useId();
  const subcategoryLabelId = useId();
  const accountLabelId = useId();
  const shareLabelId = useId();
  const shareHelpId = useId();

  // Load all static data on mount.
  // IMPORTANT: category/account defaults must be set BEFORE dataLoaded=true so nothing renders unselected.
  useEffect(() => {
    const loadData = async () => {
      const catRepo = new LocalCategoryRepository();
      const goalRepo = new LocalSavingsGoalRepository();

      const [cats, expCats, goals, sources, loadedAccounts] = await Promise.all([
        catRepo.getDistributionCategories(userId),
        catRepo.getExpenseCategories(userId),
        goalRepo.getAll(userId),
        new LocalIncomeSourceRepository().getAll(userId),
        new LocalPaymentAccountRepository().getAll(userId),
      ]);

      // Largest bucket first (50 / 30 / 20): the repository returns them in id order, which is arbitrary.
      const orderedBuckets = [...cats].sort((a, b) => b.percentage - a.percentage);
      const subsEntries = await Promise.all(
        expCats.map(async (c) => [c.id, await catRepo.getSubcategories(c.id)] as const)
      );
      const subsMap = Object.fromEntries(subsEntries);

      // A category with no subcategories yet has nothing to classify a movement
      // under — keep it out of the picker until it has at least one.
      const withSubs = expCats.filter(c => (subsMap[c.id]?.length ?? 0) > 0);
      // Cards follow the bucket order so the 50/30/20 groups read top to bottom.
      const selectableCats = [
        ...orderedBuckets.flatMap(bucket => withSubs.filter(c => c.distribution_category_id === bucket.id)),
        ...withSubs.filter(c => !cats.some(bucket => bucket.id === c.distribution_category_id)),
      ];

      setDistCategories(cats);
      setAllExpenseCategories(selectableCats);
      setSubcategoriesByCategory(subsMap);
      setSavingsGoals(goals);
      setIncomeSources(sources);
      setAccounts(loadedAccounts);
      if (!movement) {
        const usable = usableAccounts(loadedAccounts);
        const preferred = usable.find(a => a.id === defaultCashAccountId(userId)) ?? usable[0];
        if (preferred) setAccountId(preferred.id);
        const firstCategory = selectableCats[0];
        if (firstCategory) {
          setExpenseCategoryId(firstCategory.id);
          setDistCategoryId(firstCategory.distribution_category_id);
        }
      }
      if (!movement?.income_source_id) setIncomeSourceId(sources[0]?.id ?? '');
      setDataLoaded(true);
    };
    loadData();
  }, [userId, movement]);

  const subcategories = useMemo(
    () => subcategoriesByCategory[expenseCategoryId] ?? [],
    [subcategoriesByCategory, expenseCategoryId]
  );

  const selectedBucket = distCategories.find(c => c.id === distCategoryId);
  const showSavingsGoal =
    !isAdjustment &&
    type === 'EXPENSE' &&
    savingsGoals.length > 0 &&
    selectedBucket?.is_savings === true;

  const canShare = canShareExpense({ editing, type, isAdjustment, activeSpaces: onContinueShared ? sharedSpaces.length : 0 });
  const sharing = canShare && shareOn;
  const effectiveSpaceId = sharedSpaces.some(s => s.id === shareSpaceId) ? shareSpaceId : sharedSpaces[0]?.id ?? '';

  const handleSelectCategory = (category: ExpenseCategory) => {
    if (category.distribution_category_id !== distCategoryId) setSavingsGoalId('');
    setExpenseCategoryId(category.id);
    setDistCategoryId(category.distribution_category_id);
    setExpenseSubcategoryId(''); // cascade reset
    setFormError(null);
  };

  const resetForNext = () => {
    // Keeps type, date, time, account and category: the next record is usually a sibling of this one.
    setAmount('');
    setDescription('');
    setExpenseSubcategoryId('');
    setSavingsGoalId('');
    setIsRecurring(false);
    setIsAdjustment(false);
    setShareOn(false);
    setFormError(null);
    setAmountError(null);
    setAdjustmentError(null);
    setSavedNotice(true);
    amountRef.current?.focus();
  };

  const save = async (andNew: boolean) => {
    if (submitting.current) return;
    setFormError(null);

    let amountInCents: number;
    try {
      amountInCents = parseMoney(amount);
      validateMovementAmount(amountInCents);
      parseCalendarDate(date);
      combineDateAndTime(date, time);
    } catch (err) {
      if (err instanceof DomainError) {
        setAmountError(err.message);
      }
      return;
    }
    setAmountError(null);

    // A balance adjustment never carries a distribution/expense category
    // (FR-004, data-model.md) — computed once so validation and the saved
    // payload agree on the exact same values.
    const distributionCategoryId = !isAdjustment && type === 'EXPENSE' ? distCategoryId : undefined;
    const expenseCategoryIdToSave = !isAdjustment && type === 'EXPENSE' && expenseCategoryId ? expenseCategoryId : undefined;
    const expenseSubcategoryIdToSave = !isAdjustment && type === 'EXPENSE' && expenseSubcategoryId ? expenseSubcategoryId : undefined;

    try {
      validateBalanceAdjustment({
        is_adjustment: isAdjustment,
        description,
        distribution_category_id: distributionCategoryId,
        expense_category_id: expenseCategoryIdToSave,
        expense_subcategory_id: expenseSubcategoryIdToSave,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        setAdjustmentError(err.message);
      }
      return;
    }
    setAdjustmentError(null);

    if (sharing) {
      // The shared RPC creates the linked personal movement itself: nothing is saved here.
      onContinueShared?.({ spaceId: effectiveSpaceId, amount: centsToAmountInput(amountInCents) });
      return;
    }

    if (type !== 'TRANSFER') {
      try {
        validateMovementSelection({ type, isAdjustment, expenseCategoryId: expenseCategoryIdToSave, incomeSourceId });
      } catch (err) {
        if (err instanceof DomainError) setFormError(err.message);
        return;
      }
    }

    submitting.current = true;
    setIsSubmitting(true);

    try {
      const repo = new LocalMovementRepository();

      await repo.save({
        id: movement?.id ?? '',
        user_id: userId,
        type,
        amount: amountInCents,
        date: combineDateAndTime(date, time),
        description,
        distribution_category_id: distributionCategoryId,
        expense_category_id: expenseCategoryIdToSave,
        expense_subcategory_id: expenseSubcategoryIdToSave,
        income_source_id: !isAdjustment && type === 'INCOME' ? incomeSourceId || undefined : undefined,
        savings_goal_id: !isAdjustment && type === 'EXPENSE' && selectedBucket?.is_savings && savingsGoalId ? savingsGoalId : undefined,
        account_id: accountId || undefined,
        to_account_id: type === 'TRANSFER' ? movement?.to_account_id : undefined,
        is_recurring: type === 'TRANSFER' ? false : isRecurring,
        is_adjustment: type === 'TRANSFER' ? false : isAdjustment,
      });

      if (andNew && !editing) {
        resetForNext();
        onSavedAndNew?.();
      } else {
        onComplete();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void save(false);
  };

  const showTypeSwitch = !typeProp && type !== 'TRANSFER';
  const primaryLabel = editing ? 'Guardar' : sharing ? 'Continuar a gasto compartido' : 'Guardar Registro';
  const usable = usableAccounts(accounts, accountId);
  // A missing category is reported next to the category cards; any other save error goes above the buttons.
  const categoryError = Boolean(formError) && type === 'EXPENSE' && !isAdjustment && !expenseCategoryId;
  const categoryListIsLong = isLongCategoryList(allExpenseCategories.length);
  const typeBadge =
    type === 'EXPENSE' ? <Badge variant="negative">EGRESO</Badge>
      : type === 'INCOME' ? <Badge variant="positive">INGRESO</Badge>
        : <Badge>TRANSFERENCIA</Badge>;

  return (
    <div className="w-full">
      {editing && <h2 className="mb-4 font-heading text-base leading-none font-medium">Editar Movimiento</h2>}
      <form onSubmit={handleSubmit} data-testid="movement-form" className="space-y-4">
        {showTypeSwitch && (
          <Segmented
            ariaLabel="Tipo de movimiento"
            fullWidth
            value={type}
            onValueChange={value => setInternalType(value as MovementType)}
            options={TYPE_OPTIONS}
          />
        )}

        <AmountHero
          value={amount}
          inputRef={amountRef}
          autoFocus={autoFocusAmount}
          badge={typeBadge}
          error={amountError}
          onChange={value => {
            setAmount(value);
            setSavedNotice(false);
            if (amountError) setAmountError(null);
          }}
        />

        <div className="space-y-5 rounded-lg border border-border bg-card p-4">
          {/* Description — mandatory motive when isAdjustment is active (FR-002) */}
          <div>
            <FieldLabel icon={PencilLine} htmlFor="description" hint={isAdjustment ? 'Requerido' : 'Opcional'}>
              {isAdjustment ? 'Motivo del ajuste' : 'Concepto / descripción'}
            </FieldLabel>
            <Input
              type="text"
              id="description"
              aria-invalid={adjustmentError ? true : undefined}
              placeholder={isAdjustment ? 'Ej. Reembolso extraordinario' : 'Ej. Almuerzo corporativo, Taxi...'}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSavedNotice(false);
                if (adjustmentError) setAdjustmentError(null);
              }}
            />
            {adjustmentError && <p role="alert" className="mt-1 text-body-md text-destructive">{adjustmentError}</p>}
          </div>

          {type === 'INCOME' && !isAdjustment && (
            <div>
              <FieldLabel htmlFor="income-source">Fuente de ingreso</FieldLabel>
              <Select value={incomeSourceId} onValueChange={value => { setIncomeSourceId(value ?? ''); setFormError(null); }} required>
                <SelectTrigger id="income-source" className="w-full"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                <SelectContent>{incomeSources.map(source => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent>
              </Select>
              {dataLoaded && incomeSources.length === 0 && <p className="mt-1 text-body-md text-muted-foreground">Agregá una fuente de ingreso desde Ajustes.</p>}
            </div>
          )}

          {/* Expense category cards: each card names its 50/30/20 bucket, so picking one also picks the bucket. */}
          {type === 'EXPENSE' && !isAdjustment && (
            <div>
              <FieldLabel icon={PieChart} id={categoryLabelId}>Categoría &amp; regla 50/30/20</FieldLabel>
              {dataLoaded ? (
                allExpenseCategories.length === 0 ? (
                  <p className="text-body-md text-muted-foreground">
                    Todavía no tenés categorías de gasto con subcategorías. Agregalas desde Ajustes.
                  </p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-labelledby={categoryLabelId}
                    className={cn('grid gap-2', categoryListIsLong && 'max-h-72 overflow-y-auto pr-1')}
                  >
                    {allExpenseCategories.map(category => {
                      const checked = category.id === expenseCategoryId;
                      const Icon = categoryIcon(category.name);
                      const bucket = distCategories.find(b => b.id === category.distribution_category_id);
                      return (
                        <label
                          key={category.id}
                          className={cn(
                            'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors has-[:focus-visible]:shadow-focus',
                            checked ? 'border-primary/40 bg-surface-3' : 'border-border bg-card hover:bg-surface-3'
                          )}
                        >
                          <input
                            type="radio"
                            name="expense-category"
                            className="sr-only"
                            checked={checked}
                            onChange={() => handleSelectCategory(category)}
                          />
                          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', checked ? 'bg-primary/10 text-primary' : 'bg-surface-3 text-muted-foreground')}>
                            <Icon className="size-[18px]" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-md font-medium text-foreground">{category.name}</span>
                            <span className="block truncate text-body-sm text-muted-foreground">{bucketLabel(bucket)}</span>
                          </span>
                          {checked && (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                              <Check className="size-3.5" strokeWidth={3} />
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )
              ) : (
                <Skeleton className="h-16 w-full rounded-lg" />
              )}
              {categoryError && <p role="alert" className="mt-1 text-body-md text-destructive">{formError}</p>}
            </div>
          )}

          {/* Subcategory chips — only when the chosen category has any */}
          {type === 'EXPENSE' && !isAdjustment && dataLoaded && subcategories.length > 0 && (
            <div>
              <FieldLabel id={subcategoryLabelId} hint="Opcional">Subcategoría</FieldLabel>
              <div role="group" aria-labelledby={subcategoryLabelId} className="flex flex-wrap gap-2">
                {subcategories.map(sub => {
                  const selected = sub.id === expenseSubcategoryId;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setExpenseSubcategoryId(selected ? '' : sub.id)}
                      className={cn(
                        'min-h-11 rounded-lg border px-3 text-body-md outline-none transition-colors focus-visible:shadow-focus',
                        selected ? 'border-primary/40 bg-surface-3 font-medium text-primary' : 'border-border bg-card text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                      )}
                    >
                      {sub.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <FieldLabel icon={CalendarDays}>Fecha y hora</FieldLabel>
            <DateTimeRow date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />
          </div>

          {dataLoaded && usable.length > 0 && (
            <div>
              <FieldLabel icon={Wallet} id={accountLabelId}>Cuenta de pago</FieldLabel>
              <AccountChips labelId={accountLabelId} name="payment-account" accounts={usable} value={accountId} onChange={setAccountId} />
            </div>
          )}

          {canShare && (
            <div className="rounded-lg border border-border bg-surface-3 p-3">
              <div className="flex items-center gap-3">
                <Users className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p id={shareLabelId} className="text-body-md font-medium text-foreground">¿Afecta al Espacio Compartido?</p>
                  <p id={shareHelpId} className="text-body-sm text-muted-foreground">Divide este registro con tu pareja o conviviente.</p>
                </div>
                <Switch
                  checked={shareOn}
                  onCheckedChange={setShareOn}
                  aria-labelledby={shareLabelId}
                  aria-describedby={shareHelpId}
                />
              </div>
              {shareOn && sharedSpaces.length > 1 && (
                <div className="mt-3">
                  <FieldLabel htmlFor="shared-space-select">Espacio compartido</FieldLabel>
                  <Select value={effectiveSpaceId} onValueChange={value => setShareSpaceId(value ?? '')}>
                    <SelectTrigger id="shared-space-select" className="w-full"><SelectValue placeholder="Seleccionar espacio" /></SelectTrigger>
                    <SelectContent>
                      {sharedSpaces.map(space => <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rarely used options stay behind a disclosure (spec 009). */}
        <details
          open={isAdjustment || Boolean(movement?.is_recurring)}
          className="group rounded-lg border border-border bg-card"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 text-body-md font-medium text-foreground outline-none focus-visible:shadow-focus [&::-webkit-details-marker]:hidden">
            Opciones adicionales
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            {showSavingsGoal && dataLoaded && (
              <div>
                <FieldLabel htmlFor="savingsGoal">Meta de Ahorro (Opcional)</FieldLabel>
                <Select value={savingsGoalId} onValueChange={(val) => setSavingsGoalId(val === 'unassigned' ? '' : val || '')}>
                  <SelectTrigger id="savingsGoal" className="w-full">
                    <SelectValue placeholder="— Sin asignar —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">— Sin asignar —</SelectItem>
                    {savingsGoals.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex min-h-11 items-center gap-3">
              <input
                id="isRecurring"
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <Label htmlFor="isRecurring" className="min-h-11 flex-1 cursor-pointer leading-snug">
                {type === 'INCOME' ? 'Es un ingreso fijo (recurrente cada mes)' : 'Es un gasto fijo (recurrente cada mes)'}
              </Label>
            </div>

            {/* Balance adjustment — hides the category selectors (FR-004) and makes the description mandatory (FR-002). */}
            <div className="flex min-h-11 items-center gap-3">
              <input
                id="isAdjustment"
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={isAdjustment}
                onChange={(e) => {
                  setIsAdjustment(e.target.checked);
                  setAdjustmentError(null);
                }}
              />
              <Label htmlFor="isAdjustment" className="min-h-11 flex-1 cursor-pointer leading-snug">
                Es un ajuste de balance
              </Label>
            </div>
          </div>
        </details>

        {formError && !categoryError && (
          <p role="alert" className="text-body-md text-destructive">{formError}</p>
        )}

        <div
          className={cn(
            'space-y-1 pt-1',
            !editing && 'sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-border bg-popover px-4 pb-4 pt-3'
          )}
        >
          <p role="status" aria-live="polite" className={cn('min-h-5 text-center text-body-md text-success', !savedNotice && 'sr-only')}>
            {savedNotice ? 'Registro guardado' : ''}
          </p>
          <div className={cn(editing && 'flex gap-3')}>
            {editing && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
                Cancelar
              </Button>
            )}
            <Button type="submit" size="lg" disabled={isSubmitting} className={cn(editing ? 'flex-1' : 'w-full')}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : !editing && <CheckCircle2 />}
              {primaryLabel}
            </Button>
          </div>
          {!editing && onSavedAndNew && !sharing && (
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => void save(true)} className="w-full text-muted-foreground">
              Guardar y registrar otro
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
