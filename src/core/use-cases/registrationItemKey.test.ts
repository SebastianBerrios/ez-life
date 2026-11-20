import { describe, it, expect } from 'vitest';
import { parseItemKey, registrationItemKey } from './registrationItemKey';
import { DomainError } from '../domain/errors/DomainError';

describe('registrationItemKey', () => {
  it('builds and parses every supported registration kind round-trip', () => {
    const kinds = ['income', 'recurrence', 'installment', 'card'] as const;
    for (const kind of kinds) {
      const key = registrationItemKey(kind, 'ref-123', '2026-11');
      expect(key).toBe(`${kind}:ref-123:2026-11`);
      expect(parseItemKey(key)).toEqual({ kind, refId: 'ref-123', month: '2026-11' });
    }
  });

  it('rejects refIds that contain colons or are empty', () => {
    expect(() => registrationItemKey('income', 'a:b', '2026-11')).toThrow(DomainError);
    expect(() => registrationItemKey('income', '  ', '2026-11')).toThrow(DomainError);
  });

  it('rejects invalid kinds and malformed months', () => {
    expect(() => registrationItemKey('other' as never, 'ref-1', '2026-11')).toThrow(DomainError);
    expect(() => registrationItemKey('card', 'ref-1', '2026-13')).toThrow(DomainError);
    expect(() => registrationItemKey('card', 'ref-1', '2026-00')).toThrow(DomainError);
    expect(() => registrationItemKey('card', 'ref-1', '26-11')).toThrow(DomainError);
  });

  it('rejects malformed keys in parseItemKey', () => {
    expect(() => parseItemKey('bad:key')).toThrow(DomainError);
    expect(() => parseItemKey('other:ref:2026-11')).toThrow(DomainError);
    expect(() => parseItemKey('card:a:b:2026-11')).toThrow(DomainError);
    expect(() => parseItemKey('card::2026-11')).toThrow(DomainError);
    expect(() => parseItemKey('card:ref:2026-99')).toThrow(DomainError);
  });
});
