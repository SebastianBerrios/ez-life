import { describe, it, expect } from 'vitest';
import type {
  Debt,
  IncomeSource,
  InstallmentLoan,
  PaymentAccount,
  Profile,
} from '../domain/models/types';
import { buildSetupChecklist } from './buildSetupChecklist';

const NOW = new Date(2026, 10, 10, 12, 0);

function baseInput(overrides: Partial<Parameters<typeof buildSetupChecklist>[0]> = {}) {
  return {
    incomeSources: [] as IncomeSource[],
    accounts: [] as PaymentAccount[],
    loans: [] as InstallmentLoan[],
    debts: [] as Debt[],
    profile: undefined as Profile | undefined,
    ...overrides,
  };
}

describe('buildSetupChecklist (T072)', () => {
  it('returns 0 of 4 with income as nextPending when everything is empty (only Efectivo does not complete accounts)', () => {
    const checklist = buildSetupChecklist(
      baseInput({
        accounts: [
          {
            id: 'cash',
            user_id: 'u1',
            name: 'Efectivo',
            kind: 'cash',
            opening_balance: 0,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      }),
    );

    expect(checklist.items).toEqual([
      { key: 'income', done: false },
      { key: 'accounts', done: false },
      { key: 'cards', done: false },
      { key: 'loans', done: false },
    ]);
    expect(checklist.doneCount).toBe(0);
    expect(checklist.visible).toBe(true);
    expect(checklist.nextPending).toBe('income');
  });

  it('completes income with amount > 0, accounts with debit/savings, cards with credit, loans with installment loan or borrowed informal debt', () => {
    const checklist = buildSetupChecklist(
      baseInput({
        incomeSources: [
          { id: 's1', user_id: 'u1', name: 'Sueldo', amount: 300000, created_at: NOW, updated_at: NOW },
        ],
        accounts: [
          { id: 'a1', user_id: 'u1', name: 'BCP', kind: 'debit', opening_balance: 100000, created_at: NOW, updated_at: NOW },
          { id: 'c1', user_id: 'u1', name: 'Visa', kind: 'credit', opening_balance: 0, credit_limit: 500000, created_at: NOW, updated_at: NOW },
        ],
        debts: [
          {
            id: 'd1',
            user_id: 'u1',
            counterparty_name: 'Hermano',
            direction: 'borrowed',
            origin: 'manual',
            amount: 20000,
            settled_amount: 0,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      }),
    );

    expect(checklist.doneCount).toBe(4);
    expect(checklist.visible).toBe(false);
    expect(checklist.nextPending).toBeUndefined();
  });

  it('treats skipped steps as pending while checklist_not_applicable declarations allow reaching 4 of 4', () => {
    // User completed income + accounts, skipped cards + loans -> 2 of 4, nextPending = 'cards'
    const skipped = buildSetupChecklist(
      baseInput({
        incomeSources: [{ id: 's1', user_id: 'u1', name: 'Sueldo', amount: 250000, created_at: NOW, updated_at: NOW }],
        accounts: [{ id: 'a1', user_id: 'u1', name: 'Ahorros', kind: 'savings', opening_balance: 50000, created_at: NOW, updated_at: NOW }],
        profile: { id: 'u1', onboarding_step: 6, created_at: NOW, updated_at: NOW },
      }),
    );
    expect(skipped.doneCount).toBe(2);
    expect(skipped.visible).toBe(true);
    expect(skipped.nextPending).toBe('cards');

    // User declares "No tengo tarjetas" + "No tengo préstamos" + "Solo uso efectivo" -> 4 of 4
    const declared = buildSetupChecklist(
      baseInput({
        incomeSources: [{ id: 's1', user_id: 'u1', name: 'Sueldo', amount: 250000, created_at: NOW, updated_at: NOW }],
        profile: {
          id: 'u1',
          checklist_not_applicable: ['accounts', 'cards', 'loans'],
          created_at: NOW,
          updated_at: NOW,
        },
      }),
    );
    expect(declared.doneCount).toBe(4);
    expect(declared.visible).toBe(false);
    expect(declared.nextPending).toBeUndefined();
  });

  it('hides the card when checklist_dismissed is true while still reporting nextPending for Settings', () => {
    const checklist = buildSetupChecklist(
      baseInput({
        incomeSources: [{ id: 's1', user_id: 'u1', name: 'Sueldo', amount: 250000, created_at: NOW, updated_at: NOW }],
        accounts: [{ id: 'a1', user_id: 'u1', name: 'BCP', kind: 'debit', opening_balance: 0, created_at: NOW, updated_at: NOW }],
        profile: {
          id: 'u1',
          checklist_dismissed: true,
          checklist_not_applicable: ['cards'],
          created_at: NOW,
          updated_at: NOW,
        },
      }),
    );

    expect(checklist.doneCount).toBe(3);
    expect(checklist.visible).toBe(false);
    expect(checklist.nextPending).toBe('loans');
  });

  it('ignores zero-amount income sources, archived/deleted accounts, and deleted loans', () => {
    const checklist = buildSetupChecklist(
      baseInput({
        incomeSources: [{ id: 's0', user_id: 'u1', name: 'Sueldo', amount: 0, created_at: NOW, updated_at: NOW }],
        accounts: [
          { id: 'a1', user_id: 'u1', name: 'Vieja', kind: 'debit', opening_balance: 1000, archived: true, created_at: NOW, updated_at: NOW },
          { id: 'c1', user_id: 'u1', name: 'Card', kind: 'credit', opening_balance: 0, deleted_at: NOW, created_at: NOW, updated_at: NOW },
        ],
        loans: [
          {
            id: 'l1',
            user_id: 'u1',
            lender_name: 'Banco',
            amount: 100000,
            installment_count: 10,
            remaining_installments: 10,
            installment_amount: 10000,
            distribution_category_id: 'b1',
            status: 'active',
            deleted_at: NOW,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      }),
    );

    expect(checklist.doneCount).toBe(0);
    expect(checklist.nextPending).toBe('income');
  });
});
