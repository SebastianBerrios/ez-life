import type { PaletteEntry, PaletteKind } from './buildPaletteIndex';
import { normalizeText } from './searchText';

export interface PaletteGroup {
  kind: PaletteKind;
  label: string;
  entries: PaletteEntry[];
}

export interface SearchPaletteOptions {
  /** Cap per group for a non-empty query. Default 5. */
  perGroup?: number;
  /** Recent movements shown for an empty query. Default 5. */
  emptyMovements?: number;
}

/** Display order of the groups. */
export const PALETTE_GROUP_ORDER: ReadonlyArray<{ kind: PaletteKind; label: string }> = [
  { kind: 'action', label: 'Acciones' },
  { kind: 'route', label: 'Ir a' },
  { kind: 'movement', label: 'Movimientos' },
  { kind: 'task', label: 'Tareas' },
  { kind: 'habit', label: 'Hábitos' },
  { kind: 'goal', label: 'Metas' },
  { kind: 'savings-goal', label: 'Metas de ahorro' },
  { kind: 'account', label: 'Cuentas' },
];

const DEFAULT_PER_GROUP = 5;
const DEFAULT_EMPTY_MOVEMENTS = 5;

const isWordChar = (char: string | undefined): boolean => char !== undefined && /[a-z0-9]/.test(char);

/** 0 = the text starts with the term, 1 = a word of it does, 2 = it only contains it, -1 = no match. */
function scoreText(text: string, term: string): number {
  let best = -1;
  let from = 0;
  for (;;) {
    const at = text.indexOf(term, from);
    if (at === -1) return best;
    if (at === 0) return 0;
    if (!isWordChar(text[at - 1])) best = best === -1 ? 1 : Math.min(best, 1);
    else if (best === -1) best = 2;
    from = at + 1;
  }
}

/** Worst term wins (every term must match somewhere); the best haystack counts for each term. Title is haystack 0 when present. */
function rankEntry(entry: PaletteEntry, terms: string[]): number {
  let rank = 0;
  for (const term of terms) {
    let best = -1;
    for (const haystack of entry.haystacks) {
      const score = scoreText(haystack, term);
      if (score !== -1 && (best === -1 || score < best)) best = score;
      if (best === 0) break;
    }
    if (best === -1) return -1;
    rank = Math.max(rank, best);
  }
  return rank;
}

/**
 * Groups the palette index for a query. Empty query: every action and route plus the most recent
 * movements. Otherwise each group keeps entries whose haystacks contain every term (accent and case
 * insensitive), prefix and word-start matches first, then substring matches, original order on ties,
 * capped at `perGroup`. Empty groups are dropped.
 */
export function searchPalette(index: PaletteEntry[], query: string, options: SearchPaletteOptions = {}): PaletteGroup[] {
  const perGroup = options.perGroup ?? DEFAULT_PER_GROUP;
  const terms = normalizeText(query).split(' ').filter(Boolean);
  const groups: PaletteGroup[] = [];

  for (const { kind, label } of PALETTE_GROUP_ORDER) {
    const ofKind = index.filter(entry => entry.kind === kind);
    let entries: PaletteEntry[];
    if (terms.length === 0) {
      if (kind === 'action' || kind === 'route') entries = ofKind;
      else if (kind === 'movement') entries = ofKind.slice(0, options.emptyMovements ?? DEFAULT_EMPTY_MOVEMENTS);
      else entries = [];
    } else {
      entries = ofKind
        .map((entry, position) => ({ entry, position, rank: rankEntry(entry, terms) }))
        .filter(item => item.rank !== -1)
        .sort((a, b) => a.rank - b.rank || a.position - b.position)
        .slice(0, perGroup)
        .map(item => item.entry);
    }
    if (entries.length > 0) groups.push({ kind, label, entries });
  }
  return groups;
}

/** Flattened entries in display order (what ↑/↓ walks). */
export function flattenPalette(groups: PaletteGroup[]): PaletteEntry[] {
  return groups.flatMap(group => group.entries);
}
