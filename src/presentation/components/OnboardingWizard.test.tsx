import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import OnboardingWizard from './OnboardingWizard';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { calculateMonthBalance } from '../../core/use-cases/calculateMonthBalance';
import { db } from '../../infrastructure/db/db';
import { uuidv7 } from 'uuidv7';

describe('OnboardingWizard — 6-step setup and settings mode (US2, T047 & T050)', () => {
  const profileId = 'user-1';

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('lists all 6 steps in order and marks the current step for assistive technology', async () => {
    render(<OnboardingWizard profileId={profileId} startStep={5} onComplete={() => {}} />);
    const steps = screen.getByRole('list', { name: 'Progreso de la configuración' });
    const items = within(steps).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items.map(i => i.textContent)).toEqual([
      expect.stringContaining('Ingresos'),
      expect.stringContaining('Dinero'),
      expect.stringContaining('Tarjetas'),
      expect.stringContaining('Préstamos'),
      expect.stringContaining('Distribución'),
      expect.stringContaining('Categorías'),
    ]);
    expect(items.map(item => item.getAttribute('aria-current'))).toEqual([null, null, null, null, 'step', null]);
    expect(items[0]).toHaveTextContent('Completado');
    expect(items[4]).toHaveTextContent('Paso 5 de 6, actual');
    expect(items[5]).toHaveTextContent('Paso 6 de 6');
    expect(await screen.findByRole('button', { name: 'Guardar distribución' })).toBeInTheDocument();
  });

  it('resuming at step 5 (Distribución) continues to step 6 (Categorías) in setup mode', async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    render(<OnboardingWizard profileId={profileId} startStep={5} onComplete={complete} />);
    await user.click(await screen.findByRole('button', { name: 'Guardar distribución' }));
    expect(await screen.findByText('Categorías de gasto')).toBeInTheDocument();
    expect(complete).not.toHaveBeenCalled();
    expect((await db.profiles.get(profileId))?.onboarding_step).toBe(5);
    await waitFor(() => expect(screen.getByRole('button', { name: /finalizar configuración/i })).toBeEnabled());
  });

  it('editing step 5 or step 3 from settings mode returns immediately without regressing setup progress', async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    await db.profiles.put({
      id: profileId, onboarding_step: 6, onboarding_version: 2, created_at: new Date(), updated_at: new Date(),
    });
    const { unmount } = render(<OnboardingWizard profileId={profileId} mode="settings" startStep={5} onComplete={complete} />);
    await user.click(await screen.findByRole('button', { name: 'Guardar distribución' }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(profileId));
    expect((await db.profiles.get(profileId))?.onboarding_step).toBe(6);
    unmount();

    const completeCard = vi.fn();
    render(<OnboardingWizard profileId={profileId} mode="settings" startStep={3} onComplete={completeCard} />);
    await user.click(screen.getByRole('button', { name: 'No tengo tarjetas' }));
    await waitFor(() => expect(completeCard).toHaveBeenCalledWith(profileId));
    expect((await db.profiles.get(profileId))?.onboarding_step).toBe(6);
    expect((await db.profiles.get(profileId))?.checklist_not_applicable).toContain('cards');
  });

  it('pre-populates example categories in all three distribution buckets on step 6', async () => {
    const catRepo = new LocalCategoryRepository();
    await catRepo.saveDistributionCategory({
      id: uuidv7(), user_id: profileId, name: 'Necesidades', percentage: 50, is_default: true, is_savings: false,
    });
    await catRepo.saveDistributionCategory({
      id: uuidv7(), user_id: profileId, name: 'Gustos', percentage: 30, is_default: true, is_savings: false,
    });
    const savingsBucket = await catRepo.saveDistributionCategory({
      id: uuidv7(), user_id: profileId, name: 'Ahorro', percentage: 20, is_default: true, is_savings: true,
    });

    render(<OnboardingWizard profileId={profileId} startStep={6} onComplete={() => {}} />);

    await waitFor(async () => {
      const categories = await catRepo.getExpenseCategories(profileId);
      expect(categories.length).toBe(4);
    });
    const categories = await catRepo.getExpenseCategories(profileId);
    expect(categories.filter(c => c.distribution_category_id === savingsBucket.id).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole('button', { name: /finalizar configuración/i })).toBeEnabled());
  });

  it('advances 1 -> 6 skipping optional steps 3 and 4 without duplicating data', async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    render(<OnboardingWizard profileId={profileId} startStep={1} onComplete={complete} />);

    // Step 1
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ez·life');
    await user.type(screen.getByLabelText('Ingreso mensual'), '3000');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    // Step 2
    expect(await screen.findByRole('heading', { name: '¿Dónde tienes tu dinero?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    // Step 3 (Omitir)
    expect(await screen.findByRole('heading', { name: '¿Tienes tarjetas de crédito?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Omitir por ahora' }));

    // Step 4 (Omitir)
    expect(await screen.findByRole('heading', { name: '¿Tienes préstamos?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Omitir por ahora' }));

    // Step 5 (Distribución)
    await user.click(await screen.findByRole('button', { name: 'Guardar distribución' }));

    // Step 6 (Categorías)
    const finishBtn = await screen.findByRole('button', { name: /finalizar configuración/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    await user.click(finishBtn);

    await waitFor(() => expect(complete).toHaveBeenCalledWith(profileId));
    expect((await db.profiles.get(profileId))?.onboarding_step).toBe(6);
  });

  it('T050 — US2 Independent Test: full 6-step flow produces Balance S/ 1,600, BBVA card 800/5000, loan with 6 remaining and 0 movements', async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    render(<OnboardingWizard profileId={profileId} startStep={1} onComplete={complete} />);

    // Step 1: Sueldo S/ 3,000, pay day 28, not received yet
    await user.type(screen.getByLabelText('Ingreso mensual'), '3000');
    await user.type(screen.getByLabelText(/qué día te pagan/i), '28');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    // Step 2: Efectivo S/ 100 + BCP debit S/ 1,500
    const cashInput = await screen.findByLabelText('Efectivo');
    await user.clear(cashInput);
    await user.type(cashInput, '100');
    await user.click(screen.getByRole('button', { name: /\+ agregar cuenta/i }));
    await user.type(screen.getByLabelText('Nombre'), 'BCP');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'debit');
    const bankBal = screen.getByLabelText('Saldo actual');
    await user.clear(bankBal);
    await user.type(bankBal, '1500');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    // Step 3: Card BBVA limit 5,000, consumed 800, payment day 15
    await screen.findByRole('heading', { name: '¿Tienes tarjetas de crédito?' });
    await user.type(screen.getByLabelText('Nombre'), 'BBVA');
    await user.type(screen.getByLabelText('Línea de crédito'), '5000');
    const consumed = screen.getByLabelText('Consumido hasta hoy');
    await user.clear(consumed);
    await user.type(consumed, '800');
    await user.type(screen.getByLabelText(/día de pago/i), '15');
    await user.click(screen.getByRole('button', { name: 'Guardar tarjetas y continuar' }));

    // Step 4: Installment loan 12,000, cuota 1,000, 12 total, 6 paid, payment day 5
    await screen.findByRole('heading', { name: '¿Tienes préstamos?' });
    await user.type(screen.getByLabelText('Entidad o persona'), 'BCP Préstamo');
    await user.type(screen.getByLabelText('Monto'), '12000');
    await user.type(screen.getByLabelText('Cuota'), '1000');
    await user.type(screen.getByLabelText('Cuotas totales'), '12');
    const paid = screen.getByLabelText('Cuotas ya pagadas');
    await user.clear(paid);
    await user.type(paid, '6');
    await user.type(screen.getByLabelText('Día de pago'), '5');
    await user.click(screen.getByRole('button', { name: 'Guardar préstamos y continuar' }));

    // Step 5 & Step 6
    await user.click(await screen.findByRole('button', { name: 'Guardar distribución' }));
    const finishBtn = await screen.findByRole('button', { name: /finalizar configuración/i });
    await waitFor(() => expect(finishBtn).toBeEnabled());
    await user.click(finishBtn);

    await waitFor(() => expect(complete).toHaveBeenCalledWith(profileId));

    // Verify persisted state & calculated balance
    const accounts = await db.payment_accounts.where('user_id').equals(profileId).toArray();
    const movements = await db.movements.where('user_id').equals(profileId).toArray();
    const buckets = await db.distribution_categories.where('user_id').equals(profileId).toArray();
    const loans = await db.installment_loans.where('user_id').equals(profileId).toArray();
    const profile = await db.profiles.get(profileId);

    expect(movements).toHaveLength(0);
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({ remaining_installments: 6, status: 'active', payment_day: 5 });

    const balance = calculateMonthBalance({
      month: new Date(),
      accounts,
      movements,
      distributionCategories: buckets,
      balanceSince: profile?.balance_since,
    });
    expect(balance.balance).toBe(160000);
    expect(balance.cards).toEqual([
      expect.objectContaining({
        name: 'BBVA',
        owed: 80000,
        creditLimit: 500000,
        paymentDay: 15,
      }),
    ]);
  });
});
