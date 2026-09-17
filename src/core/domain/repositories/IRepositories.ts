import { UUID, Profile, IncomeSource, DistributionCategory, ExpenseCategory, ExpenseSubcategory, SavingsGoal, Movement, Notification, Debt, SharedSpace, SharedSpacePermissionMode, SharedInvite, Membership, SharedMovement, SharedMovementSplit, SharedMovementType, SharedMovementSplitMode } from '../models/types';

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
 * Creation/redemption/leaving all go through server-side RPCs
 * (contracts/rpc-functions.md) — never a direct client insert — because
 * membership is never implicit and never self-granted (Principio IX).
 */
export interface ISharedSpaceRepository {
  getAllForUser(userId: UUID): Promise<SharedSpace[]>;
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
