import type { Debt, InstallmentLoan } from '../domain/models/types';
import type { RuleBucket } from './buildRuleView';
import type { FinancesCreditCardItem } from './buildFinancesHero';
import { formatMoney } from './formatMoney';

export function formatRuleBucketPhrase(
  bucket: Pick<RuleBucket, 'name' | 'spent' | 'budget' | 'remaining' | 'status'>,
  isSavings = false,
): string {
  const nameLower = bucket.name.toLowerCase();

  if (isSavings) {
    if (bucket.budget <= 0) {
      return `Ahorraste ${formatMoney(bucket.spent)}`;
    }
    if (bucket.spent > bucket.budget) {
      return `Ahorraste ${formatMoney(bucket.spent)} · superaste tu meta de ${formatMoney(bucket.budget)}`;
    }
    if (bucket.spent === bucket.budget) {
      return `Ahorraste ${formatMoney(bucket.spent)} · meta cumplida`;
    }
    return `Ahorraste ${formatMoney(bucket.spent)} de ${formatMoney(bucket.budget)}`;
  }

  if (bucket.budget <= 0) {
    return `Llevas ${formatMoney(bucket.spent)} en ${nameLower}`;
  }

  if (bucket.spent > bucket.budget || bucket.remaining < 0) {
    const excess = Math.max(0, bucket.spent - bucket.budget);
    return `Te pasaste ${formatMoney(excess)} en ${nameLower}`;
  }

  return `Llevas ${formatMoney(bucket.spent)} de ${formatMoney(bucket.budget)} en ${nameLower}`;
}

export function formatInstallmentLoanPhrase(
  loan: Pick<InstallmentLoan, 'status' | 'remaining_installments' | 'payment_day'>,
): string {
  if (loan.status === 'settled' || loan.remaining_installments <= 0) {
    return 'Préstamo saldado';
  }

  const countPhrase =
    loan.remaining_installments === 1
      ? 'Te falta 1 cuota'
      : `Te faltan ${loan.remaining_installments} cuotas`;

  if (loan.payment_day !== undefined) {
    return `${countPhrase} · próxima el ${loan.payment_day}`;
  }

  return countPhrase;
}

export function formatInformalDebtPhrase(
  debt: Pick<Debt, 'direction' | 'counterparty_name' | 'amount' | 'settled_amount'>,
): string {
  const pending = Math.max(0, debt.amount - debt.settled_amount);
  if (pending === 0) {
    return `Saldado con ${debt.counterparty_name}`;
  }
  if (debt.direction === 'borrowed') {
    return `Le debes ${formatMoney(pending)} a ${debt.counterparty_name}`;
  }
  return `${debt.counterparty_name} te debe ${formatMoney(pending)}`;
}

export function formatCreditCardPhrase(
  card: Pick<FinancesCreditCardItem, 'owedCents' | 'creditLimitCents' | 'paymentDay'>,
): string {
  const base =
    card.creditLimitCents !== undefined && card.creditLimitCents > 0
      ? `Usaste ${formatMoney(card.owedCents)} de ${formatMoney(card.creditLimitCents)}`
      : `Debes ${formatMoney(card.owedCents)}`;

  if (card.paymentDay !== undefined) {
    return `${base} · Pagas el ${card.paymentDay}`;
  }

  return base;
}
