import type {
  ChecklistKey,
  Debt,
  IncomeSource,
  InstallmentLoan,
  PaymentAccount,
  Profile,
  SetupChecklist,
  SetupChecklistKey,
} from '../domain/models/types';

export interface BuildSetupChecklistInput {
  incomeSources: IncomeSource[];
  accounts: PaymentAccount[];
  loans: InstallmentLoan[];
  debts: Debt[];
  profile?: Profile;
}

/**
 * Pure derivation of the 4-item setup checklist ("Completa tu configuración · N de 4",
 * spec 013 FR-027..FR-029). Skipping an optional onboarding step leaves its item pending;
 * explicitly declaring "No tengo ..." / "Solo uso efectivo" marks it complete via
 * `profile.checklist_not_applicable`.
 */
export function buildSetupChecklist(input: BuildSetupChecklistInput): SetupChecklist {
  const { incomeSources, accounts, loans, debts, profile } = input;
  const notApplicable = new Set<ChecklistKey>(profile?.checklist_not_applicable ?? []);

  const activeAccounts = accounts.filter(a => !a.deleted_at && !a.archived);

  const incomeDone = incomeSources.some(s => !s.deleted_at && s.amount > 0);
  const accountsDone =
    activeAccounts.some(a => a.kind === 'debit' || a.kind === 'savings') ||
    notApplicable.has('accounts');
  const cardsDone =
    activeAccounts.some(a => a.kind === 'credit') ||
    notApplicable.has('cards');
  const loansDone =
    loans.some(l => !l.deleted_at) ||
    debts.some(d => !d.deleted_at && d.direction === 'borrowed') ||
    notApplicable.has('loans');

  const items: { key: SetupChecklistKey; done: boolean }[] = [
    { key: 'income', done: incomeDone },
    { key: 'accounts', done: accountsDone },
    { key: 'cards', done: cardsDone },
    { key: 'loans', done: loansDone },
  ];

  const doneCount = items.filter(item => item.done).length;
  const nextPending = items.find(item => !item.done)?.key;
  const visible = !profile?.checklist_dismissed && doneCount < items.length;

  return {
    items,
    doneCount,
    visible,
    nextPending,
  };
}
