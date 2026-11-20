import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Navigation from './BottomNav';

vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Tema</button> }));

describe('BottomNav tour anchors and responsive breakpoint', () => {
  it('places data-tour="add" on both "+" buttons and data-tour="settings" on both Ajustes nav buttons with mutually exclusive lg wrappers', () => {
    const { container } = render(
      <Navigation currentRoute="dashboard" onNavigate={vi.fn()} onNewMovement={vi.fn()} />,
    );

    const addAnchors = Array.from(container.querySelectorAll<HTMLElement>('[data-tour="add"]'));
    const settingsAnchors = Array.from(container.querySelectorAll<HTMLElement>('[data-tour="settings"]'));

    expect(addAnchors).toHaveLength(2);
    expect(settingsAnchors).toHaveLength(2);

    // One mobile/tablet-portrait (lg:hidden) and one desktop/tablet-landscape (hidden lg:flex)
    expect(addAnchors[0].closest('nav')).toHaveClass('lg:hidden');
    expect(addAnchors[1].closest('aside')).toHaveClass('hidden', 'lg:flex');

    expect(settingsAnchors[0].closest('nav')).toHaveClass('lg:hidden');
    expect(settingsAnchors[1].closest('aside')).toHaveClass('hidden', 'lg:flex');
  });

  it('uses sentence-case labels and pill primary CTA "Nuevo registro"', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} onNewMovement={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Nuevo registro' })).toHaveClass('rounded-full');
    expect(screen.getByRole('button', { name: 'Control y hábitos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Espacio compartido' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mi progreso' })).toBeInTheDocument();
  });
});
