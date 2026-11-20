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

describe('SettingsScreen — 5 collapsible sections and top quick access (spec 014)', () => {
  it('shows Completar configuración and Ver tutorial visible at the top above 5 collapsed sections', async () => {
    const user = userEvent.setup();
    const onCompleteSetup = vi.fn();
    const onReplayTour = vi.fn();
    render(
      <SettingsScreen
        userId="u"
        onCompleteSetup={onCompleteSetup}
        onReplayTour={onReplayTour}
      />,
    );

    const setupBtn = await screen.findByRole('button', { name: 'Completar configuración' });
    const tourBtn = screen.getByRole('button', { name: 'Ver tutorial' });
    await user.click(setupBtn);
    await user.click(tourBtn);
    expect(onCompleteSetup).toHaveBeenCalledTimes(1);
    expect(onReplayTour).toHaveBeenCalledTimes(1);

    for (const title of ['Perfil', 'Cuentas e ingresos', 'Notificaciones', 'Apariencia', 'Datos y exportación']) {
      const trigger = screen.getByRole('button', { name: new RegExp(title, 'i') });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('allows keeping multiple sections open simultaneously', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen userId="u" accountName="Ana Pérez" accountEmail="ana@example.test" />);

    const profileTrigger = screen.getByRole('button', { name: /Perfil/i });
    const appearanceTrigger = screen.getByRole('button', { name: /Apariencia/i });

    await user.click(profileTrigger);
    await user.click(appearanceTrigger);

    expect(profileTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(appearanceTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Cambiar tema visual')).toBeInTheDocument();
  });

  it('exports the whole history as CSV from Datos y exportación', async () => {
    const user = userEvent.setup();
    const account = await new LocalPaymentAccountRepository().save({ id: '', user_id: 'u', name: 'BCP Débito', kind: 'debit', opening_balance: 0 });
    const repo = new LocalMovementRepository();
    await repo.save({ id: '', user_id: 'u', type: 'INCOME', amount: 100000, date: new Date(2026, 8, 3, 9, 0), description: 'Ajuste de septiembre', is_adjustment: true, account_id: account.id, is_recurring: false });
    await repo.save({ id: '', user_id: 'u', type: 'INCOME', amount: 5000, date: new Date(2026, 9, 3, 9, 0), description: 'Ajuste de octubre', is_adjustment: true, account_id: account.id, is_recurring: false });
    render(<SettingsScreen userId="u" />);

    await user.click(screen.getByRole('button', { name: /Datos y exportación/i }));
    await user.click(await screen.findByRole('button', { name: 'CSV' }));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [filename, content] = download.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^ezlife_export_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(content).toContain('Ajuste de septiembre');
    expect(content).toContain('BCP Débito');
  });

  it('saves the in-app notification switch inside Notificaciones', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen userId="u" />);
    await user.click(screen.getByRole('button', { name: /Notificaciones/i }));
    const inapp = await screen.findByRole('switch', { name: 'Notificaciones in-app' });
    expect(inapp).toHaveAttribute('aria-checked', 'true');

    await user.click(inapp);
    expect(inapp).toHaveAttribute('aria-checked', 'false');
    await waitFor(async () => expect((await db.profiles.get('u'))?.inapp_enabled).toBe(false));
  });

  it('turns gamification off and on inside Apariencia', async () => {
    const user = userEvent.setup();
    await db.profiles.put({ id: 'u', gamification_enabled: true, created_at: new Date(), updated_at: new Date() });
    render(<SettingsScreen userId="u" />);
    await user.click(screen.getByRole('button', { name: /Apariencia/i }));
    const toggle = await screen.findByRole('switch', { name: 'Mostrar logros personales y celebraciones' });
    await waitFor(() => expect(toggle).toBeEnabled());

    await user.click(toggle);
    await waitFor(async () => expect((await db.profiles.get('u'))?.gamification_enabled).toBe(false));
    await user.click(toggle);
    await waitFor(async () => expect((await db.profiles.get('u'))?.gamification_enabled).toBe(true));
  });

  it('auto-opens Cuentas e ingresos when focus arrives from ⌘K and reveals the account', async () => {
    const account = await new LocalPaymentAccountRepository().save({ id: '', user_id: 'u', name: 'BCP Débito', kind: 'debit', opening_balance: 0 });
    const onFocusHandled = vi.fn();
    render(<SettingsScreen userId="u" focus={{ kind: 'account', id: account.id }} focusNonce={1} onFocusHandled={onFocusHandled} />);

    expect(screen.getByRole('button', { name: /Cuentas e ingresos/i })).toHaveAttribute('aria-expanded', 'true');
    const row = await screen.findByTestId(`account-${account.id}`);
    await waitFor(() => expect(row).toHaveAttribute('data-reveal', 'true'));
    expect(row).toHaveFocus();
    expect(onFocusHandled).toHaveBeenCalledTimes(1);
  });

  it('auto-opens Cuentas e ingresos when editAccountId is provided', async () => {
    const card = await new LocalPaymentAccountRepository().save({
      id: '',
      user_id: 'u',
      name: 'Visa',
      kind: 'credit',
      opening_balance: 0,
      credit_limit: 500000,
    });
    render(<SettingsScreen userId="u" editAccountId={card.id} editAccountNonce={1} />);

    expect(screen.getByRole('button', { name: /Cuentas e ingresos/i })).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
