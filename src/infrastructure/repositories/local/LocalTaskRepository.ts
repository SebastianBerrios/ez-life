import { db } from '../../db/db';
import { ITaskRepository } from '../../../core/domain/repositories/IRepositories';
import { Task, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

export class LocalTaskRepository implements ITaskRepository {
  async getAll(userId: UUID): Promise<Task[]> {
    return await db.tasks
      .where('user_id').equals(userId)
      .filter(t => !t.deleted_at && t.status === 'pending')
      .toArray();
  }

  async save(data: Omit<Task, 'created_at' | 'updated_at'>): Promise<Task> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.tasks.get(id);

    let task: Task;
    if (existing) {
      task = { ...existing, ...data, id, updated_at: now };
    } else {
      task = { ...data, id, created_at: now, updated_at: now };
    }

    await db.tasks.put(task);
    return task;
  }

  async markDone(id: UUID): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const now = new Date();
    const updated: Task = { ...existing, status: 'done', done_at: now, updated_at: now };
    await db.tasks.put(updated);
    return updated;
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.tasks.get(id);
    if (existing) {
      await db.tasks.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
