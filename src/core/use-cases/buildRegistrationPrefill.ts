import type { MovementRecurrence, PaymentAccount, PendingRegistration } from '../domain/models/types';
import { parseItemKey } from './registrationItemKey';
import { pickPrimaryAccount } from './pickPrimaryAccount';

export interface RegistrationPrefill {
  tab: 'expense' | 'income' | 'transfer' | 'loan';
  amountCents: number;
  accountId?: string;
  toAccountId?: string;
  incomeSourceId?: string;
  recurrenceRuleId?: string;
  recurrenceMonth?: string;
  distributionCategoryId?: string;
  expenseCategoryId?: string;
  expenseSubcategoryId?: string;
  loanId?: string;
  description?: string;
}

export interface BuildRegistrationPrefillContext {
  userId?: string;
  accounts: PaymentAccount[];
  primaryAccountId?: string;
  rules?: MovementRecurrence[];
}

/**
 * Maps a "Por registrar" item into the exact form tab, initial field values
 * and structured links needed by `QuickRecordSheet` (Principio III).
 */
export function buildRegistrationPrefill(
  item: PendingRegistration,
  ctx: BuildRegistrationPrefillContext,
): RegistrationPrefill {
  const { month } = parseItemKey(item.key);
  const resolvedPrimaryId = ctx.primaryAccountId
    ?? (ctx.userId ? pickPrimaryAccount(ctx.accounts, ctx.userId)?.id : pickPrimaryAccount(ctx.accounts, ctx.accounts[0]?.user_id ?? '')?.id);

  switch (item.kind) {
    case 'income':
      return {
        tab: 'income',
        amountCents: item.amount,
        accountId: resolvedPrimaryId,
        incomeSourceId: item.refId,
        description: item.title,
      };
    case 'recurrence': {
      const rule = ctx.rules?.find(r => r.id === item.refId);
      const tab = rule?.type === 'INCOME' ? 'income' : 'expense';
      return {
        tab,
        amountCents: item.amount,
        accountId: rule?.account_id ?? resolvedPrimaryId,
        incomeSourceId: rule?.income_source_id,
        recurrenceRuleId: item.refId,
        recurrenceMonth: month,
        distributionCategoryId: rule?.distribution_category_id,
        expenseCategoryId: rule?.expense_category_id,
        expenseSubcategoryId: rule?.expense_subcategory_id,
        description: rule?.description ?? item.title,
      };
    }
    case 'installment':
      return {
        tab: 'loan',
        amountCents: item.amount,
        accountId: resolvedPrimaryId,
        loanId: item.refId,
        description: item.title,
      };
    case 'card':
      return {
        tab: 'transfer',
        amountCents: item.amount,
        accountId: resolvedPrimaryId,
        toAccountId: item.refId,
        description: item.title,
      };
  }
}
