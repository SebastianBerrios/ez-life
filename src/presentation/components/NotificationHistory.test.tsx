import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationHistory from './NotificationHistory';
import { db } from '../../infrastructure/db/db';
import { LocalNotificationRepository } from '../../infrastructure/repositories/local/LocalNotificationRepository';

const U = 'u';

async function notify(patch: { id: string; title: string; body: string; type?: 'daily_reminder' | 'achievement_unlocked'; read_at?: Date }) {
  return new LocalNotificationRepository().save({ user_id: U, type: patch.type ?? 'daily_reminder', ...patch });
}

beforeEach(async () => { await db.delete(); await db.open(); });

describe('NotificationHistory', () => {
  it('shows an honest empty state', async () => {
    render(<NotificationHistory userId={U} onClose={vi.fn()} />);
    expect(await screen.findByText('No tienes notificaciones todavía.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  it('lists notifications with unread ones marked and a deterministic date', async () => {
    await notify({ id: 'n1', title: 'Registra tus movimientos', body: 'No olvides anotar tus gastos de hoy.' });
    await notify({ id: 'n2', title: 'Ya leída', body: 'Esta ya se vio.', read_at: new Date() });
    render(<NotificationHistory userId={U} onClose={vi.fn()} />);

    const unread = await screen.findByTestId('notification-n1');
    expect(unread).toHaveAttribute('data-unread', 'true');
    expect(within(unread).getByRole('img', { name: 'Sin leer' })).toBeInTheDocument();
    expect(within(unread).getByText(/^Hoy, \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(within(unread).getByRole('button', { name: 'Marcar leída' })).toBeInTheDocument();

    const read = screen.getByTestId('notification-n2');
    expect(read).toHaveAttribute('data-unread', 'false');
    expect(within(read).queryByRole('button', { name: 'Marcar leída' })).toBeNull();
  });

  it('marks a notification as read', async () => {
    const user = userEvent.setup();
    await notify({ id: 'n1', title: 'Registra tus movimientos', body: 'Hoy.' });
    render(<NotificationHistory userId={U} onClose={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Marcar leída' }));

    await waitFor(() => expect(screen.getByTestId('notification-n1')).toHaveAttribute('data-unread', 'false'));
    expect((await db.notifications.get('n1'))?.read_at).toBeInstanceOf(Date);
  });

  it('hides achievement notifications while gamification is off', async () => {
    await db.profiles.put({ id: U, gamification_enabled: false, created_at: new Date(), updated_at: new Date() });
    await notify({ id: 'n1', title: 'Logro', body: 'Obtuviste un logro.', type: 'achievement_unlocked' });
    await notify({ id: 'n2', title: 'Recordatorio', body: 'Hoy.' });
    render(<NotificationHistory userId={U} onClose={vi.fn()} />);

    expect(await screen.findByTestId('notification-n2')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-n1')).toBeNull();
  });

  it('closes from the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NotificationHistory userId={U} onClose={onClose} />);
    await user.click(await screen.findByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
