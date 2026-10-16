const key = 'ezlife.activeAccount.v1';
export interface LocalAccount { id: string; avatarUrl?: string }
export function getLocalAccount(): LocalAccount | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
      return { id: value.id, avatarUrl: 'avatarUrl' in value && typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined };
    }
  } catch { /* Corrupt optional selection is treated as logged out. */ }
  return null;
}
export function rememberLocalAccount(account: LocalAccount): void { localStorage.setItem(key, JSON.stringify(account)); }
export function forgetLocalAccount(): void { localStorage.removeItem(key); }
