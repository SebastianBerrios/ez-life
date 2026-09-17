'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';
import { Notification } from '../../core/domain/models/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, BellOff } from 'lucide-react';

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
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Notificaciones</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
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
          <ul className="divide-y divide-border -mx-4">
            {notifications.map(n => {
              const isUnread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className={`px-4 py-4 flex items-start justify-between gap-3 ${isUnread ? 'bg-muted/40' : ''}`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isUnread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />}
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
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="text-xs font-medium text-primary hover:text-primary/80 shrink-0"
                    >
                      Marcar leída
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
