import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MobileRouteLinks from './MobileRouteLinks';

describe('MobileRouteLinks', () => {
  it('offers Espacio compartido and Mi progreso and navigates to their routes', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<MobileRouteLinks onNavigate={onNavigate} showProgress />);

    await user.click(screen.getByRole('button', { name: 'Espacio compartido' }));
    await user.click(screen.getByRole('button', { name: 'Mi progreso' }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'shared-space');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'progress');
  });

  it('hides Mi progreso when personal progress is not visible', () => {
    render(<MobileRouteLinks onNavigate={vi.fn()} showProgress={false} />);

    expect(screen.getByRole('button', { name: 'Espacio compartido' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mi progreso' })).toBeNull();
  });

  it('is only visible on mobile', () => {
    render(<MobileRouteLinks onNavigate={vi.fn()} showProgress />);
    expect(screen.getByTestId('mobile-route-links')).toHaveClass('md:hidden');
  });
});
