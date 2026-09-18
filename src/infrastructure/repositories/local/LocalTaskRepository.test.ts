import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalTaskRepository } from './LocalTaskRepository';
import { uuidv7 } from 'uuidv7';
import type { Task } from '../../../core/domain/models/types';

describe('LocalTaskRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('save() with an existing id updates fields in place instead of creating a new row (FR-006)', async () => {
    const repo = new LocalTaskRepository();
    const userId = uuidv7();

    const created = await repo.save({
      id: '', user_id: userId, title: 'Original', due_date: new Date('2026-10-01'), status: 'pending',
    } as Omit<Task, 'created_at' | 'updated_at'>);

    const edited = await repo.save({
      id: created.id, user_id: userId, title: 'Editada', due_date: new Date('2026-10-02'), status: 'pending',
    } as Omit<Task, 'created_at' | 'updated_at'>);

    expect(edited.id).toBe(created.id);
    expect(edited.title).toBe('Editada');
    expect(edited.created_at).toEqual(created.created_at);
  });

  it('preserves status/done_at when an edit save() omits them (FR-006)', async () => {
    const repo = new LocalTaskRepository();
    const userId = uuidv7();

    const created = await repo.save({
      id: '', user_id: userId, title: 'Pagar el alquiler', due_date: new Date('2026-10-01'), status: 'pending',
    } as Omit<Task, 'created_at' | 'updated_at'>);

    const done = await repo.markDone(created.id);
    expect(done.status).toBe('done');
    expect(done.done_at).toBeInstanceOf(Date);

    // Editing only the title/due date must not un-do "hecha" — a real
    // TaskForm edit submission never sends status/done_at at all.
    const edited = await repo.save({
      id: created.id, user_id: userId, title: 'Pagar el alquiler (retitulada)', due_date: new Date('2026-10-05'),
    } as unknown as Omit<Task, 'created_at' | 'updated_at'>);

    expect(edited.title).toBe('Pagar el alquiler (retitulada)');
    expect(edited.status).toBe('done');
    expect(edited.done_at).toEqual(done.done_at);
  });
});
