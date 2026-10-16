import Dexie from 'dexie';
/** Dexie emits only after a committed transaction, including other tabs. */
export function onLocalChanges(tables: readonly string[], callback: () => void): () => void {
  const listener = (parts: Record<string, unknown>) => {
    if (Object.keys(parts).some(key => tables.some(table => key.includes(`/ezlife-db/${table}/`)))) callback();
  };
  Dexie.on('storagemutated', listener);
  return () => Dexie.on('storagemutated').unsubscribe(listener);
}
