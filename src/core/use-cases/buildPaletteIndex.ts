import type { Goal, Habit, Movement, PaymentAccount, SavingsGoal, Task } from '../domain/models/types';
import { describeHabitSchedule } from './describeHabitSchedule';
import { describeMovement, EMPTY_LOOKUPS, movementSearchHaystacks, type MovementKind, type MovementLookups } from './describeMovement';
import { describeTaskDue } from './describeTaskDue';
import { formatMoney } from './formatMoney';
import { formatMovementWhen, formatShortDate } from './formatMovementWhen';
import { normalizeText } from './searchText';

export type PaletteKind = 'action' | 'route' | 'movement' | 'task' | 'habit' | 'goal' | 'savings-goal' | 'account';

export type PaletteActionId =
  | 'new-expense' | 'new-income' | 'transfer' | 'new-habit' | 'new-task' | 'new-goal' | 'new-savings-goal' | 'toggle-theme';

export type PaletteFinancesTab = 'movements' | 'budget' | 'loans';

export type PalettePayload =
  | { type: 'action'; action: PaletteActionId }
  | { type: 'route'; route: string; financesTab?: PaletteFinancesTab }
  | { type: 'movement'; id: string; date: Date }
  | { type: 'task' | 'habit' | 'goal' | 'savings-goal' | 'account'; id: string };

export interface PaletteEntry {
  id: string;
  kind: PaletteKind;
  title: string;
  subtitle: string;
  /** Already normalized with `normalizeText` (lower case, no accents), so searching never re-normalizes the index. */
  haystacks: string[];
  payload: PalettePayload;
  /** Movements only: cents and kind, so the row can render the amount with `Money`. */
  amount?: number;
  movementKind?: MovementKind;
}

export interface PaletteIndexInput {
  movements?: Movement[];
  /** id -> label tables for movement text (categories, accounts…). */
  lookups?: MovementLookups;
  tasks?: Task[];
  habits?: Habit[];
  goals?: Goal[];
  savingsGoals?: SavingsGoal[];
  accounts?: PaymentAccount[];
  /** Moment "Hoy"/"Ayer" are relative to. */
  today: Date;
  /** "Mi Progreso" is only offered while gamification is on. */
  gamificationVisible?: boolean;
}

const ACCOUNT_KIND_LABEL: Record<PaymentAccount['kind'], string> = {
  debit: 'Débito', credit: 'Crédito', cash: 'Efectivo', savings: 'Ahorros',
};

const norm = (texts: ReadonlyArray<string | undefined | null | false>): string[] =>
  texts.filter((text): text is string => Boolean(text)).map(normalizeText);

interface ActionDef { action: PaletteActionId; title: string; subtitle: string; keywords: string[] }

const ACTIONS: ActionDef[] = [
  { action: 'new-expense', title: 'Nuevo gasto', subtitle: 'Registrar un egreso', keywords: ['gasto', 'egreso', 'registrar', 'compra', 'nuevo registro'] },
  { action: 'new-income', title: 'Nuevo ingreso', subtitle: 'Registrar un ingreso', keywords: ['ingreso', 'sueldo', 'registrar', 'cobro', 'nuevo registro'] },
  { action: 'transfer', title: 'Transferir', subtitle: 'Mover dinero entre cuentas', keywords: ['mover', 'transferencia', 'cuentas'] },
  { action: 'new-habit', title: 'Nuevo hábito', subtitle: 'Crear un hábito', keywords: ['habito', 'rutina', 'crear'] },
  { action: 'new-task', title: 'Nueva tarea', subtitle: 'Crear una tarea', keywords: ['tarea', 'pendiente', 'crear'] },
  { action: 'new-goal', title: 'Nueva meta', subtitle: 'Crear una meta', keywords: ['meta', 'objetivo', 'crear'] },
  { action: 'new-savings-goal', title: 'Nueva meta de ahorro', subtitle: 'Crear una meta de ahorro', keywords: ['meta', 'ahorro', 'objetivo', 'crear'] },
  { action: 'toggle-theme', title: 'Cambiar tema', subtitle: 'Alternar entre claro y oscuro', keywords: ['tema', 'claro', 'oscuro', 'modo', 'apariencia'] },
];

interface RouteDef { route: string; financesTab?: PaletteFinancesTab; title: string; subtitle: string; keywords: string[]; gamified?: boolean }

const ROUTES: RouteDef[] = [
  { route: 'dashboard', title: 'Inicio', subtitle: 'Resumen del ciclo', keywords: ['resumen', 'dashboard', 'balance'] },
  { route: 'finances', financesTab: 'movements', title: 'Finanzas', subtitle: 'Movimientos del mes', keywords: ['movimientos', 'gastos', 'ingresos', 'historial'] },
  { route: 'finances', financesTab: 'budget', title: 'Regla 50/30/20', subtitle: 'Finanzas · presupuesto por bucket', keywords: ['presupuesto', 'finanzas', 'buckets', 'necesidades'] },
  { route: 'finances', financesTab: 'loans', title: 'Préstamos', subtitle: 'Finanzas · cuotas y deudas', keywords: ['deudas', 'cuotas', 'finanzas', 'prestamo'] },
  { route: 'control', title: 'Control & Hábitos', subtitle: 'Hábitos, tareas y metas', keywords: ['control', 'habitos', 'tareas', 'metas'] },
  { route: 'shared-space', title: 'Espacio Compartido', subtitle: 'Gastos compartidos', keywords: ['compartido', 'grupo', 'espacio', 'saldos'] },
  { route: 'progress', title: 'Mi Progreso', subtitle: 'Logros personales', keywords: ['logros', 'progreso', 'insignias'], gamified: true },
  { route: 'settings', title: 'Ajustes', subtitle: 'Perfil, cuentas y preferencias', keywords: ['configuracion', 'ajustes', 'cuentas', 'notificaciones', 'exportar'] },
];

function goalSubtitle(goal: Goal): string {
  if (goal.status === 'completed') return 'Completada';
  if (goal.kind === 'numeric') return `${goal.current_value ?? 0} de ${goal.target_value ?? 0}`;
  const milestones = goal.milestones ?? [];
  return `${milestones.filter(m => m.done).length} de ${milestones.length} hitos`;
}

/**
 * Flat, searchable list behind the ⌘K palette: actions, routes and the user's real movements, tasks,
 * habits, goals, savings goals and accounts. Pure: nothing is invented (no entry without real data).
 * Order inside each kind is the order searches fall back to when ranks tie: movements newest first,
 * tasks by due date (done last), the rest as given.
 */
export function buildPaletteIndex(input: PaletteIndexInput): PaletteEntry[] {
  const { today, gamificationVisible = true } = input;
  const lookups = input.lookups ?? EMPTY_LOOKUPS;
  const entries: PaletteEntry[] = [];

  for (const def of ACTIONS) {
    entries.push({
      id: `action:${def.action}`, kind: 'action', title: def.title, subtitle: def.subtitle,
      haystacks: norm([def.title, ...def.keywords]), payload: { type: 'action', action: def.action },
    });
  }

  for (const def of ROUTES) {
    if (def.gamified && !gamificationVisible) continue;
    entries.push({
      id: `route:${def.route}${def.financesTab ? `:${def.financesTab}` : ''}`, kind: 'route', title: def.title, subtitle: def.subtitle,
      haystacks: norm([def.title, 'ir a', ...def.keywords]),
      payload: { type: 'route', route: def.route, ...(def.financesTab && def.route === 'finances' ? { financesTab: def.financesTab } : {}) },
    });
  }

  const movements = [...(input.movements ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const movement of movements) {
    const d = describeMovement(movement, lookups);
    const detail = d.kind === 'transfer'
      ? `${d.accountName ?? '—'} → ${d.toAccountName ?? '—'}`
      : d.kind === 'income' ? d.category ?? 'Ingreso' : d.category ?? 'Gasto';
    entries.push({
      id: `movement:${movement.id}`, kind: 'movement', title: d.title,
      subtitle: `${formatMovementWhen(movement.date, today)} · ${detail}`,
      haystacks: norm(movementSearchHaystacks(movement, lookups)),
      payload: { type: 'movement', id: movement.id, date: movement.date },
      amount: movement.amount, movementKind: d.kind,
    });
  }

  const tasks = [...(input.tasks ?? [])].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
    return a.due_date.getTime() - b.due_date.getTime();
  });
  for (const task of tasks) {
    const due = describeTaskDue(task, today);
    entries.push({
      id: `task:${task.id}`, kind: 'task', title: task.title,
      subtitle: [due.text, task.tag].filter(Boolean).join(' · '),
      haystacks: norm([task.title, task.tag, task.description, due.text, task.status === 'done' ? 'hecha' : 'pendiente']),
      payload: { type: 'task', id: task.id },
    });
  }

  for (const habit of input.habits ?? []) {
    const schedule = describeHabitSchedule(habit);
    entries.push({
      id: `habit:${habit.id}`, kind: 'habit', title: habit.name, subtitle: schedule,
      haystacks: norm([habit.name, schedule]), payload: { type: 'habit', id: habit.id },
    });
  }

  for (const goal of input.goals ?? []) {
    entries.push({
      id: `goal:${goal.id}`, kind: 'goal', title: goal.name, subtitle: goalSubtitle(goal),
      haystacks: norm([goal.name, goal.description]), payload: { type: 'goal', id: goal.id },
    });
  }

  for (const goal of input.savingsGoals ?? []) {
    const target = formatMoney(goal.target_amount);
    entries.push({
      id: `savings-goal:${goal.id}`, kind: 'savings-goal', title: goal.name,
      subtitle: goal.deadline ? `Meta ${target} · hasta ${formatShortDate(goal.deadline)}` : `Meta ${target}`,
      haystacks: norm([goal.name, target, formatMoney(goal.target_amount, { symbol: false }), formatMoney(goal.target_amount, { symbol: false }).replace(/,/g, '')]),
      payload: { type: 'savings-goal', id: goal.id },
    });
  }

  for (const account of input.accounts ?? []) {
    const kindLabel = ACCOUNT_KIND_LABEL[account.kind];
    entries.push({
      id: `account:${account.id}`, kind: 'account', title: account.name,
      subtitle: account.archived ? `${kindLabel} · Archivada` : kindLabel,
      haystacks: norm([account.name, kindLabel, 'cuenta', 'cuentas de pago']), payload: { type: 'account', id: account.id },
    });
  }

  return entries;
}
