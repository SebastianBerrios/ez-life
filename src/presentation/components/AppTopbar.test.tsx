import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AppTopbar from './AppTopbar';
import MobileHeader from './MobileHeader';

const refDate = new Date(2026, 9, 1);

function renderTopbar(overrides: Partial<React.ComponentProps<typeof AppTopbar>> = {}) {
  const props = { currentRoute: 'dashboard', refDate, onShiftMonth: vi.fn(), onOpenNotifications: vi.fn(), ...overrides };
  render(<AppTopbar {...props} />);
  return { ...props, bar: screen.getByRole('banner', { name: 'Barra superior' }) };
}

describe('AppTopbar', () => {
  it('shows the breadcrumb and the capitalized month label', () => {
    const { bar } = renderTopbar({ currentRoute: 'finances' });
    expect(within(bar).getByText('Inicio')).toBeInTheDocument();
    expect(within(bar).getByText('Finanzas')).toBeInTheDocument();
    expect(within(bar).getByText('Octubre 2026')).toBeInTheDocument();
  });

  it('moves the month with the chevrons', async () => {
    const user = userEvent.setup();
    const { bar, onShiftMonth } = renderTopbar();

    await user.click(within(bar).getByRole('button', { name: 'Mes anterior' }));
    await user.click(within(bar).getByRole('button', { name: 'Mes siguiente' }));

    expect(onShiftMonth).toHaveBeenNthCalledWith(1, -1);
    expect(onShiftMonth).toHaveBeenNthCalledWith(2, 1);
  });

  it.each(['control', 'shared-space', 'progress', 'settings'])('hides the month selector on %s', (route) => {
    const { bar } = renderTopbar({ currentRoute: route });
    expect(within(bar).queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(within(bar).queryByText('Octubre 2026')).toBeNull();
  });

  it('opens notifications and shows no dot without unread ones', async () => {
    const user = userEvent.setup();
    const { bar, onOpenNotifications } = renderTopbar();
    expect(within(bar).queryByTestId('unread-dot')).toBeNull();
    await user.click(within(bar).getByRole('button', { name: 'Ver notificaciones' }));
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('shows the unread dot when requested', () => {
    const { bar } = renderTopbar({ hasUnreadNotifications: true });
    expect(within(bar).getByTestId('unread-dot')).toBeInTheDocument();
  });
});

describe('MobileHeader', () => {
  it('shows the month selector on dashboard/finances only', () => {
    const { rerender } = render(<MobileHeader currentRoute="dashboard" refDate={refDate} onShiftMonth={vi.fn()} />);
    expect(screen.getByText('Octubre 2026')).toBeInTheDocument();
    rerender(<MobileHeader currentRoute="settings" refDate={refDate} onShiftMonth={vi.fn()} />);
    expect(screen.queryByText('Octubre 2026')).toBeNull();
  });

  it('moves the month and opens notifications', async () => {
    const user = userEvent.setup();
    const onShiftMonth = vi.fn();
    const onOpenNotifications = vi.fn();
    render(<MobileHeader currentRoute="finances" refDate={refDate} onShiftMonth={onShiftMonth} onOpenNotifications={onOpenNotifications} />);

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Ver notificaciones' }));

    expect(onShiftMonth).toHaveBeenCalledWith(1);
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });
});

describe('Search entry point (⌘K)', () => {
  it('desktop: a "Buscar…" field with the shortcut hint opens the palette', async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    const { bar } = renderTopbar({ onOpenSearch });
    const search = within(bar).getByRole('button', { name: /^Buscar/ });
    expect(search).toHaveTextContent('Buscar…');
    expect(search).toHaveTextContent(/Ctrl K|⌘ K/);
    expect(search).toHaveAttribute('aria-haspopup', 'dialog');
    expect(search).toHaveAttribute('aria-keyshortcuts');
    await user.click(search);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('desktop: no search field when the shell gives no handler', () => {
    const { bar } = renderTopbar();
    expect(within(bar).queryByRole('button', { name: /^Buscar/ })).toBeNull();
  });

  it('mobile: an icon-only "Buscar" button without the keyboard hint', async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    render(<MobileHeader currentRoute="dashboard" refDate={refDate} onShiftMonth={vi.fn()} onOpenSearch={onOpenSearch} />);
    const search = screen.getByRole('button', { name: 'Buscar' });
    expect(search).not.toHaveTextContent(/Ctrl|⌘/);
    await user.click(search);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});
