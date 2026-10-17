import { describe, expect, it } from 'vitest';
import { calculateUserSharedNet } from './calculateUserSharedNet';

describe('calculateUserSharedNet', () => {
  it('is positive when others owe the user and negative when the user owes', () => {
    expect(calculateUserSharedNet([{ fromUserId: 'b', toUserId: 'me', amount: 4500 }], 'me')).toBe(4500);
    expect(calculateUserSharedNet([{ fromUserId: 'me', toUserId: 'b', amount: 2000 }], 'me')).toBe(-2000);
  });
  it('nets several pairs and ignores pairs without the user', () => {
    expect(calculateUserSharedNet([
      { fromUserId: 'b', toUserId: 'me', amount: 3000 },
      { fromUserId: 'me', toUserId: 'c', amount: 1000 },
      { fromUserId: 'b', toUserId: 'c', amount: 9999 },
    ], 'me')).toBe(2000);
    expect(calculateUserSharedNet([], 'me')).toBe(0);
  });
});
