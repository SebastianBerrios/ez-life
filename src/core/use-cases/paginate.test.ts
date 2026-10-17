import { describe, expect, it } from 'vitest';
import { pageNumbers, paginate } from './paginate';

const items = Array.from({ length: 45 }, (_, i) => i + 1);

describe('paginate', () => {
  it('returns the first page by default slice', () => {
    const result = paginate(items, 1, 20);
    expect(result.items).toHaveLength(20);
    expect(result.items[0]).toBe(1);
    expect(result).toMatchObject({ page: 1, pageCount: 3, total: 45, from: 1, to: 20 });
  });
  it('returns the short last page', () => {
    const result = paginate(items, 3, 20);
    expect(result.items).toEqual([41, 42, 43, 44, 45]);
    expect(result).toMatchObject({ page: 3, from: 41, to: 45 });
  });
  it('clamps out-of-range and invalid pages', () => {
    expect(paginate(items, 99, 20).page).toBe(3);
    expect(paginate(items, 0, 20).page).toBe(1);
    expect(paginate(items, Number.NaN, 20).page).toBe(1);
  });
  it('handles an empty list as one empty page', () => {
    expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
  });
  it('handles an exact multiple of the page size', () => {
    expect(paginate(items.slice(0, 40), 2, 20)).toMatchObject({ pageCount: 2, from: 21, to: 40 });
  });
  it('guards against a non-positive page size', () => {
    expect(paginate([1, 2, 3], 2, 0).items).toEqual([2]);
  });
});

describe('pageNumbers', () => {
  it('lists every page when there are 7 or fewer', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('collapses the middle with ellipses around the current page', () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, null, 20]);
    expect(pageNumbers(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageNumbers(20, 20)).toEqual([1, null, 19, 20]);
    expect(pageNumbers(3, 20)).toEqual([1, 2, 3, 4, null, 20]);
  });
});
