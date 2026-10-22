import { describe, it, expect } from 'vitest';
import { validateDistribution } from './validateDistribution';
it('requires unique rows, whole percentages summing 100, names and exactly one savings bucket', () => {
  const good = [{ id: 'a', name: 'Uno', percentage: 50, is_savings: false }, { id: 'b', name: 'Dos', percentage: 50, is_savings: true }];
  expect(() => validateDistribution(good)).not.toThrow();
  expect(() => validateDistribution([...good, good[0]])).toThrow();
  expect(() => validateDistribution(good.map(row => ({ ...row, is_savings: false })))).toThrow();
  expect(() => validateDistribution([{ ...good[0], percentage: 99, is_savings: true }])).toThrow();
});

describe('validateDistribution — 0% is only valid for the savings category', () => {
  const rows = (needs: number, savings: number) => [
    { id: 'a', name: 'Necesidades', percentage: needs, is_savings: false },
    { id: 'b', name: 'Ahorro', percentage: savings, is_savings: true },
  ];

  it('accepts a savings category at 0%', () => {
    expect(() => validateDistribution(rows(100, 0))).not.toThrow();
  });

  it('rejects a non-savings category at 0%', () => {
    expect(() => validateDistribution([
      { id: 'a', name: 'Necesidades', percentage: 0, is_savings: false },
      { id: 'b', name: 'Ahorro', percentage: 100, is_savings: true },
    ])).toThrow('Completa los nombres y porcentajes enteros (de 1 a 100; el ahorro puede ser 0).');
  });

  it('still rejects out of range, fractional and negative percentages', () => {
    expect(() => validateDistribution(rows(101, 0))).toThrow();
    expect(() => validateDistribution(rows(99.5, 0.5))).toThrow();
    expect(() => validateDistribution(rows(110, -10))).toThrow();
  });

  it('still requires the total to be exactly 100 and exactly one savings category', () => {
    expect(() => validateDistribution(rows(60, 0))).toThrow('La distribución debe sumar exactamente 100%.');
    expect(() => validateDistribution([
      { id: 'a', name: 'Uno', percentage: 50, is_savings: true },
      { id: 'b', name: 'Dos', percentage: 50, is_savings: true },
    ])).toThrow('Debe existir exactamente una categoría de ahorro.');
  });
});
