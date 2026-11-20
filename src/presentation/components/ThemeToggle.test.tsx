import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

const themeMock = vi.hoisted(() => ({
  theme: 'system' as string | undefined,
  resolvedTheme: 'light' as string | undefined,
  setTheme: vi.fn(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => themeMock,
}));

describe('ThemeToggle (T084)', () => {
  beforeEach(() => {
    themeMock.theme = 'system';
    themeMock.resolvedTheme = 'light';
    themeMock.setTheme.mockReset();
  });

  it('renders Claro, Oscuro and Sistema options with active radio checked and invokes setTheme', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const claro = screen.getByRole('radio', { name: 'Claro' });
    const oscuro = screen.getByRole('radio', { name: 'Oscuro' });
    const sistema = screen.getByRole('radio', { name: 'Sistema' });

    expect(sistema).toHaveAttribute('aria-checked', 'true');
    expect(claro).toHaveAttribute('aria-checked', 'false');
    expect(oscuro).toHaveAttribute('aria-checked', 'false');

    await user.click(claro);
    expect(themeMock.setTheme).toHaveBeenCalledWith('light');

    await user.click(oscuro);
    expect(themeMock.setTheme).toHaveBeenCalledWith('dark');

    await user.click(sistema);
    expect(themeMock.setTheme).toHaveBeenCalledWith('system');
  });
});
