import React, { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../infrastructure/db/db';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalRegistrationRepository } from '../../infrastructure/repositories/local/LocalRegistrationRepository';
import { buildPendingRegistrations } from '../../core/use-cases/buildPendingRegistrations';
import type { RegistrationPrefill } from '../../core/use-cases/buildRegistrationPrefill';
import Dashboard from './Dashboard';
import QuickRecordSheet from './QuickRecordSheet';

function Host({ userId, refDate }: { userId: string; refDate: Date }) {
  const [sheet, setSheet] = useState<{ open: boolean; prefill?: RegistrationPrefill }>({ open: false });
  return (
    <>
      <Dashboard
        userId={userId}
        refDate={refDate}
        onRegisterPending={prefill => setSheet({ open: true, prefill })}
      />
      <QuickRecordSheet
        open={sheet.open}
        onOpenChange={open => setSheet(curr => ({ ...curr, open, ...(open ? {} : { prefill: undefined }) }))}
        userId={userId}
        prefill={sheet.prefill}
        onSaved={() => {}}
      />
    </>
  );
}

/**
 * T061 — Independent Test of US3 against real Dexie (fake-indexeddb):
 * Recurrence rule S/ 80 due on day 5 -> 0 movements auto-created,
 * item listed in "Por registrar", clicking Registrar opens prefilled form,
 * saving removes the item and lowers Balance by S/ 80.
 * Clicking "Omitir este mes" removes the item for the current month and it
 * reappears in the following month.
 */
describe('Dashboard + QuickRecordSheet — US3 Independent Test (fake-indexeddb)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    window.localStorage.clear();
  });

  it('lists recurring expenses without auto-creating movements, registers with prefill, updates balance, and skips cleanly', async () => {
    const userId = 'u-us3';
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dueDay = Math.min(5, now.getDate());

    await new LocalProfileRepository().save({
      id: userId,
      balance_since: currentMonthKey,
      onboarding_step: 6,
      onboarding_version: 2,
    });

    const accRepo = new LocalPaymentAccountRepository();
    const catRepo = new LocalCategoryRepository();

    const debit = await accRepo.save({
      id: '',
      user_id: userId,
      name: 'BCP',
      kind: 'debit',
      opening_balance: 100000, // S/ 1,000.00
    });
    const bucket = await catRepo.saveDistributionCategory({
      id: '',
      user_id: userId,
      name: 'Necesidades',
      percentage: 100,
      is_default: true,
      is_savings: false,
    });
    const expCat = await catRepo.saveExpenseCategory(
      { id: '', user_id: userId, distribution_category_id: bucket.id, name: 'Salud' },
      ['Gimnasio'],
    );

    await db.movement_recurrences.bulkPut([
      {
        id: 'rule-gym',
        user_id: userId,
        type: 'EXPENSE',
        amount: 8000,
        date: now,
        is_recurring: true,
        description: 'Gimnasio',
        day_of_month: dueDay,
        activated_month: currentMonthKey,
        account_id: debit.id,
        distribution_category_id: bucket.id,
        expense_category_id: expCat.id,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'rule-net',
        user_id: userId,
        type: 'EXPENSE',
        amount: 10000,
        date: now,
        is_recurring: true,
        description: 'Internet',
        day_of_month: dueDay,
        activated_month: currentMonthKey,
        account_id: debit.id,
        distribution_category_id: bucket.id,
        expense_category_id: expCat.id,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    const user = userEvent.setup();
    render(<Host userId={userId} refDate={new Date(now.getFullYear(), now.getMonth(), 1)} />);

    // Balance starts at S/ 1,000.00 and ZERO movements were auto-created
    expect(await screen.findByTestId('balance-amount')).toHaveTextContent('S/ 1,000.00');
    expect(await db.movements.where('user_id').equals(userId).count()).toBe(0);

    const pendingPanel = screen.getByTestId('pending-registrations');
    const gymRow = within(pendingPanel).getByTestId(`pending-item-recurrence:rule-gym:${currentMonthKey}`);
    expect(gymRow).toHaveTextContent(`Gimnasio · S/ 80.00 · día ${dueDay}`);

    // Click Registrar -> opens prefilled sheet -> Save
    await user.click(within(gymRow).getByRole('button', { name: 'Registrar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Nuevo registro' });
    expect(within(dialog).getByLabelText('Monto')).toHaveValue('80.00');
    expect(within(dialog).getByLabelText(/Concepto/i)).toHaveValue('Gimnasio');

    await user.click(within(dialog).getByRole('button', { name: 'Guardar registro' }));

    // Item disappears from Por registrar and Balance drops by S/ 80.00 -> S/ 920.00
    await waitFor(() => {
      expect(screen.queryByTestId(`pending-item-recurrence:rule-gym:${currentMonthKey}`)).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('balance-amount')).toHaveTextContent('S/ 920.00');
    expect(await db.movements.where('user_id').equals(userId).count()).toBe(1);

    // Skip Internet -> disappears this month
    const netRow = screen.getByTestId(`pending-item-recurrence:rule-net:${currentMonthKey}`);
    await user.click(within(netRow).getByRole('button', { name: 'Omitir este mes' }));

    await waitFor(() => {
      expect(screen.queryByTestId(`pending-item-recurrence:rule-net:${currentMonthKey}`)).not.toBeInTheDocument();
    });
    expect(screen.getByText('No tienes nada pendiente este mes.')).toBeInTheDocument();

    // Next month: the skipped rule reappears because skips are month-scoped
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, Math.max(dueDay, 10));
    const nextMonthInputs = await new LocalRegistrationRepository().getInputs(userId, nextMonthDate);
    const nextMonthPending = buildPendingRegistrations({
      today: nextMonthDate,
      ...nextMonthInputs,
      cardOwed: {},
    });
    expect(nextMonthPending.map(item => item.refId)).toContain('rule-net');
    expect(nextMonthPending.map(item => item.refId)).toContain('rule-gym');
  });
});
