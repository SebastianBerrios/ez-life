import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Navigation, { navItems, primaryNavItems, overflowNavItems } from './BottomNav';

const ALL_ROUTE_IDS = [
  'dashboard',
  'movements',
  'analysis',
  'goals',
  'debts',
  'shared-space',
  'control',
  'create',
  'settings',
];

describe('BottomNav grouping (FR-001, FR-003)', () => {
  it('splits the 9 destinations into a primary group of at most 4, with the rest in overflow', () => {
    expect(navItems).toHaveLength(9);
    expect(primaryNavItems.length).toBeLessThanOrEqual(4);
    expect(primaryNavItems.length + overflowNavItems.length).toBe(9);
  });

  it('keeps every original route id reachable from primary or overflow, none lost, none duplicated', () => {
    const coveredIds = [...primaryNavItems, ...overflowNavItems].map((item) => item.id).sort();
    expect(coveredIds).toEqual([...ALL_ROUTE_IDS].sort());
  });
});

describe('BottomNav (rendered)', () => {
  it('renders at most 5 destination buttons in the mobile bar (4 fixed + "Más")', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} />);

    const mobileNav = screen.getByRole('navigation', { name: /navegación principal/i });
    const buttons = mobileNav.querySelectorAll('button');
    expect(buttons.length).toBeLessThanOrEqual(5);

    for (const item of primaryNavItems) {
      expect(mobileNav.querySelector(`[data-route-id="${item.id}"]`)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: /más/i })).toBeInTheDocument();
  });

  it('calls onOpenMore, not onNavigate, when "Más" is tapped', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onOpenMore = vi.fn();
    render(<Navigation currentRoute="dashboard" onNavigate={onNavigate} onOpenMore={onOpenMore} />);

    await user.click(screen.getByRole('button', { name: /más/i }));

    expect(onOpenMore).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('keeps the desktop sidebar showing all 9 destinations unchanged (FR-004)', () => {
    render(<Navigation currentRoute="dashboard" onNavigate={vi.fn()} />);

    const sidebar = screen.getByRole('complementary', { name: /barra lateral/i });
    for (const id of ALL_ROUTE_IDS) {
      expect(sidebar.querySelector(`[data-route-id="${id}"]`)).toBeTruthy();
    }
  });
});
