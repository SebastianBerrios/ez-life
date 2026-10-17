const key = 'ezlife.activeAccount.v1';
export interface LocalAccount { id: string; avatarUrl?: string; name?: string; email?: string }
function optionalText(value: object, field: string): string | undefined {
  const text = (value as Record<string, unknown>)[field];
  return typeof text === 'string' && text.trim() ? text : undefined;
}
export function getLocalAccount(): LocalAccount | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
      const name = optionalText(value, 'name');
      const email = optionalText(value, 'email');
      return {
        id: value.id,
        avatarUrl: 'avatarUrl' in value && typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      };
    }
  } catch { /* Corrupt optional selection is treated as logged out. */ }
  return null;
}
export function rememberLocalAccount(account: LocalAccount): void { localStorage.setItem(key, JSON.stringify(account)); }
export function forgetLocalAccount(): void { localStorage.removeItem(key); }
