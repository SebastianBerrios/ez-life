import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MoreDrawer from './MoreDrawer';
import { LayoutDashboard, Settings } from 'lucide-react';

const overflowNavItems = [
  { id: 'analysis', label: 'Análisis', Icon: LayoutDashboard },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
];

describe('MoreDrawer', () => {
  it('renders as an overlay (not a page navigation) listing every overflow destination', () => {
    render(
      <MoreDrawer
        overflowNavItems={overflowNavItems}
        currentRoute="dashboard"
        onNavigate={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />
    );

    const drawer = screen.getByTestId('more-drawer');
    expect(drawer).toBeInTheDocument();
    expect(screen.getByTestId('more-drawer-item-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('more-drawer-item-settings')).toBeInTheDocument();
  });

  it('does not render anything when closed', () => {
    render(
      <MoreDrawer
        overflowNavItems={overflowNavItems}
        currentRoute="dashboard"
        onNavigate={vi.fn()}
        open={false}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('more-drawer')).not.toBeInTheDocument();
  });

  it('selecting a destination calls onNavigate with the right id and closes the drawer', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <MoreDrawer
        overflowNavItems={overflowNavItems}
        currentRoute="dashboard"
        onNavigate={onNavigate}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByTestId('more-drawer-item-settings'));

    expect(onNavigate).toHaveBeenCalledWith('settings');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
