/**
 * Oldest first, ties broken by id, so anything created later always lands at the end of a list.
 * Tolerates `created_at` as Date, ISO string or number (rows pulled by sync). Returns a copy.
 */
export function sortByCreation<T extends { id: string; created_at: Date | string | number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id));
}
