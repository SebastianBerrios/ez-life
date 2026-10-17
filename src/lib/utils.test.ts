import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn (design-system aware merge)', () => {
  it('keeps a typography-scale class together with a text color, in either order', () => {
    expect(cn('text-label-mono-sm', 'text-success')).toBe('text-label-mono-sm text-success');
    expect(cn('text-foreground', 'text-headline-md')).toBe('text-foreground text-headline-md');
  });

  it('lets a later scale class override an earlier font size', () => {
    expect(cn('text-sm', 'text-headline-sm')).toBe('text-headline-sm');
  });

  it('still resolves real color conflicts', () => {
    expect(cn('text-muted-foreground', 'text-expense')).toBe('text-expense');
  });

  it('does not treat the custom shadows as shadow colors', () => {
    expect(cn('shadow-md', 'shadow-dialog')).toBe('shadow-dialog');
  });
});
