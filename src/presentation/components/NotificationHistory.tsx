'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';
import { Notification, NotificationType } from '../../core/domain/models/types';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { formatMovementWhen } from '../../core/use-cases/formatMovementWhen';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, BellOff, PiggyBank, Trophy, Bell, HandCoins, Users, Flame, AlertTriangle, CalendarClock, type LucideIcon } from 'lucide-react';

// One icon per notification type (Principio XI: a single pipeline, so every
// type this app will ever raise gets a home here, not a parallel display).
const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  achievement_unlocked: Trophy,
  budget_over_80: PiggyBank,
  goal_completed: Trophy,
  daily_reminder: Bell,
  loan_due_soon: HandCoins,
  shared_movement_added: Users,
  habit_reminder: Flame,
  streak_at_risk: AlertTriangle,
  task_due: CalendarClock,
};

interface Props {
  userId: string;
  onClose: () => void;
}

export default function NotificationHistory({ userId, onClose }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const repo = new LocalNotificationRepository();
      const data = await repo.getAllByUser(userId);
      const profile = await new LocalProfileRepository().get(userId);
      setNotifications(profile?.gamification_enabled === false ? data.filter(n => n.type !== 'achievement_unlocked') : data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
    return onLocalChanges(['profiles', 'notifications'], loadNotifications);
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      const repo = new LocalNotificationRepository();
      await repo.markRead(id);
      await loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const now = new Date();

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-row items-center justify-between gap-3">
        <div>
          <p className="font-mono text-label-mono-xs uppercase text-muted-foreground">Historial</p>
          <h2 className="text-headline-md text-foreground">Notificaciones</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      </div>
      <div>
        {loading && (
          <div role="status" className="py-4 text-center text-body-md text-muted-foreground">Cargando...</div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="space-y-2 py-8 text-center">
            <BellOff aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <p className="text-body-md text-muted-foreground">No tienes notificaciones todavía.</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <ul className="flex flex-col gap-2">
            {notifications.map(n => {
              const isUnread = !n.read_at;
              const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
              return (
                <li
                  key={n.id}
                  data-testid={`notification-${n.id}`}
                  data-unread={isUnread}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-lg border p-3',
                    isUnread ? 'border-primary/30 bg-surface-2' : 'border-border bg-card',
                  )}
                >
                  <span aria-hidden="true" className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-3', isUnread ? 'text-primary' : 'text-muted-foreground')}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex items-center gap-2 text-body-md font-semibold text-foreground">
                      {isUnread && <span className="size-2 shrink-0 rounded-full bg-primary" role="img" aria-label="Sin leer" />}
                      <span className="min-w-0 break-words">{n.title}</span>
                    </p>
                    <p className="text-body-md text-muted-foreground">{n.body}</p>
                    <p className="font-mono text-label-mono-xs text-muted-foreground">{formatMovementWhen(new Date(n.created_at), now)}</p>
                  </div>
                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 text-primary hover:text-primary"
                    >
                      Marcar leída
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
