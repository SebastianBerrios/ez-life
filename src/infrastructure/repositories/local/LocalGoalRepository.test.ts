import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalGoalRepository } from './LocalGoalRepository';
import { uuidv7 } from 'uuidv7';
import type { Goal } from '../../../core/domain/models/types';

describe('LocalGoalRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('save() with an existing id updates fields in place instead of creating a new row (FR-006)', async () => {
    const repo = new LocalGoalRepository();
    const userId = uuidv7();

    const created = await repo.save({
      id: '', user_id: userId, name: 'Original', kind: 'numeric', target_value: 100, current_value: 0, status: 'active',
    } as Omit<Goal, 'created_at' | 'updated_at'>);

    const edited = await repo.save({
      id: created.id, user_id: userId, name: 'Editado', kind: 'numeric', target_value: 100, current_value: 0, status: 'active',
    } as Omit<Goal, 'created_at' | 'updated_at'>);

    expect(edited.id).toBe(created.id);
    expect(edited.name).toBe('Editado');
    expect(edited.created_at).toEqual(created.created_at);

    const all = await repo.getAll(userId);
    expect(all).toHaveLength(1);
  });

  it('preserves status/current_value/completed_at when an edit save() omits them (FR-006)', async () => {
    const repo = new LocalGoalRepository();
    const userId = uuidv7();

    const created = await repo.save({
      id: '', user_id: userId, name: 'Correr 100km', kind: 'numeric', target_value: 100, current_value: 0, status: 'active',
    } as Omit<Goal, 'created_at' | 'updated_at'>);

    // Reach the target so the goal becomes 'completed' with a completed_at timestamp.
    const completed = await repo.updateProgress(created.id, { currentValue: 100 });
    expect(completed.status).toBe('completed');
    expect(completed.completed_at).toBeInstanceOf(Date);

    // Editing only the name must not reset progress/completion — the edit
    // form never sends status/current_value/completed_at at all, exactly
    // like a real GoalForm edit submission would.
    const edited = await repo.save({
      id: created.id, user_id: userId, name: 'Correr 100km (renombrada)', kind: 'numeric', target_value: 100,
    } as unknown as Omit<Goal, 'created_at' | 'updated_at'>);

    expect(edited.name).toBe('Correr 100km (renombrada)');
    expect(edited.status).toBe('completed');
    expect(edited.current_value).toBe(100);
    expect(edited.completed_at).toEqual(completed.completed_at);
  });
});
