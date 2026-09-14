import { describe, it, expect } from 'vitest';
import { getSupabaseBrowserClient } from './client';

describe('Supabase Client', () => {
  it('should instantiate the browser client', () => {
    const client = getSupabaseBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
