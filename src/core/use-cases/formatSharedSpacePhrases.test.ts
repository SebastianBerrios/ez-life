import { describe, it, expect } from 'vitest';
import {
  buildSharedSpaceSummary,
  formatSharedMovementSplit,
} from './formatSharedSpacePhrases';

describe('buildSharedSpaceSummary', () => {
  it('returns settled state when balances are empty', () => {
    expect(buildSharedSpaceSummary([], 'me')).toEqual({
      netCents: 0,
      tone: 'settled',
      heroPhrase: 'Están al día',
      pairPhrases: [],
    });
  });

  it('builds positive, negative, and neutral third-party pair phrases with net balance', () => {
    const summary = buildSharedSpaceSummary(
      [
        { fromUserId: 'ana', toUserId: 'me', amount: 4000 },
        { fromUserId: 'me', toUserId: 'luis', amount: 1550 },
        { fromUserId: 'ana', toUserId: 'luis', amount: 2000 },
      ],
      'me',
      { ana: 'Ana', luis: 'Luis' },
    );

    expect(summary.netCents).toBe(2450);
    expect(summary.tone).toBe('positive');
    expect(summary.heroPhrase).toBe('Te deben S/ 24.50');
    expect(summary.pairPhrases).toEqual([
      {
        fromUserId: 'ana',
        toUserId: 'me',
        amountCents: 4000,
        tone: 'positive',
        phrase: 'Ana te debe S/ 40.00',
      },
      {
        fromUserId: 'me',
        toUserId: 'luis',
        amountCents: 1550,
        tone: 'negative',
        phrase: 'Le debes S/ 15.50 a Luis',
      },
      {
        fromUserId: 'ana',
        toUserId: 'luis',
        amountCents: 2000,
        tone: 'neutral',
        phrase: 'Ana le debe S/ 20.00 a Luis',
      },
    ]);
  });

  it('builds negative hero phrase and falls back to "Otro miembro" when name is missing', () => {
    const summary = buildSharedSpaceSummary(
      [{ fromUserId: 'me', toUserId: 'uuid-999', amount: 4000 }],
      'me',
    );

    expect(summary.netCents).toBe(-4000);
    expect(summary.tone).toBe('negative');
    expect(summary.heroPhrase).toBe('Debes S/ 40.00');
    expect(summary.pairPhrases[0].phrase).toBe('Le debes S/ 40.00 a Otro miembro');
  });
});

describe('formatSharedMovementSplit', () => {
  it('formats equal split and custom split for current user vs another member', () => {
    expect(
      formatSharedMovementSplit(
        {
          created_by: 'ana',
          split_mode: 'percentage',
          splits: [
            { user_id: 'ana', share_cents: 5000 },
            { user_id: 'me', share_cents: 5000 },
          ],
        },
        'me',
        { ana: 'Ana' },
      ),
    ).toBe('Pagó Ana · dividido en partes iguales');

    expect(
      formatSharedMovementSplit(
        {
          created_by: 'me',
          split_mode: 'fixed_amount',
          splits: [
            { user_id: 'me', share_cents: 7000 },
            { user_id: 'ana', share_cents: 3000 },
          ],
        },
        'me',
        { ana: 'Ana' },
      ),
    ).toBe('Pagaste tú · división personalizada');
  });
});
