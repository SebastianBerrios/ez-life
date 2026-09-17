'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';
import { Notification, NotificationType } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { X, BellOff, PiggyBank, Trophy, Bell, HandCoins, Users, Flame, AlertTriangle, CalendarClock, type LucideIcon } from 'lucide-react';

// One icon per notification type (Principio XI: a single pipeline, so every
// type this app will ever raise gets a home here, not a parallel display).
const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
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
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
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

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-row items-center justify-between">
        <h2 className="font-heading text-base leading-none font-medium">Notificaciones</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div>
        {loading && (
          <div className="text-center py-4 text-muted-foreground">Cargando...</div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <BellOff className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No tenés notificaciones todavía.</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <ul className="-mx-5 divide-y divide-border sm:-mx-6">
            {notifications.map(n => {
              const isUnread = !n.read_at;
              const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
              return (
                <li
                  key={n.id}
                  className={`px-4 py-4 flex items-start justify-between gap-3 ${isUnread ? 'bg-muted/40' : ''}`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isUnread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />}
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {isUnread && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                      className="h-auto shrink-0 p-0 text-xs font-medium text-primary transition-colors hover:text-primary/80"
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
