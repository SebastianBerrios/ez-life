import { it, expect } from 'vitest';
import { validateDistribution } from './validateDistribution';
it('requires unique rows, whole percentages summing 100, names and exactly one savings bucket', () => {
  const good = [{ id: 'a', name: 'Uno', percentage: 50, is_savings: false }, { id: 'b', name: 'Dos', percentage: 50, is_savings: true }];
  expect(() => validateDistribution(good)).not.toThrow();
  expect(() => validateDistribution([...good, good[0]])).toThrow();
  expect(() => validateDistribution(good.map(row => ({ ...row, is_savings: false })))).toThrow();
  expect(() => validateDistribution([{ ...good[0], percentage: 99, is_savings: true }])).toThrow();
});
