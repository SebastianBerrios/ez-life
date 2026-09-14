import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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

describe('LoginScreen', () => {
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
});
