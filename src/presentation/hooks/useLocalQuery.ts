import { useCallback, useEffect, useRef, useState } from 'react';
import { onLocalChanges } from '../../infrastructure/db/localChanges';
import { onSyncCompleted } from '../../infrastructure/sync/syncEvents';

interface Options<T> {
  /** Reads everything the screen needs. Must be memoized (`useCallback`): a new identity means "different query". */
  load: () => Promise<T>;
  /** Value served until the first load finishes. */
  initial: T;
  /** Dexie tables whose local commits (this tab or another) should trigger a silent reload. */
  tables: readonly string[];
}

export interface LocalQuery<T> {
  data: T;
  /** True until the first load of the current query settles; silent reloads never set it. */
  loading: boolean;
  /** Reloads silently (no skeleton flash). */
  reload: () => Promise<void>;
}

/**
 * Shared lifecycle of the data hooks that read from the local (Dexie) store: load on mount and
 * whenever `load` changes, then silently refresh when a sync cycle ends or a watched table changes.
 * Only the most recent request may write state, so a slow older read never overwrites a newer one.
 */
export function useLocalQuery<T>({ load, initial, tables }: Options<T>): LocalQuery<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await load();
      if (request === generation.current) setData(next);
    } catch (error) {
      console.error(error);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // Data arriving after the first render (another device, a sheet save, a habit check) must show up.
  useEffect(() => onSyncCompleted(() => { void reload(); }), [reload]);
  // `tables` is a stable module-level list at every call site, so it is safe in the dependency array.
  useEffect(() => onLocalChanges(tables, () => { void reload(); }), [reload, tables]);

  return { data, loading, reload };
}
