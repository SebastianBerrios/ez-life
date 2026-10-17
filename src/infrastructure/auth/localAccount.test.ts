import { beforeEach, describe, expect, it } from 'vitest';
import { forgetLocalAccount, getLocalAccount, rememberLocalAccount } from './localAccount';

beforeEach(() => forgetLocalAccount());

describe('localAccount', () => {
  it('round-trips the optional display name and email', () => {
    rememberLocalAccount({ id: 'u1', avatarUrl: 'https://example.test/a.png', name: 'Ana Test', email: 'ana@example.test' });
    expect(getLocalAccount()).toEqual({ id: 'u1', avatarUrl: 'https://example.test/a.png', name: 'Ana Test', email: 'ana@example.test' });
  });

  it('omits name and email when they are absent or blank', () => {
    localStorage.setItem('ezlife.activeAccount.v1', JSON.stringify({ id: 'u2', name: '  ', email: 5 }));
    const account = getLocalAccount();
    expect(account).toEqual({ id: 'u2', avatarUrl: undefined });
    expect(account).not.toHaveProperty('name');
    expect(account).not.toHaveProperty('email');
  });

  it('returns null for corrupt storage', () => {
    localStorage.setItem('ezlife.activeAccount.v1', '{oops');
    expect(getLocalAccount()).toBeNull();
  });
});
