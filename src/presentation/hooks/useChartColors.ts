import { useEffect, useState } from 'react';

export interface ChartColors {
  primary: string;
  expense: string;
  warning: string;
  muted: string;
  border: string;
  mutedForeground: string;
  card: string;
  foreground: string;
}

const VARS: Record<keyof ChartColors, string> = {
  primary: '--primary',
  expense: '--expense',
  warning: '--warning',
  muted: '--surface-3',
  border: '--border',
  mutedForeground: '--muted-foreground',
  card: '--card',
  foreground: '--foreground',
};

/** Fallbacks used where CSS variables cannot be read (SSR, jsdom without the stylesheet). */
const FALLBACK: ChartColors = Object.fromEntries(
  Object.entries(VARS).map(([key, name]) => [key, `hsl(var(${name}))`]),
) as unknown as ChartColors;

function read(): ChartColors {
  if (typeof document === 'undefined') return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const colors = { ...FALLBACK };
  for (const [key, name] of Object.entries(VARS) as [keyof ChartColors, string][]) {
    const value = style.getPropertyValue(name).trim();
    // Tokens are bare HSL triplets ("160.1 84.1% 39.4%"); charts (SVG attributes) need a full color.
    if (value) colors[key] = `hsl(${value})`;
  }
  return colors;
}

/**
 * Chart colors read from the theme's CSS variables (never hex literals), so recharts follows the
 * dark/light theme. Re-reads when the theme class on <html> changes.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    setColors(read());
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
