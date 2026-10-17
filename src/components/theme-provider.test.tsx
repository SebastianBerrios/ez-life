import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from './theme-provider';

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

describe('ThemeProvider', () => {
  it('treats a stored "system" theme as dark and rewrites it', async () => {
    localStorage.setItem('theme', 'system');
    render(<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}><p>app</p></ThemeProvider>);
    await waitFor(() => expect(localStorage.getItem('theme')).toBe('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('keeps an explicit light theme untouched', async () => {
    localStorage.setItem('theme', 'light');
    render(<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}><p>app</p></ThemeProvider>);
    await waitFor(() => expect(document.documentElement.classList.contains('light')).toBe(true));
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
