import { it, expect } from 'vitest';
import { defaultCategorySeeds } from './defaultCategorySeeds';
it('seeds every bucket including savings with stable identities', () => {
  const base = { user_id: 'A', is_default: true, created_at: new Date(), updated_at: new Date() };
  const buckets = [{ ...base, id: 'a', name: 'Uno', percentage: 80, is_savings: false }, { ...base, id: 'b', name: 'Dos', percentage: 20, is_savings: true }];
  const seeds = defaultCategorySeeds('A', buckets);
  expect(seeds).toHaveLength(4); expect(seeds.every(row => row.subcategories.length > 0)).toBe(true);
  expect(seeds.some(row => row.category.distribution_category_id === 'b')).toBe(true);
  expect(defaultCategorySeeds('A', buckets)).toEqual(seeds);
});
