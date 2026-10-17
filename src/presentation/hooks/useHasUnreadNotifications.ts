import { useEffect, useState } from 'react';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';
import { onLocalChanges } from '../../infrastructure/db/localChanges';

/**
 * True while the user has at least one unread notification. Achievement notifications are ignored
 * when `includeAchievements` is false (personal progress hidden), same rule as NotificationHistory.
 */
export function useHasUnreadNotifications(userId: string | null, includeAchievements: boolean): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHasUnread(false);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const notifications = await new LocalNotificationRepository().getAllByUser(userId);
        if (active) {
          setHasUnread(notifications.some(n => !n.read_at && (includeAchievements || n.type !== 'achievement_unlocked')));
        }
      } catch (error) {
        console.error(error);
      }
    };
    void load();
    const unsubscribe = onLocalChanges(['notifications'], load);
    return () => { active = false; unsubscribe(); };
  }, [userId, includeAchievements]);

  return hasUnread;
}
