import type { PairBalance } from './calculateSharedBalance';

/** Net position of `userId` across pair balances: positive = others owe them, negative = they owe. */
export function calculateUserSharedNet(balances: PairBalance[], userId: string): number {
  let net = 0;
  for (const b of balances) {
    if (b.toUserId === userId) net += b.amount;
    if (b.fromUserId === userId) net -= b.amount;
  }
  return net;
}
