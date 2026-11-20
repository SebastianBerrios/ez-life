import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from './theme-provider';

function mockSystemDark(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('dark') ? matches : !matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

describe('ThemeProvider (T083)', () => {
  it('follows the OS light preference without writing theme to localStorage until setTheme is called', async () => {
    mockSystemDark(false);
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <p>app</p>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.classList.contains('light')).toBe(true));
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('follows the OS dark preference without writing theme to localStorage', async () => {
    mockSystemDark(true);
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <p>app</p>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('preserves an explicit stored theme preference', async () => {
    mockSystemDark(false);
    localStorage.setItem('theme', 'dark');
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <p>app</p>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
