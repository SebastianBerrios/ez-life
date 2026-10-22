let last = 0;

/**
 * Creation timestamp that is strictly greater than the previous one handed out in this session, so rows
 * created in the same millisecond (seeds, quick successive adds) keep their creation order when sorted.
 */
export function nextCreatedAt(): Date {
  last = Math.max(Date.now(), last + 1);
  return new Date(last);
}
