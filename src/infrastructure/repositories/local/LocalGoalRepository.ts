import { db } from '../../db/db';
import { IGoalRepository } from '../../../core/domain/repositories/IRepositories';
import { Goal, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { evaluateGoalCompletion } from '../../../core/use-cases/evaluateGoalCompletion';

export class LocalGoalRepository implements IGoalRepository {
  async getAll(userId: UUID): Promise<Goal[]> {
    return await db.goals.where('user_id').equals(userId).filter(g => !g.deleted_at).toArray();
  }

  async save(data: Omit<Goal, 'created_at' | 'updated_at'>): Promise<Goal> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.goals.get(id);

    let goal: Goal;
    if (existing) {
      goal = { ...existing, ...data, id, updated_at: now };
    } else {
      goal = { ...data, id, created_at: now, updated_at: now };
    }

    await db.goals.put(goal);
    return goal;
  }

  async updateProgress(
    goalId: UUID,
    update: { currentValue: number } | { milestoneId: UUID; done: boolean }
  ): Promise<Goal> {
    const existing = await db.goals.get(goalId);
    if (!existing) {
      throw new Error(`Goal ${goalId} not found`);
    }

    const updated: Goal = { ...existing };
    if ('currentValue' in update) {
      updated.current_value = update.currentValue;
    } else {
      updated.milestones = (existing.milestones ?? []).map(m =>
        m.id === update.milestoneId ? { ...m, done: update.done } : m
      );
    }

    const isCompleted = evaluateGoalCompletion(updated);
    updated.status = isCompleted ? 'completed' : 'active';
    updated.completed_at = isCompleted ? (existing.completed_at ?? new Date()) : undefined;
    updated.updated_at = new Date();

    await db.goals.put(updated);
    return updated;
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.goals.get(id);
    if (existing) {
      await db.goals.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
