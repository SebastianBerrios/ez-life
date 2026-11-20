import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Rgb = [number, number, number];

function parseThemeBlock(css: string, selector: ':root' | '.dark'): Record<string, string> {
  const escaped = selector === ':root' ? ':root' : '\\.dark';
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  if (!match) throw new Error(`Missing CSS block for ${selector}`);
  const vars: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/--([a-z0-9-]+)\s*:\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%/i);
    if (m) vars[m[1]] = `${m[2]} ${m[3]}% ${m[4]}%`;
  }
  return vars;
}

function hslToRgb(triplet: string): Rgb {
  const match = triplet.match(/([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%/);
  if (!match) throw new Error(`Invalid HSL triplet: ${triplet}`);
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fgTriplet: string, bgTriplet: string): number {
  const l1 = relativeLuminance(hslToRgb(fgTriplet));
  const l2 = relativeLuminance(hslToRgb(bgTriplet));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const PAIRS: Array<{ name: string; fg: string; bg: string; minRatio: number }> = [
  { name: 'foreground / background', fg: 'foreground', bg: 'background', minRatio: 4.5 },
  { name: 'card-foreground / card', fg: 'card-foreground', bg: 'card', minRatio: 4.5 },
  { name: 'primary-foreground / primary', fg: 'primary-foreground', bg: 'primary', minRatio: 4.5 },
  { name: 'muted-foreground / background', fg: 'muted-foreground', bg: 'background', minRatio: 4.5 },
  { name: 'muted-foreground / card', fg: 'muted-foreground', bg: 'card', minRatio: 4.5 },
  { name: 'pill-needs-foreground / pill-needs', fg: 'pill-needs-foreground', bg: 'pill-needs', minRatio: 4.5 },
  { name: 'pill-wants-foreground / pill-wants', fg: 'pill-wants-foreground', bg: 'pill-wants', minRatio: 4.5 },
  { name: 'pill-savings-foreground / pill-savings', fg: 'pill-savings-foreground', bg: 'pill-savings', minRatio: 4.5 },
  { name: 'destructive-foreground / destructive', fg: 'destructive-foreground', bg: 'destructive', minRatio: 4.5 },
];

describe('Design tokens WCAG AA contrast (SC-007, T092)', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

  it.each([':root', '.dark'] as const)('passes WCAG AA (>= 4.5:1) for all semantic token pairs in %s', selector => {
    const vars = parseThemeBlock(css, selector);
    for (const pair of PAIRS) {
      expect(vars[pair.fg], `${selector} missing --${pair.fg}`).toBeDefined();
      expect(vars[pair.bg], `${selector} missing --${pair.bg}`).toBeDefined();
      const ratio = contrastRatio(vars[pair.fg], vars[pair.bg]);
      expect(ratio, `${selector} ${pair.name} ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(pair.minRatio);
    }
  });
});
