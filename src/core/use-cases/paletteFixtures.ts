import type { Goal, Habit, Movement, PaymentAccount, SavingsGoal, Task } from '../domain/models/types';
import type { MovementLookups } from './describeMovement';

/** Test fixtures shared by the palette tests (core and presentation). Fake data only. */
const stamp = { created_at: new Date(2026, 0, 1), updated_at: new Date(2026, 0, 1) };

export const PALETTE_TODAY = new Date(2026, 9, 16, 12, 0);

export const paletteLookups: MovementLookups = {
  categoryName: { c1: 'Alimentación', c2: 'Transporte' },
  subcategoryName: { s1: 'Restaurantes' },
  incomeSourceName: { i1: 'Sueldo' },
  bucket: { b1: { name: 'Necesidades', percentage: 50 } },
  accountName: { a1: 'BCP Débito', a2: 'Efectivo' },
};

export const paletteMovements: Movement[] = [
  { ...stamp, id: 'm-old', user_id: 'u', type: 'EXPENSE', amount: 1250, date: new Date(2026, 9, 1, 9, 0), description: 'Almuerzo', expense_category_id: 'c1', distribution_category_id: 'b1', account_id: 'a1', is_recurring: false },
  { ...stamp, id: 'm-income', user_id: 'u', type: 'INCOME', amount: 300000, date: new Date(2026, 9, 5, 8, 0), description: 'Sueldo octubre', income_source_id: 'i1', is_recurring: false },
  { ...stamp, id: 'm-new', user_id: 'u', type: 'EXPENSE', amount: 899, date: new Date(2026, 9, 16, 10, 30), expense_category_id: 'c2', account_id: 'a2', is_recurring: false },
  { ...stamp, id: 'm-transfer', user_id: 'u', type: 'TRANSFER', amount: 5000, date: new Date(2026, 9, 10, 18, 0), account_id: 'a2', to_account_id: 'a1', is_recurring: false },
];

export const paletteTasks: Task[] = [
  { ...stamp, id: 't-done', user_id: 'u', title: 'Pagar luz', due_date: new Date(2026, 9, 12, 12), status: 'done' },
  { ...stamp, id: 't-later', user_id: 'u', title: 'Renovar seguro', due_date: new Date(2026, 9, 28, 12), status: 'pending', tag: 'Hogar' },
  { ...stamp, id: 't-today', user_id: 'u', title: 'Llamar al banco', due_date: new Date(2026, 9, 16, 12), status: 'pending' },
];

export const paletteHabits: Habit[] = [
  { ...stamp, id: 'h1', user_id: 'u', name: 'Meditación', schedule_mode: 'fixed_days', fixed_days: ['mon', 'wed', 'fri'] },
  { ...stamp, id: 'h2', user_id: 'u', name: 'Lectura', schedule_mode: 'frequency', frequency_target: 3 },
];

export const paletteGoals: Goal[] = [
  { ...stamp, id: 'g1', user_id: 'u', name: 'Correr 10K', kind: 'numeric', target_value: 10, current_value: 4, status: 'active' },
  { ...stamp, id: 'g2', user_id: 'u', name: 'Curso de inglés', kind: 'checklist', milestones: [{ id: 'x', label: 'A', done: true }, { id: 'y', label: 'B', done: false }], status: 'active' },
];

export const paletteSavingsGoals: SavingsGoal[] = [
  { ...stamp, id: 'sg1', user_id: 'u', name: 'Viaje a Cusco', target_amount: 300000 },
];

export const paletteAccounts: PaymentAccount[] = [
  { ...stamp, id: 'a1', user_id: 'u', name: 'BCP Débito', kind: 'debit', opening_balance: 0 },
  { ...stamp, id: 'a2', user_id: 'u', name: 'Efectivo', kind: 'cash', opening_balance: 0 },
];
