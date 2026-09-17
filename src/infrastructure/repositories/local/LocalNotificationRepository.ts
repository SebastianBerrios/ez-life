import { db } from '../../db/db';
import { INotificationRepository } from '../../../core/domain/repositories/IRepositories';
import { Notification, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

export class LocalNotificationRepository implements INotificationRepository {
  async save(data: Omit<Notification, 'created_at' | 'updated_at'>): Promise<Notification> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.notifications.get(id);

    const notification: Notification = existing
      ? { ...existing, ...data, id, updated_at: now }
      : { ...data, id, created_at: now, updated_at: now };

    await db.notifications.put(notification);
    return notification;
  }

  async getAllByUser(userId: UUID): Promise<Notification[]> {
    const records = await db.notifications
      .where('user_id')
      .equals(userId)
      .filter(n => !n.deleted_at)
      .toArray();

    return records.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async markRead(id: UUID): Promise<void> {
    const existing = await db.notifications.get(id);
    if (existing) {
      await db.notifications.put({ ...existing, read_at: new Date(), updated_at: new Date() });
    }
  }
}
