import type {
  Debt,
  InstallmentLoan,
  MonthBalance,
  Movement,
  PaymentAccount,
} from '../domain/models/types';
import type { RuleView } from './buildRuleView';
import { calculateAccountBalances } from './calculateAccountBalances';
import { selectCardOwed } from './selectCardOwed';

export interface FinancesHeroInput {
  filteredMovements: Movement[];
  allMovements: Movement[];
  accounts: PaymentAccount[];
  loans: InstallmentLoan[];
  debts: Debt[];
  rule: RuleView;
  monthBalance?: MonthBalance;
}

export interface FinancesCreditCardItem {
  accountId: string;
  name: string;
  owedCents: number;
  creditLimitCents?: number;
  paymentDay?: number;
}

export interface FinancesHeroSummary {
  movementsNetCents: number;
  movementsIncomeCents: number;
  movementsExpenseCents: number;
  ruleSpentPercent: number | null;
  ruleTotalSpentCents: number;
  ruleExpectedIncomeCents: number;
  totalOwedCents: number;
  totalOwedToMeCents: number;
  creditCards: FinancesCreditCardItem[];
}

export function buildFinancesHero(input: FinancesHeroInput): FinancesHeroSummary {
  const { filteredMovements, allMovements, accounts, loans, debts, rule, monthBalance } = input;

  let movementsIncomeCents = 0;
  let movementsExpenseCents = 0;
  for (const m of filteredMovements) {
    if (m.deleted_at || m.type === 'TRANSFER') continue;
    if (m.type === 'INCOME') movementsIncomeCents += m.amount;
    else if (m.type === 'EXPENSE') movementsExpenseCents += m.amount;
  }
  const movementsNetCents = movementsIncomeCents - movementsExpenseCents;

  const accountBalances = calculateAccountBalances(accounts, allMovements);
  const owedByCard = monthBalance ? selectCardOwed(monthBalance) : undefined;

  const creditCards: FinancesCreditCardItem[] = accounts
    .filter((a) => a.kind === 'credit' && !a.archived && !a.deleted_at)
    .map((card) => {
      const owedCents =
        owedByCard && card.id in owedByCard
          ? Math.max(0, owedByCard[card.id])
          : Math.max(0, -(accountBalances[card.id] ?? 0));
      return {
        accountId: card.id,
        name: card.name,
        owedCents,
        creditLimitCents: card.credit_limit,
        paymentDay: card.payment_day,
      };
    });

  const activeLoansCents = loans
    .filter((l) => !l.deleted_at && l.status === 'active')
    .reduce(
      (sum, l) => sum + Math.max(0, l.remaining_installments) * Math.max(0, l.installment_amount),
      0,
    );

  const cardsOwedCents = creditCards.reduce((sum, c) => sum + c.owedCents, 0);

  let borrowedCents = 0;
  let lentCents = 0;
  for (const d of debts) {
    if (d.deleted_at) continue;
    const pending = Math.max(0, d.amount - d.settled_amount);
    if (pending === 0) continue;
    if (d.direction === 'borrowed') borrowedCents += pending;
    else if (d.direction === 'lent') lentCents += pending;
  }

  return {
    movementsNetCents,
    movementsIncomeCents,
    movementsExpenseCents,
    ruleSpentPercent: rule.spentPercentOfBase,
    ruleTotalSpentCents: rule.totalSpent,
    ruleExpectedIncomeCents: rule.base,
    totalOwedCents: activeLoansCents + cardsOwedCents + borrowedCents,
    totalOwedToMeCents: lentCents,
    creditCards,
  };
}
