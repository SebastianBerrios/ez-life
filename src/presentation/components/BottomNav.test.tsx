import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Navigation, { navItems, primaryNavItems } from './BottomNav';

const ALL_ROUTE_IDS = ['dashboard', 'finances', 'control', 'shared-space', 'progress', 'settings'];

describe('navigation items', () => {
  it('declares the six destinations with desktop labels and shorter mobile labels', () => {
    expect(navItems.map((item) => item.id)).toEqual(ALL_ROUTE_IDS);
    expect(navItems.map((item) => item.label)).toEqual([
      'Resumen', 'Finanzas', 'Control & Hábitos', 'Espacio Compartido', 'Mi Progreso', 'Ajustes',
    ]);
    expect(primaryNavItems.map((item) => item.id)).toEqual(['dashboard', 'finances', 'control', 'settings']);
    expect(primaryNavItems.map((item) => item.mobileLabel ?? item.label)).toEqual(['Inicio', 'Finanzas', 'Hábitos', 'Ajustes']);
  });

  it('no longer exposes the removed routes', () => {
    const ids = navItems.map((item) => item.id);
    for (const removed of ['movements', 'analysis', 'goals', 'debts', 'create']) {
      expect(ids).not.toContain(removed);
    }
  });
});

describe('mobile bottom nav', () => {
  it('has 5 slots: four routes around the central "+" button', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} onNewMovement={vi.fn()} />);

    const mobileNav = screen.getByRole('navigation', { name: /navegación principal/i });
    const buttons = Array.from(mobileNav.querySelectorAll('button'));
    expect(buttons).toHaveLength(5);
    expect(buttons.map((b) => b.getAttribute('data-route-id') ?? 'plus')).toEqual(['dashboard', 'finances', 'plus', 'control', 'settings']);
    expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Inicio', 'Finanzas', 'Registrar nuevo movimiento', 'Hábitos', 'Ajustes',
    ]);
  });

  it('opens the movement form from the central "+" without navigating', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onNewMovement = vi.fn();
    render(<Navigation currentRoute="dashboard" onNavigate={onNavigate} onNewMovement={onNewMovement} />);

    await user.click(screen.getByRole('button', { name: 'Registrar nuevo movimiento' }));

    expect(onNewMovement).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('pads the bar with the bottom safe-area inset so it clears the home indicator', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: /navegación principal/i }).className).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('marks the active route with aria-current and navigates on tap', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Navigation currentRoute="finances" onNavigate={onNavigate} />);

    const mobileNav = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(mobileNav.querySelector('[data-route-id="finances"]')).toHaveAttribute('aria-current', 'page');
    expect(mobileNav.querySelector('[data-route-id="dashboard"]')).not.toHaveAttribute('aria-current');

    await user.click(within(mobileNav).getByRole('button', { name: 'Hábitos' }));
    expect(onNavigate).toHaveBeenCalledWith('control');
  });
});

describe('desktop sidebar', () => {
  it('opens the same "Nuevo Registro" entry point from the sidebar button', async () => {
    const user = userEvent.setup();
    const onNewMovement = vi.fn();
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} onNewMovement={onNewMovement} />);

    const sidebar = screen.getByRole('complementary', { name: /barra lateral/i });
    await user.click(within(sidebar).getByRole('button', { name: 'Nuevo Registro' }));

    expect(onNewMovement).toHaveBeenCalledTimes(1);
  });

  it('shows the six destinations with desktop labels and data-route-ids', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} />);

    const sidebar = screen.getByRole('complementary', { name: /barra lateral/i });
    for (const id of ALL_ROUTE_IDS) {
      expect(sidebar.querySelector(`[data-route-id="${id}"]`)).toBeTruthy();
    }
    const sections = within(sidebar).getByRole('navigation', { name: /secciones/i });
    expect(Array.from(sections.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Resumen', 'Finanzas', 'Control & Hábitos', 'Espacio Compartido', 'Mi Progreso', 'Ajustes',
    ]);
    expect(sections.querySelector('[data-route-id="dashboard"]')).toHaveAttribute('aria-current', 'page');
  });

  it('hides Mi Progreso when gamification is disabled', () => {
    render(<Navigation currentRoute="dashboard" gamificationEnabled={false} onNavigate={vi.fn()} />);

    const sidebar = screen.getByRole('complementary', { name: /barra lateral/i });
    expect(sidebar.querySelector('[data-route-id="progress"]')).toBeNull();
    expect(within(sidebar).queryByRole('button', { name: 'Mi Progreso' })).toBeNull();
    expect(within(sidebar).getByRole('navigation', { name: /secciones/i }).querySelectorAll('button')).toHaveLength(5);
  });

  it('has a "Nuevo Registro" action, without a command-palette hint yet', async () => {
    const user = userEvent.setup();
    const onNewMovement = vi.fn();
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} onNewMovement={onNewMovement} />);

    const sidebar = screen.getByRole('complementary', { name: /barra lateral/i });
    const button = within(sidebar).getByRole('button', { name: 'Nuevo Registro' });
    expect(sidebar.querySelector('kbd')).toBeNull();
    await user.click(button);
    expect(onNewMovement).toHaveBeenCalledTimes(1);
  });

  it('shows the real account name and email, and nothing invented when absent', () => {
    const { rerender } = render(
      <Navigation currentRoute="dashboard" onNavigate={vi.fn()} accountName="Ana Prueba" accountEmail="ana@example.test" />
    );
    const sidebar = screen.getByRole('complementary', { name: /barra lateral/i });
    expect(within(sidebar).getByText('Ana Prueba')).toBeInTheDocument();
    expect(within(sidebar).getByText('ana@example.test')).toBeInTheDocument();

    rerender(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} accountEmail="solo@example.test" />);
    expect(within(sidebar).getByText('solo@example.test')).toBeInTheDocument();

    rerender(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} />);
    expect(within(sidebar).queryByText(/example\.test/)).toBeNull();
    expect(sidebar.textContent).not.toMatch(/PRO|Carlos/);
  });

  it('uses the profile photo when there is an avatarUrl', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} avatarUrl="https://example.test/a.png" />);
    expect(screen.getByRole('img', { name: 'Foto de perfil' })).toHaveAttribute('src', 'https://example.test/a.png');
  });

  it('exposes the online state through the status dot', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'En línea' })).toBeInTheDocument();
  });
});
