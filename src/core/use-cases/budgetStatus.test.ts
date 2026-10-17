import { describe, expect, it } from 'vitest';
import { budgetStatusFor } from './budgetStatus';

describe('budgetStatusFor', () => {
  it('is ok below 80%, warning from 80% up to 100% inclusive, over above 100%', () => {
    expect(budgetStatusFor(0)).toBe('ok');
    expect(budgetStatusFor(79.99)).toBe('ok');
    expect(budgetStatusFor(80)).toBe('warning');
    expect(budgetStatusFor(100)).toBe('warning');
    expect(budgetStatusFor(100.01)).toBe('over');
  });
});
