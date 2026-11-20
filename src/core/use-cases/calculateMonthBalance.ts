import type {
  CardDebtSummary,
  DistributionCategory,
  MonthBalance,
  Movement,
  PaymentAccount,
} from '../domain/models/types';
import { calendarKey } from './calendar';
import { calculateMonthlyCycle } from './calculateMonthlyCycle';

export interface CalculateMonthBalanceInput {
  month: Date;
  accounts: PaymentAccount[];
  movements: Movement[];
  distributionCategories: DistributionCategory[];
  balanceSince?: string;
}

type AccountRole = 'S' | 'V' | 'C' | 'ignored';

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function prevYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return toYearMonth(new Date(y, m - 2, 1));
}

function monthEndOf(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return calculateMonthlyCycle(new Date(y, m - 1, 1))[1];
}

function monthStartOf(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return calculateMonthlyCycle(new Date(y, m - 1, 1))[0];
}

interface ActiveAccountMeta {
  account: PaymentAccount;
  role: 'S' | 'V' | 'C';
  openDay?: string;
  openMonth?: string;
}

/**
 * Pure, deterministic monthly balance calculation (spec 013 R1–R5).
 * Computes the Balance in closed form (`efectivoGastable - deudaCorriente`)
 * and the monthly flows independently by classifying each movement of the
 * requested month, guaranteeing `balance === opening + entro - salio - ahorraste + sacaste + ajuste`.
 */
export function calculateMonthBalance(input: CalculateMonthBalanceInput): MonthBalance {
  const { month, accounts, movements, distributionCategories, balanceSince } = input;
  const [, targetEnd] = calculateMonthlyCycle(month);
  const targetMonth = toYearMonth(month);
  const prevMonth = prevYearMonth(targetMonth);
  const prevEnd = monthEndOf(prevMonth);

  const savingsBucketIds = new Set(
    distributionCategories.filter(c => !c.deleted_at && c.is_savings).map(c => c.id),
  );

  // Active (non-deleted, non-archived) accounts indexed by id.
  const activeMap = new Map<string, ActiveAccountMeta>();
  const activeAccounts: ActiveAccountMeta[] = [];
  for (const account of accounts) {
    if (account.deleted_at || account.archived) continue;
    const role: 'S' | 'V' | 'C' =
      account.kind === 'debit' || account.kind === 'cash'
        ? 'S'
        : account.kind === 'savings'
          ? 'V'
          : 'C';
    const meta: ActiveAccountMeta = {
      account,
      role,
      openDay: account.opening_date ? calendarKey(account.opening_date) : undefined,
      openMonth: account.opening_date ? toYearMonth(account.opening_date) : undefined,
    };
    activeMap.set(account.id, meta);
    activeAccounts.push(meta);
  }

  // Chronologically sorted live movements up to targetEnd.
  const liveMovements = movements
    .filter(m => !m.deleted_at && m.date.getTime() <= targetEnd.getTime())
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime()
        || a.created_at.getTime() - b.created_at.getTime()
        || a.id.localeCompare(b.id),
    );

  const roleFor = (accountId: string | undefined, moveDay: string, allowUnassignedAsS: boolean): AccountRole => {
    if (accountId === undefined) return allowUnassignedAsS ? 'S' : 'ignored';
    const meta = activeMap.get(accountId);
    if (!meta) return 'ignored';
    if (meta.openDay !== undefined && moveDay < meta.openDay) return 'ignored';
    return meta.role;
  };

  // --- Closed-form spendable cash at a given month end (or at the start of M0) ---
  const computeSpendableCash = (asOfMonth: string, cutoffEnd: Date, includeOpeningUpToMonth: string): number => {
    let total = 0;
    const spendableIds = new Set<string>();
    for (const meta of activeAccounts) {
      if (meta.role !== 'S') continue;
      if (meta.openMonth !== undefined && meta.openMonth > includeOpeningUpToMonth) continue;
      total += meta.account.opening_balance;
      spendableIds.add(meta.account.id);
    }
    for (const m of liveMovements) {
      if (m.date.getTime() > cutoffEnd.getTime()) break;
      const moveDay = calendarKey(m.date);
      if (m.type === 'TRANSFER') {
        if (m.account_id && spendableIds.has(m.account_id)) {
          const fromMeta = activeMap.get(m.account_id)!;
          if (fromMeta.openDay === undefined || moveDay >= fromMeta.openDay) total -= m.amount;
        }
        if (m.to_account_id && spendableIds.has(m.to_account_id)) {
          const toMeta = activeMap.get(m.to_account_id)!;
          if (toMeta.openDay === undefined || moveDay >= toMeta.openDay) total += m.amount;
        }
      } else if (m.account_id === undefined) {
        total += m.type === 'INCOME' ? m.amount : -m.amount;
      } else if (spendableIds.has(m.account_id)) {
        const meta = activeMap.get(m.account_id)!;
        if (meta.openDay === undefined || moveDay >= meta.openDay) {
          total += m.type === 'INCOME' ? m.amount : -m.amount;
        }
      }
    }
    void asOfMonth;
    return total;
  };

  // --- Single chronological pass for credit card state & target-month flows ---
  const cardMetas = activeAccounts.filter(m => m.role === 'C');
  const cardIds = new Set(cardMetas.map(m => m.account.id));

  // Track raw balance for each card (for pre-balance_since and owed calculation).
  const cardBalance = new Map<string, number>();
  const prevDebt = new Map<string, number>();
  const currDebt = new Map<string, number>();

  for (const meta of cardMetas) {
    // Only include opening_balance once the card is opened (at or before targetMonth).
    const existsAtTarget = meta.openMonth === undefined || meta.openMonth <= targetMonth;
    const initBal = existsAtTarget ? meta.account.opening_balance : 0;
    cardBalance.set(meta.account.id, initBal);
    prevDebt.set(meta.account.id, 0);
    currDebt.set(meta.account.id, 0);
  }

  const m0Start = balanceSince ? monthStartOf(balanceSince) : undefined;
  const isTargetTracked = balanceSince !== undefined && targetMonth >= balanceSince;

  // Step A: process all movements strictly BEFORE balance_since (if tracked)
  // to determine initial previousDebt at start of M0.
  let idx = 0;
  if (m0Start) {
    // Initialize cards that exist on or before M0 with their opening_balance before M0.
    for (const meta of cardMetas) {
      if (meta.openMonth === undefined || meta.openMonth <= balanceSince!) {
        cardBalance.set(meta.account.id, meta.account.opening_balance);
      } else {
        cardBalance.set(meta.account.id, 0);
      }
    }
    while (idx < liveMovements.length && liveMovements[idx].date.getTime() < m0Start.getTime()) {
      const m = liveMovements[idx];
      const moveDay = calendarKey(m.date);
      if (m.type === 'TRANSFER') {
        if (m.account_id && cardIds.has(m.account_id)) {
          const meta = activeMap.get(m.account_id)!;
          if (meta.openDay === undefined || moveDay >= meta.openDay) {
            cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) - m.amount);
          }
        }
        if (m.to_account_id && cardIds.has(m.to_account_id)) {
          const meta = activeMap.get(m.to_account_id)!;
          if (meta.openDay === undefined || moveDay >= meta.openDay) {
            cardBalance.set(m.to_account_id, (cardBalance.get(m.to_account_id) ?? 0) + m.amount);
          }
        }
      } else if (m.account_id && cardIds.has(m.account_id)) {
        const meta = activeMap.get(m.account_id)!;
        if (meta.openDay === undefined || moveDay >= meta.openDay) {
          const delta = m.type === 'INCOME' ? m.amount : -m.amount;
          cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) + delta);
        }
      }
      idx++;
    }
    // Snapshot initial previousDebt at the start of M0.
    for (const meta of cardMetas) {
      if (meta.openMonth === undefined || meta.openMonth <= balanceSince!) {
        prevDebt.set(meta.account.id, Math.max(0, -(cardBalance.get(meta.account.id) ?? 0)));
      } else if (meta.openMonth <= targetMonth) {
        // Card opened in a month after M0: its initial negative balance is previousDebt.
        cardBalance.set(meta.account.id, meta.account.opening_balance);
        prevDebt.set(meta.account.id, Math.max(0, -meta.account.opening_balance));
      }
    }
  } else {
    // No balanceSince -> no cards tracked; process up to targetEnd purely for cardBalance.
    for (const m of liveMovements) {
      const moveDay = calendarKey(m.date);
      if (m.type === 'TRANSFER') {
        if (m.account_id && cardIds.has(m.account_id)) {
          const meta = activeMap.get(m.account_id)!;
          if (meta.openDay === undefined || moveDay >= meta.openDay) {
            cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) - m.amount);
          }
        }
        if (m.to_account_id && cardIds.has(m.to_account_id)) {
          const meta = activeMap.get(m.to_account_id)!;
          if (meta.openDay === undefined || moveDay >= meta.openDay) {
            cardBalance.set(m.to_account_id, (cardBalance.get(m.to_account_id) ?? 0) + m.amount);
          }
        }
      } else if (m.account_id && cardIds.has(m.account_id)) {
        const meta = activeMap.get(m.account_id)!;
        if (meta.openDay === undefined || moveDay >= meta.openDay) {
          const delta = m.type === 'INCOME' ? m.amount : -m.amount;
          cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) + delta);
        }
      }
    }
  }

  // Monthly flow accumulators for targetMonth
  let entro = 0;
  let salio = 0;
  let ahorraste = 0;
  let sacaste = 0;
  let ajuste = 0;

  // Late-opened spendable accounts: if an S account has opening_date in targetMonth
  // and targetMonth !== balanceSince, its opening_balance enters as ajuste (R2, case 21).
  for (const meta of activeAccounts) {
    if (meta.role !== 'S') continue;
    if (meta.openMonth === targetMonth && targetMonth !== balanceSince) {
      ajuste += meta.account.opening_balance;
    }
  }

  let prevMonthCurrentDebtTotal = 0;
  let capturedPrevCurrentDebt = false;

  const sumCurrentDebt = (): number => {
    let sum = 0;
    for (const value of currDebt.values()) sum += value;
    return sum;
  };

  // Helper: classify flows for a movement inside targetMonth when M < balanceSince (or balanceSince undefined)
  const classifyUntrackedMovement = (m: Movement, moveDay: string) => {
    const a = m.amount;
    if (m.is_adjustment) {
      const role = roleFor(m.account_id, moveDay, true);
      if (role === 'S') {
        ajuste += m.type === 'INCOME' ? a : -a;
      }
      return;
    }
    if (m.type === 'INCOME') {
      const role = roleFor(m.account_id, moveDay, true);
      if (role === 'S') {
        entro += a;
      } else if (role === 'V') {
        entro += a;
        ahorraste += a;
      }
      // role === 'C' before balanceSince: reduces previousDebt only, no flow
      return;
    }
    if (m.type === 'EXPENSE') {
      const role = roleFor(m.account_id, moveDay, true);
      const isSavings = !m.installment_payment_id && m.distribution_category_id !== undefined && savingsBucketIds.has(m.distribution_category_id);
      if (role === 'S') {
        if (isSavings) ahorraste += a;
        else salio += a;
      } else if (role === 'V') {
        if (!isSavings) {
          salio += a;
          sacaste += a;
        }
      }
      // role === 'C' before balanceSince: previous debt, no flow
      return;
    }
    // TRANSFER before balanceSince (all card debt is previous -> t = a)
    const fromRole = roleFor(m.account_id, moveDay, false);
    const toRole = roleFor(m.to_account_id, moveDay, false);
    if (fromRole === 'S' && toRole === 'V') ahorraste += a;
    else if (fromRole === 'V' && toRole === 'S') sacaste += a;
    else if (fromRole === 'S' && toRole === 'C') salio += a;
    else if (fromRole === 'V' && toRole === 'C') {
      salio += a;
      sacaste += a;
    } else if (fromRole === 'C' && toRole === 'S') {
      ajuste += a;
    } else if (fromRole === 'S' && toRole === 'ignored') {
      ajuste -= a;
    } else if (fromRole === 'ignored' && toRole === 'S') {
      ajuste += a;
    }
  };

  if (!isTargetTracked) {
    // Target month is before balance_since (or balance_since is undefined).
    for (const m of liveMovements) {
      if (toYearMonth(m.date) !== targetMonth) continue;
      classifyUntrackedMovement(m, calendarKey(m.date));
    }
    const efectivo = computeSpendableCash(targetMonth, targetEnd, targetMonth);
    const prevEfectivo = computeSpendableCash(prevMonth, prevEnd, prevMonth);

    const cards: CardDebtSummary[] = cardMetas
      .filter(meta => meta.openMonth === undefined || meta.openMonth <= targetMonth)
      .map(meta => {
        const bal = cardBalance.get(meta.account.id) ?? 0;
        const owed = Math.max(0, -bal);
        return {
          accountId: meta.account.id,
          name: meta.account.name,
          owed,
          previousDebt: owed,
          creditLimit: meta.account.credit_limit,
          paymentDay: meta.account.payment_day,
        };
      });

    return {
      opening: prevEfectivo,
      entro,
      salio,
      ahorraste,
      sacaste,
      ajuste,
      balance: efectivo,
      savingsNet: ahorraste - sacaste,
      cards,
    };
  }

  // Step B: process tracked movements from M0Start up to targetEnd.
  for (let i = idx; i < liveMovements.length; i++) {
    const m = liveMovements[i];
    if (!capturedPrevCurrentDebt && m.date.getTime() > prevEnd.getTime()) {
      prevMonthCurrentDebtTotal = sumCurrentDebt();
      capturedPrevCurrentDebt = true;
    }

    const moveDay = calendarKey(m.date);
    const inTargetMonth = toYearMonth(m.date) === targetMonth;
    const a = m.amount;

    if (m.is_adjustment) {
      const role = roleFor(m.account_id, moveDay, true);
      if (role === 'S') {
        if (inTargetMonth) ajuste += m.type === 'INCOME' ? a : -a;
      } else if (role === 'C' && m.account_id) {
        const delta = m.type === 'INCOME' ? a : -a;
        cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) + delta);
        // Card adjustments do not change Balance/currentDebt; adjust previousDebt only.
        prevDebt.set(m.account_id, Math.max(0, (prevDebt.get(m.account_id) ?? 0) - delta));
      }
      continue;
    }

    if (m.type === 'INCOME') {
      const role = roleFor(m.account_id, moveDay, true);
      if (role === 'S') {
        if (inTargetMonth) entro += a;
      } else if (role === 'V') {
        if (inTargetMonth) {
          entro += a;
          ahorraste += a;
        }
      } else if (role === 'C' && m.account_id) {
        cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) + a);
        currDebt.set(m.account_id, (currDebt.get(m.account_id) ?? 0) - a);
        if (inTargetMonth) entro += a;
      }
      continue;
    }

    if (m.type === 'EXPENSE') {
      const role = roleFor(m.account_id, moveDay, true);
      const isSavings = !m.installment_payment_id && m.distribution_category_id !== undefined && savingsBucketIds.has(m.distribution_category_id);
      if (role === 'S') {
        if (inTargetMonth) {
          if (isSavings) ahorraste += a;
          else salio += a;
        }
      } else if (role === 'V') {
        if (inTargetMonth && !isSavings) {
          salio += a;
          sacaste += a;
        }
      } else if (role === 'C' && m.account_id) {
        cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) - a);
        currDebt.set(m.account_id, (currDebt.get(m.account_id) ?? 0) + a);
        if (inTargetMonth) {
          if (isSavings) ahorraste += a;
          else salio += a;
        }
      }
      continue;
    }

    // TRANSFER (tracked month >= M0)
    const fromRole = roleFor(m.account_id, moveDay, false);
    const toRole = roleFor(m.to_account_id, moveDay, false);

    if (fromRole === 'S' && toRole === 'V') {
      if (inTargetMonth) ahorraste += a;
    } else if (fromRole === 'V' && toRole === 'S') {
      if (inTargetMonth) sacaste += a;
    } else if ((fromRole === 'S' || fromRole === 'V') && toRole === 'C' && m.to_account_id) {
      const prev = prevDebt.get(m.to_account_id) ?? 0;
      const t = Math.min(a, prev);
      prevDebt.set(m.to_account_id, prev - t);
      currDebt.set(m.to_account_id, (currDebt.get(m.to_account_id) ?? 0) - (a - t));
      cardBalance.set(m.to_account_id, (cardBalance.get(m.to_account_id) ?? 0) + a);
      if (inTargetMonth) {
        salio += t;
        if (fromRole === 'V') sacaste += a;
      }
    } else if (fromRole === 'C' && toRole === 'S' && m.account_id) {
      cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) - a);
      currDebt.set(m.account_id, (currDebt.get(m.account_id) ?? 0) + a);
      // Cash advance: spendable +a, currentDebt +a -> net Balance 0, no flows
    } else if (fromRole === 'C' && toRole === 'V' && m.account_id) {
      cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) - a);
      currDebt.set(m.account_id, (currDebt.get(m.account_id) ?? 0) + a);
      if (inTargetMonth) ahorraste += a;
    } else if (fromRole === 'C' && toRole === 'C' && m.account_id && m.to_account_id) {
      // Balance transfer C1 -> C2: moves previousDebt first from C2 to C1 so
      // total currentDebt (and Balance) stays unchanged with zero flows (row 18).
      const prevTo = prevDebt.get(m.to_account_id) ?? 0;
      const t = Math.min(a, prevTo);
      prevDebt.set(m.to_account_id, prevTo - t);
      prevDebt.set(m.account_id, (prevDebt.get(m.account_id) ?? 0) + t);
      currDebt.set(m.to_account_id, (currDebt.get(m.to_account_id) ?? 0) - (a - t));
      currDebt.set(m.account_id, (currDebt.get(m.account_id) ?? 0) + (a - t));
      cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) - a);
      cardBalance.set(m.to_account_id, (cardBalance.get(m.to_account_id) ?? 0) + a);
    } else if (fromRole === 'S' && toRole === 'ignored') {
      if (inTargetMonth) ajuste -= a;
    } else if (fromRole === 'ignored' && toRole === 'S') {
      if (inTargetMonth) ajuste += a;
    } else if (fromRole === 'C' && toRole === 'ignored' && m.account_id) {
      cardBalance.set(m.account_id, (cardBalance.get(m.account_id) ?? 0) - a);
      currDebt.set(m.account_id, (currDebt.get(m.account_id) ?? 0) + a);
      if (inTargetMonth) ajuste -= a;
    } else if (fromRole === 'ignored' && toRole === 'C' && m.to_account_id) {
      const prev = prevDebt.get(m.to_account_id) ?? 0;
      const t = Math.min(a, prev);
      prevDebt.set(m.to_account_id, prev - t);
      currDebt.set(m.to_account_id, (currDebt.get(m.to_account_id) ?? 0) - (a - t));
      cardBalance.set(m.to_account_id, (cardBalance.get(m.to_account_id) ?? 0) + a);
      if (inTargetMonth) ajuste += a - t;
    }
  }

  if (!capturedPrevCurrentDebt) {
    prevMonthCurrentDebtTotal = sumCurrentDebt();
  }

  // Closed-form Balance(M) and Arranque(M)
  const efectivoGastable = computeSpendableCash(targetMonth, targetEnd, targetMonth);
  const deudaCorriente = sumCurrentDebt();
  const balance = efectivoGastable - deudaCorriente;

  let opening: number;
  if (targetMonth === balanceSince) {
    // Arranque(M0): spendable accounts with opening <= M0 + pre-M0 movements; initial currentDebt = 0.
    opening = computeSpendableCash(prevMonth, prevEnd, targetMonth);
  } else {
    // Arranque(M) = Balance(M - 1)
    const prevEfectivo = computeSpendableCash(prevMonth, prevEnd, prevMonth);
    opening = prevEfectivo - prevMonthCurrentDebtTotal;
  }

  const cards: CardDebtSummary[] = cardMetas
    .filter(meta => meta.openMonth === undefined || meta.openMonth <= targetMonth)
    .map(meta => {
      const bal = cardBalance.get(meta.account.id) ?? 0;
      const owed = Math.max(0, -bal);
      const previousDebt = prevDebt.get(meta.account.id) ?? 0;
      return {
        accountId: meta.account.id,
        name: meta.account.name,
        owed,
        previousDebt,
        creditLimit: meta.account.credit_limit,
        paymentDay: meta.account.payment_day,
      };
    });

  return {
    opening,
    entro,
    salio,
    ahorraste,
    sacaste,
    ajuste,
    balance,
    savingsNet: ahorraste - sacaste,
    cards,
  };
}
