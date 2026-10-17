/**
 * Lower-cases and strips diacritics so "Alimentación" matches "alimentacion".
 * Whitespace is collapsed and trimmed. Pure and locale-independent (NFD + combining-mark removal).
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Accent/case-insensitive "contains" search. Every whitespace-separated term of `query` must appear
 * in at least one haystack (AND across terms, OR across haystacks). An empty query matches everything.
 * Undefined/empty haystacks are ignored.
 */
export function matchesQuery(query: string, haystacks: ReadonlyArray<string | undefined | null>): boolean {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const normalized = haystacks.filter((h): h is string => Boolean(h)).map(normalizeText);
  return terms.every(term => normalized.some(h => h.includes(term)));
}
