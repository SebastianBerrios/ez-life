import type {
  IncomeSource,
  InstallmentLoan,
  Movement,
  MovementRecurrence,
  PaymentAccount,
  PendingRegistration,
  RegistrationKind,
  ReminderSkip,
} from '../domain/models/types';
import { clampDayToMonth } from './clampDayToMonth';
import { registrationItemKey } from './registrationItemKey';

export const REGISTRATION_LEAD_DAYS: Readonly<Record<RegistrationKind, number>> = {
  income: 0,
  recurrence: 0,
  installment: 3,
  card: 3,
};

export interface BuildPendingRegistrationsInput {
  today: Date;
  rules: MovementRecurrence[];
  incomeSources: IncomeSource[];
  loans: InstallmentLoan[];
  loanIdByPaymentId: Record<string, string>;
  accounts: PaymentAccount[];
  cardOwed: Record<string, number>;
  monthMovements: Movement[];
  skips: ReminderSkip[];
}

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Pure derivation of the "Por registrar" list for the month of `today`
 * (spec 013 R7, FR-014–FR-019). Never creates movements.
 */
export function buildPendingRegistrations(input: BuildPendingRegistrationsInput): PendingRegistration[] {
  const {
    today,
    rules,
    incomeSources,
    loans,
    loanIdByPaymentId,
    accounts,
    cardOwed,
    monthMovements,
    skips,
  } = input;

  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const todayDay = today.getDate();
  const monthKey = toYearMonth(today);

  const liveMoves = monthMovements.filter(m => !m.deleted_at);
  const skippedKeys = new Set(skips.filter(s => !s.deleted_at && s.month === monthKey).map(s => s.item_key));

  // Structured coverage sets (FR-019)
  const coveredIncomeSourceIds = new Set<string>();
  const coveredRecurrenceRuleIds = new Set<string>();
  const coveredLoanIds = new Set<string>();
  const coveredCardIds = new Set<string>();

  for (const m of liveMoves) {
    if (m.type === 'INCOME' && m.income_source_id) {
      coveredIncomeSourceIds.add(m.income_source_id);
    }
    if (m.recurrence_rule_id && m.recurrence_month === monthKey) {
      coveredRecurrenceRuleIds.add(m.recurrence_rule_id);
    }
    if (m.installment_payment_id) {
      const loanId = loanIdByPaymentId[m.installment_payment_id];
      if (loanId) coveredLoanIds.add(loanId);
    }
    if (m.type === 'TRANSFER' && m.to_account_id) {
      coveredCardIds.add(m.to_account_id);
    }
  }

  const items: PendingRegistration[] = [];

  const maybePush = (
    kind: RegistrationKind,
    refId: string,
    title: string,
    amount: number,
    rawDay: number,
  ) => {
    const day = clampDayToMonth(year, monthIndex, rawDay);
    const appearDay = Math.max(1, day - REGISTRATION_LEAD_DAYS[kind]);
    if (todayDay < appearDay) return;
    const key = registrationItemKey(kind, refId, monthKey);
    if (skippedKeys.has(key)) return;
    items.push({
      key,
      kind,
      refId,
      title,
      amount,
      day,
      overdue: day < todayDay,
    });
  };

  // 1. Income sources
  for (const source of incomeSources) {
    if (source.deleted_at) continue;
    if (source.pay_day === undefined) continue;
    if (source.received_month === monthKey) continue;
    if (coveredIncomeSourceIds.has(source.id)) continue;
    const label = !source.name.trim() || source.name === 'Sueldo Base' ? 'Sueldo' : source.name.trim();
    maybePush('income', source.id, label, source.amount, source.pay_day);
  }

  // 2. Active recurrence rules
  for (const rule of rules) {
    if (rule.deleted_at || !rule.active) continue;
    if (rule.activated_month > monthKey) continue;
    if (coveredRecurrenceRuleIds.has(rule.id)) continue;
    const title = rule.description?.trim() || (rule.type === 'INCOME' ? 'Ingreso recurrente' : 'Gasto recurrente');
    maybePush('recurrence', rule.id, title, rule.amount, rule.day_of_month);
  }

  // 3. Active installment loans with payment_day
  for (const loan of loans) {
    if (loan.deleted_at || loan.status === 'settled' || loan.remaining_installments <= 0) continue;
    if (loan.payment_day === undefined) continue;
    if (coveredLoanIds.has(loan.id)) continue;
    maybePush('installment', loan.id, `Cuota de ${loan.lender_name}`, loan.installment_amount, loan.payment_day);
  }

  // 4. Active credit cards with payment_day and owed > 0
  for (const account of accounts) {
    if (account.deleted_at || account.archived || account.kind !== 'credit') continue;
    if (account.payment_day === undefined) continue;
    const owed = cardOwed[account.id] ?? 0;
    if (owed <= 0) continue;
    if (coveredCardIds.has(account.id)) continue;
    maybePush('card', account.id, `Pagar tarjeta ${account.name}`, owed, account.payment_day);
  }

  return items.sort((a, b) => a.day - b.day || a.key.localeCompare(b.key));
}
