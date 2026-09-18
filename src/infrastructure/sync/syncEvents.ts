// Minimal pub-sub so presentation components can react when CustomSyncLayer
// pulls new data into Dexie, without polling or a new dependency. Reads that
// only ran once on mount (Dashboard, lists) would otherwise never notice data
// that arrived later from another device.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onSyncCompleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSyncCompleted(): void {
  listeners.forEach(listener => listener());
}
