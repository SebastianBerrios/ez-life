import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useChartColors } from './useChartColors';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.documentElement.className = '';
});

describe('useChartColors', () => {
  it('falls back to hsl(var(--token)) where the stylesheet defines nothing, never to a hex literal', () => {
    const { result } = renderHook(() => useChartColors());
    expect(result.current.primary).toBe('hsl(var(--primary))');
    for (const color of Object.values(result.current)) expect(color).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('reads the HSL triplets of the theme tokens as full hsl() colors', async () => {
    document.documentElement.style.setProperty('--primary', '160.1 84.1% 39.4%');
    document.documentElement.style.setProperty('--expense', '349.7 89.2% 60.2%');
    const { result } = renderHook(() => useChartColors());
    await waitFor(() => expect(result.current.primary).toBe('hsl(160.1 84.1% 39.4%)'));
    expect(result.current.expense).toBe('hsl(349.7 89.2% 60.2%)');
  });

  it('re-reads when the theme class on <html> changes', async () => {
    document.documentElement.style.setProperty('--primary', '160.1 84.1% 39.4%');
    const { result } = renderHook(() => useChartColors());
    await waitFor(() => expect(result.current.primary).toBe('hsl(160.1 84.1% 39.4%)'));

    await act(async () => {
      document.documentElement.style.setProperty('--primary', '162.9 93.5% 24.3%');
      document.documentElement.classList.add('light');
    });
    await waitFor(() => expect(result.current.primary).toBe('hsl(162.9 93.5% 24.3%)'));
  });
});
