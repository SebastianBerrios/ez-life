import { getSupabaseBrowserClient } from './client';

/**
 * SC-003: near-instant shared-space updates when both members are online —
 * additive on top of the existing pull-based CustomSyncLayer (research.md
 * #1), never a replacement. If the channel never connects (offline, browser
 * blocks it), the app still works exactly as it does today via that
 * periodic pull (Principio XII).
 */
export function subscribeSharedSpaceChanges(spaceId: string, onChange: () => void): () => void {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase
    .channel(`shared-space-${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'ez_life', table: 'shared_movements', filter: `shared_space_id=eq.${spaceId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
