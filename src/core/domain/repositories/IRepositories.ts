import { UUID, Profile, IncomeSource, DistributionCategory, ExpenseCategory, ExpenseSubcategory, SavingsGoal, Movement, Notification, Debt, SharedSpace, SharedSpacePermissionMode, SharedInvite, Membership, SharedMovement, SharedMovementSplit, SharedMovementType, SharedMovementSplitMode, Habit, HabitCompletion, Goal, Task, InstallmentLoan, InstallmentPayment } from '../models/types';

/** The user's own choice from FR-016 — the resulting value is always theirs, never computed (FR-017). */
export type PrincipalPaymentAdjustment =
  | { type: 'reduce_term'; newRemainingInstallments: number }
  | { type: 'reduce_installment_amount'; newInstallmentAmountCents: number };

export interface IProfileRepository {
  get(id: UUID): Promise<Profile | undefined>;
  save(profile: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile>;
}

export interface IIncomeSourceRepository {
  getAll(userId: UUID): Promise<IncomeSource[]>;
  save(incomeSource: Omit<IncomeSource, 'created_at' | 'updated_at'>): Promise<IncomeSource>;
  delete(id: UUID): Promise<void>;
}

export interface ICategoryRepository {
  getDistributionCategories(userId: UUID): Promise<DistributionCategory[]>;
  saveDistributionCategory(category: Omit<DistributionCategory, 'created_at' | 'updated_at'>): Promise<DistributionCategory>;
  deleteDistributionCategory(id: UUID): Promise<void>;

  getExpenseCategories(userId: UUID): Promise<ExpenseCategory[]>;
  saveExpenseCategory(category: Omit<ExpenseCategory, 'created_at' | 'updated_at'>): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: UUID): Promise<void>;
  countExpenseCategoriesByDistribution(distributionCategoryId: UUID): Promise<number>;

  getSubcategories(categoryId: UUID): Promise<ExpenseSubcategory[]>;
  saveSubcategory(subcategory: Omit<ExpenseSubcategory, 'created_at' | 'updated_at'>): Promise<ExpenseSubcategory>;
  deleteSubcategory(id: UUID): Promise<void>;
}

export interface ISavingsGoalRepository {
  getAll(userId: UUID): Promise<SavingsGoal[]>;
  save(goal: Omit<SavingsGoal, 'created_at' | 'updated_at'>): Promise<SavingsGoal>;
  delete(id: UUID): Promise<void>;
}

export interface IMovementRepository {
  getAllByCycle(userId: UUID, startDate: Date, endDate: Date): Promise<Movement[]>;
  getAll(userId: UUID): Promise<Movement[]>;
  save(data: Omit<Movement, 'created_at' | 'updated_at'>): Promise<Movement>;
  delete(id: UUID): Promise<void>;
  countByDistributionCategory(categoryId: UUID): Promise<number>;
  countByExpenseCategory(categoryId: UUID): Promise<number>;
  countByExpenseSubcategory(subcategoryId: UUID): Promise<number>;
  countBySavingsGoal(goalId: UUID): Promise<number>;
}

export interface INotificationRepository {
  save(notification: Omit<Notification, 'created_at' | 'updated_at'>): Promise<Notification>;
  getAllByUser(userId: UUID): Promise<Notification[]>;
  markRead(id: UUID): Promise<void>;
}

export interface IDebtRepository {
  getAll(userId: UUID): Promise<Debt[]>;
  getById(id: UUID): Promise<Debt | undefined>;
  save(debt: Omit<Debt, 'created_at' | 'updated_at'>): Promise<Debt>;
  recordSettlement(id: UUID, paymentAmount: number): Promise<Debt>;
  delete(id: UUID): Promise<void>;
}

/**
 * A separate entity from Debt on purpose (research.md #3) — bank/caja loans
 * with a lender-defined installment schedule. `recordInstallmentPayment` and
 * `recordPrincipalPayment` delegate all validation/derivation to the pure
 * use-cases in `core/use-cases/` (Principio III); neither ever creates or
 * touches a Movement (FR-027, Principio X).
 */
export interface IInstallmentLoanRepository {
  getAll(userId: UUID): Promise<InstallmentLoan[]>;
  getById(id: UUID): Promise<InstallmentLoan | undefined>;
  /** `remaining_installments` is always initialized to `installment_count` (FR-011). */
  create(loan: Omit<InstallmentLoan, 'created_at' | 'updated_at' | 'remaining_installments' | 'status'>): Promise<void>;
  /** Corrects the original terms — independent of recording a payment, never changes status (FR-022). */
  updateTerms(id: UUID, changes: { amount?: number; installmentCount?: number; installmentAmount?: number; interestRate?: number }): Promise<void>;
  recordInstallmentPayment(loanId: UUID, installmentsPaid: number, date: Date): Promise<void>;
  recordPrincipalPayment(loanId: UUID, amountCents: number, date: Date, adjustment: PrincipalPaymentAdjustment): Promise<void>;
  /** Full history, ordered by date (FR-026). */
  getPayments(loanId: UUID): Promise<InstallmentPayment[]>;
  delete(id: UUID): Promise<void>;
}

/**
 * Creation/redemption/leaving all go through server-side RPCs
 * (contracts/rpc-functions.md) — never a direct client insert — because
 * membership is never implicit and never self-granted (Principio IX).
 */
export interface ISharedSpaceRepository {
  getAllForUser(userId: UUID): Promise<SharedSpace[]>;
  /** Spaces the user is no longer an active member of, but was — frozen balance stays visible (FR-016). */
  getLeftForUser(userId: UUID): Promise<SharedSpace[]>;
  create(name: string): Promise<SharedSpace>;
  setPermissionMode(spaceId: UUID, mode: SharedSpacePermissionMode): Promise<void>;
}

export interface ISharedInviteRepository {
  create(spaceId: UUID): Promise<SharedInvite>;
  redeem(code: string): Promise<Membership>;
}

export interface IMembershipRepository {
  getMembers(spaceId: UUID): Promise<Membership[]>;
  leave(spaceId: UUID): Promise<void>;
}

export interface CreateSharedMovementParams {
  id: UUID;
  sharedSpaceId: UUID;
  type: SharedMovementType;
  totalAmountCents: number;
  splitMode: SharedMovementSplitMode;
  splits: SharedMovementSplit[]; // already computed client-side (core/use-cases/createSharedMovement)
  date: Date;
  /** Creator's own bucket for their own share (FR-012) — never applied to another member's share (RLS, see contracts/rpc-functions.md). */
  creatorDistributionCategoryId?: UUID;
}

/**
 * `create` inserts rows for OTHER members too (the linked Movement per
 * split), which a simple "own rows only" RLS policy can't allow for a
 * non-creator's row — it goes through the `create_shared_movement` RPC
 * (contracts/rpc-functions.md), never a direct client insert.
 */
export interface ISharedMovementRepository {
  getAllForSpace(spaceId: UUID): Promise<SharedMovement[]>;
  create(params: CreateSharedMovementParams): Promise<SharedMovement>;
  delete(id: UUID): Promise<void>;
}

export interface IHabitRepository {
  getAll(userId: UUID): Promise<Habit[]>;
  save(habit: Omit<Habit, 'created_at' | 'updated_at'>): Promise<Habit>;
  delete(id: UUID): Promise<void>;
  getCompletions(habitId: UUID): Promise<HabitCompletion[]>;
  /** Streak/token math is never computed here — see evaluateHabitStreak.ts (Principio III). */
  recordCompletion(habitId: UUID, date: Date, tokenUsed: boolean): Promise<HabitCompletion>;
}

export interface IGoalRepository {
  getAll(userId: UUID): Promise<Goal[]>;
  save(goal: Omit<Goal, 'created_at' | 'updated_at'>): Promise<Goal>;
  /** Completion is evaluated by evaluateGoalCompletion.ts, not here (Principio III). */
  updateProgress(goalId: UUID, update: { currentValue: number } | { milestoneId: UUID; done: boolean }): Promise<Goal>;
  delete(id: UUID): Promise<void>;
}

export interface ITaskRepository {
  /** Only pending (non-done, non-deleted) tasks — a done task is archived (FR-021). */
  getAll(userId: UUID): Promise<Task[]>;
  save(task: Omit<Task, 'created_at' | 'updated_at'>): Promise<Task>;
  markDone(id: UUID): Promise<Task>;
  delete(id: UUID): Promise<void>;
}
