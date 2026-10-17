import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import OnboardingWizard from './OnboardingWizard';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { db } from '../../infrastructure/db/db';
import { uuidv7 } from 'uuidv7';

describe('OnboardingWizard — Step 3 category seeding (FR-023)', () => {
  const profileId = 'user-1';

  beforeEach(async () => {
    await db.profiles.clear();
    await db.distribution_categories.clear();
    await db.expense_categories.clear();
    await db.expense_subcategories.clear();
  });
  it('resuming at distribution still continues to categories in setup mode', async () => {
    const user = userEvent.setup(); const complete = vi.fn();
    render(<OnboardingWizard profileId={profileId} startStep={2} onComplete={complete} />);
    await user.click(await screen.findByRole('button', { name: 'Guardar distribución' }));
    expect(await screen.findByText('Categorías de gasto')).toBeInTheDocument();
    expect(complete).not.toHaveBeenCalled();
    expect((await db.profiles.get(profileId))?.onboarding_step).toBe(2);
    await waitFor(() => expect(screen.getByRole('button', { name: /finalizar configuración/i })).toBeEnabled());
  });
  it('editing distribution from settings returns without changing setup progress', async () => {
    const user = userEvent.setup(); const complete = vi.fn();
    await db.profiles.put({ id: profileId, onboarding_step: 3, created_at: new Date(), updated_at: new Date() });
    render(<OnboardingWizard profileId={profileId} mode="settings" startStep={2} onComplete={complete} />);
    await user.click(await screen.findByRole('button', { name: 'Guardar distribución' }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(profileId));
    expect((await db.profiles.get(profileId))?.onboarding_step).toBe(3);
  });

  it('pre-populates example categories in all three distribution buckets, including the savings one', async () => {
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

    render(<OnboardingWizard profileId={profileId} startStep={3} onComplete={() => {}} />);

    await waitFor(async () => {
      const categories = await catRepo.getExpenseCategories(profileId);
      expect(categories.length).toBe(4); // all of DEFAULT_CATEGORIES, seeding fully settled
    });

    const categories = await catRepo.getExpenseCategories(profileId);
    const savingsCategories = categories.filter(c => c.distribution_category_id === savingsBucket.id);
    expect(savingsCategories.length).toBeGreaterThan(0);

    // Confirm the finish button actually reflects the seeded state.
    await waitFor(() => expect(screen.getByRole('button', { name: /finalizar configuración/i })).toBeEnabled());
  });
});

describe('OnboardingWizard — progress indicator', () => {
  beforeEach(async () => {
    await db.profiles.clear();
    await db.distribution_categories.clear();
    await db.expense_categories.clear();
    await db.expense_subcategories.clear();
  });

  it('lists the three steps and marks the current one for assistive technology', async () => {
    render(<OnboardingWizard profileId="user-1" startStep={2} onComplete={() => {}} />);
    const steps = screen.getByRole('list', { name: 'Progreso de la configuración' });
    const items = within(steps).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items.map(item => item.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(items[0]).toHaveTextContent('Completado');
    expect(items[1]).toHaveTextContent('Paso 2 de 3, actual');
    expect(items[2]).toHaveTextContent('Paso 3 de 3');
    expect(await screen.findByRole('button', { name: 'Guardar distribución' })).toBeInTheDocument();
  });

  it('shows the product name as the page heading', async () => {
    render(<OnboardingWizard profileId="user-1" startStep={1} onComplete={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ez·life');
    expect(await screen.findByRole('heading', { name: /configuración básica/i })).toBeInTheDocument();
  });
});
