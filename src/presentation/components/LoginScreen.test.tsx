import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import LoginScreen from './LoginScreen';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';

// Mock Supabase client
vi.mock('../../infrastructure/supabase/client', () => {
  const signInWithOAuth = vi.fn();
  return {
    getSupabaseBrowserClient: vi.fn(() => ({
      auth: { signInWithOAuth },
    })),
  };
});

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    writable: true,
    value,
  });
}

describe('LoginScreen', () => {
  afterEach(() => {
    setNavigatorOnLine(true);
    vi.clearAllMocks();
  });

  it('should call signInWithOAuth with google provider when Google button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const googleButton = screen.getByRole('button', { name: /google/i });
    await user.click(googleButton);

    const supabase = getSupabaseBrowserClient();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google' });
  });

  it('should call signInWithOAuth with github provider when GitHub button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const githubButton = screen.getByRole('button', { name: /github/i });
    await user.click(githubButton);

    const supabase = getSupabaseBrowserClient();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'github' });
  });

  it('does not call signInWithOAuth and shows a message when offline', async () => {
    setNavigatorOnLine(false);
    const user = userEvent.setup();
    render(<LoginScreen />);

    const googleButton = screen.getByRole('button', { name: /google/i });
    await user.click(googleButton);

    const supabase = getSupabaseBrowserClient();
    expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(
      screen.getByText(/se requiere conexión a internet para iniciar sesión/i)
    ).toBeInTheDocument();
  });

  it('shows the provider error message when signInWithOAuth resolves with an error', async () => {
    setNavigatorOnLine(true);
    const user = userEvent.setup();
    const supabase = getSupabaseBrowserClient();
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
      data: { provider: 'google', url: null },
      error: { message: 'OAuth provider unavailable' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<LoginScreen />);

    const googleButton = screen.getByRole('button', { name: /google/i });
    await user.click(googleButton);

    expect(await screen.findByText('OAuth provider unavailable')).toBeInTheDocument();
  });
});
