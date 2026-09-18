import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalHabitRepository } from './LocalHabitRepository';
import { uuidv7 } from 'uuidv7';
import type { Habit } from '../../../core/domain/models/types';

describe('LocalHabitRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('save() with an existing id updates fields in place instead of creating a new row (FR-006)', async () => {
    const repo = new LocalHabitRepository();
    const userId = uuidv7();

    const created = await repo.save({
      id: '', user_id: userId, name: 'Correr', schedule_mode: 'fixed_days', fixed_days: ['mon', 'wed'],
    } as Omit<Habit, 'created_at' | 'updated_at'>);

    const edited = await repo.save({
      id: created.id, user_id: userId, name: 'Correr y estirar', schedule_mode: 'frequency', frequency_target: 3,
    } as Omit<Habit, 'created_at' | 'updated_at'>);

    expect(edited.id).toBe(created.id);
    expect(edited.name).toBe('Correr y estirar');
    expect(edited.schedule_mode).toBe('frequency');
    expect(edited.frequency_target).toBe(3);
    expect(edited.created_at).toEqual(created.created_at);

    const all = await repo.getAll(userId);
    expect(all).toHaveLength(1);
  });
});
