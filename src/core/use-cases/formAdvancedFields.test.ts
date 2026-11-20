import { describe, it, expect } from 'vitest';
import {
  countActiveFields,
  formatMoreOptionsLabel,
  hasAdvancedFieldError,
} from './formAdvancedFields';

describe('formAdvancedFields', () => {
  it('counts active boolean flags', () => {
    expect(countActiveFields([])).toBe(0);
    expect(countActiveFields([false, false])).toBe(0);
    expect(countActiveFields([true, false, true])).toBe(2);
  });

  it('formats "Más opciones" label for 0, 1, and multiple active fields', () => {
    expect(formatMoreOptionsLabel(0)).toBe('Más opciones');
    expect(formatMoreOptionsLabel(-1)).toBe('Más opciones');
    expect(formatMoreOptionsLabel(1)).toBe('Más opciones · 1 activa');
    expect(formatMoreOptionsLabel(2)).toBe('Más opciones · 2 activas');
    expect(formatMoreOptionsLabel(5)).toBe('Más opciones · 5 activas');
  });

  it('detects whether any advanced field has an error', () => {
    expect(hasAdvancedFieldError([])).toBe(false);
    expect(hasAdvancedFieldError([false, false])).toBe(false);
    expect(hasAdvancedFieldError([false, true, false])).toBe(true);
  });
});
