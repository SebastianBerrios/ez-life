/** Deterministic operation identity for recurrence retries across devices. */
export function stableId(key: string): string {
  const words = [2166136261, 3339675911, 4098947251, 2246822519].map(seed => {
    let hash = seed;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  });
  const hex = words.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
