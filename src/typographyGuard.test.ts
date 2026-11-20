import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Spec 013 SC-006 / FR-042:
 * No monospace typography (`font-mono`, `label-mono`, `JetBrains`) or styled
 * `uppercase` labels may remain anywhere in production source under `src/`.
 */
const FORBIDDEN_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'font-mono', regex: /\bfont-mono\b/g },
  { label: 'label-mono', regex: /\blabel-mono\b/g },
  { label: 'JetBrains', regex: /JetBrains/g },
  { label: 'uppercase', regex: /(?<![a-zA-Z0-9_-])uppercase(?![a-zA-Z0-9_-])/g },
];

function productionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    if (entry.name.includes('.test.')) return [];
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe('typography guard (spec 013 SC-006, T090)', () => {
  it('finds no font-mono, label-mono, JetBrains or styled uppercase labels in src/', () => {
    const hits: string[] = [];
    for (const file of productionFiles(join(process.cwd(), 'src'))) {
      const rel = file.slice(process.cwd().length + 1);
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        for (const { label, regex } of FORBIDDEN_PATTERNS) {
          regex.lastIndex = 0;
          if (regex.test(line)) {
            hits.push(`${rel}:${index + 1} -> ${label} (${line.trim()})`);
          }
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
