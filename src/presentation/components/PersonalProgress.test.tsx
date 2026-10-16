import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../infrastructure/db/db';
import PersonalProgress from './PersonalProgress';
import SettingsScreen from './SettingsScreen';
import { emitSyncCompleted } from '../../infrastructure/sync/syncEvents';

beforeEach(async () => { await db.delete(); await db.open(); const now = new Date(); await db.profiles.put({ id: 'u', created_at: now, updated_at: now }); });
describe('personal progress UI', () => {
  it('shows six achievements and updates after synced corrections', async () => {
    render(<PersonalProgress userId="u" />);
    expect(await screen.findAllByText('Pendiente')).toHaveLength(6);
    const now = new Date();
    await db.tasks.bulkPut(Array.from({ length: 10 }, (_, i) => ({ id: String(i), user_id: 'u', title: 'Tarea', due_date: now, status: 'done', created_at: now, updated_at: now })));
    emitSyncCompleted();
    expect(await screen.findByText('Obtenido')).toBeInTheDocument();
    await db.tasks.clear(); emitSyncCompleted();
    await waitFor(() => expect(screen.getAllByText('Pendiente')).toHaveLength(6));
  });
  it('persists visibility from settings and hides compact progress', async () => {
    const user = userEvent.setup();
    const settings = render(<SettingsScreen userId="u" />);
    const toggle = await screen.findByLabelText('Mostrar logros personales y celebraciones');
    await user.click(toggle);
    await waitFor(async () => expect((await db.profiles.get('u'))?.gamification_enabled).toBe(false));
    settings.unmount();
    const compact = render(<PersonalProgress userId="u" compact />);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Mi progreso/ })).not.toBeInTheDocument());
    compact.unmount(); render(<PersonalProgress userId="u" />);
    expect(await screen.findByText(/Tu progreso está oculto/)).toBeInTheDocument();
  });
});
