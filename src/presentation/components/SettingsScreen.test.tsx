import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsScreen from './SettingsScreen';
import { db } from '../../infrastructure/db/db';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../lib/downloadTextFile', () => ({ downloadTextFile: download }));

beforeEach(async () => {
  download.mockReset();
  await db.delete();
  await db.open();
});

describe('SettingsScreen — Exportar Datos', () => {
  it('exports the whole history as CSV through the shared download helper, with account names', async () => {
    const user = userEvent.setup();
    const account = await new LocalPaymentAccountRepository().save({ id: '', user_id: 'u', name: 'BCP Débito', kind: 'debit', opening_balance: 0 });
    const repo = new LocalMovementRepository();
    await repo.save({ id: '', user_id: 'u', type: 'INCOME', amount: 100000, date: new Date(2026, 8, 3, 9, 0), description: 'Ajuste de septiembre', is_adjustment: true, account_id: account.id, is_recurring: false });
    await repo.save({ id: '', user_id: 'u', type: 'INCOME', amount: 5000, date: new Date(2026, 9, 3, 9, 0), description: 'Ajuste de octubre', is_adjustment: true, account_id: account.id, is_recurring: false });
    render(<SettingsScreen userId="u" />);

    await user.click(await screen.findByRole('button', { name: 'CSV' }));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^ezlife_export_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(content.split('\n')[0]).toBe('Fecha;Hora;Tipo;Cuenta;Categoria;Monto;Descripcion');
    expect(content).toContain('Ajuste de septiembre');
    expect(content).toContain('Ajuste de octubre');
    expect(content).toContain('BCP Débito');
  });
});

describe('SettingsScreen — layout and preferences', () => {
  it('shows the profile panel only with real account data', async () => {
    const { rerender } = render(<SettingsScreen userId="u" />);
    await screen.findByRole('button', { name: 'CSV' });
    expect(screen.queryByRole('heading', { name: 'Perfil' })).toBeNull();

    rerender(<SettingsScreen userId="u" accountName="Usuario de prueba" accountEmail="prueba@example.test" />);
    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByText('Usuario de prueba')).toBeInTheDocument();
    expect(screen.getByText('prueba@example.test')).toBeInTheDocument();
  });

  it('groups every setting in its own labelled panel', async () => {
    render(<SettingsScreen userId="u" />);
    await screen.findByRole('button', { name: 'CSV' });
    for (const title of [
      'Cuentas de pago', 'Fuentes de ingreso', 'Categorías y Distribución', 'Apariencia', 'Mi progreso', 'Notificaciones', 'Exportar Datos', 'Cuenta',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('saves the in-app notification switch', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen userId="u" />);
    const inapp = await screen.findByRole('switch', { name: 'Notificaciones in-app' });
    expect(inapp).toHaveAttribute('aria-checked', 'true');

    await user.click(inapp);
    expect(inapp).toHaveAttribute('aria-checked', 'false');
    await waitFor(async () => expect((await db.profiles.get('u'))?.inapp_enabled).toBe(false));
  });

  it('turns gamification off and on from its switch, keeping what was saved', async () => {
    const user = userEvent.setup();
    await db.profiles.put({ id: 'u', gamification_enabled: true, created_at: new Date(), updated_at: new Date() });
    render(<SettingsScreen userId="u" />);
    const toggle = await screen.findByRole('switch', { name: 'Mostrar logros personales y celebraciones' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAccessibleDescription('Puedes ocultarlos cuando quieras. Tu historial se conserva.');

    await user.click(toggle);
    await waitFor(async () => expect((await db.profiles.get('u'))?.gamification_enabled).toBe(false));
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(async () => expect((await db.profiles.get('u'))?.gamification_enabled).toBe(true));
  });

  it('names the export files with the LOCAL calendar day, not the UTC one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 22:00 on Oct 16 in UTC-5 is already Oct 17 in UTC: the file must say the 16th.
    vi.setSystemTime(new Date(2026, 9, 16, 22, 0));
    try {
      const user = userEvent.setup({ advanceTimers: () => undefined });
      render(<SettingsScreen userId="u" />);
      await user.click(await screen.findByRole('button', { name: 'CSV' }));
      await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
      expect((download.mock.calls[0] as [string])[0]).toBe('ezlife_export_2026-10-16.csv');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SettingsScreen — account requested from ⌘K (focus)', () => {
  it('reveals the account row in "Cuentas de pago" and reports it handled', async () => {
    const account = await new LocalPaymentAccountRepository().save({ id: '', user_id: 'u', name: 'BCP Débito', kind: 'debit', opening_balance: 0 });
    const onFocusHandled = vi.fn();
    render(<SettingsScreen userId="u" focus={{ kind: 'account', id: account.id }} focusNonce={1} onFocusHandled={onFocusHandled} />);

    const row = await screen.findByTestId(`account-${account.id}`);
    await waitFor(() => expect(row).toHaveAttribute('data-reveal', 'true'));
    expect(row).toHaveFocus();
    expect(onFocusHandled).toHaveBeenCalledTimes(1);
  });
});
