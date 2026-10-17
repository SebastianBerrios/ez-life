import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeText } from './searchText';

describe('normalizeText', () => {
  it('lower-cases, strips accents and collapses whitespace', () => {
    expect(normalizeText('  Alimentación   SÚPER ')).toBe('alimentacion super');
    expect(normalizeText('Ñandú')).toBe('nandu');
  });
  it('returns an empty string for blank input', () => {
    expect(normalizeText('   ')).toBe('');
  });
});

describe('matchesQuery', () => {
  const haystacks = ['Almuerzo ligero', 'Alimentación', undefined, '', 'BCP Débito'];

  it('matches everything for an empty or blank query', () => {
    expect(matchesQuery('', haystacks)).toBe(true);
    expect(matchesQuery('   ', [])).toBe(true);
  });
  it('ignores case and accents on both sides', () => {
    expect(matchesQuery('alimentacion', haystacks)).toBe(true);
    expect(matchesQuery('DEBITO', haystacks)).toBe(true);
    expect(matchesQuery('débito', ['DEBITO'])).toBe(true);
  });
  it('requires every term, each in any haystack', () => {
    expect(matchesQuery('almuerzo bcp', haystacks)).toBe(true);
    expect(matchesQuery('almuerzo visa', haystacks)).toBe(false);
  });
  it('matches amount text', () => {
    expect(matchesQuery('12.50', ['S/ 12.50'])).toBe(true);
    expect(matchesQuery('99', ['S/ 12.50'])).toBe(false);
  });
  it('does not match when there are no usable haystacks', () => {
    expect(matchesQuery('algo', [undefined, null, ''])).toBe(false);
  });
});
