import { StrictMode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingStep3 from './OnboardingStep3';
import { db } from '../../infrastructure/db/db';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';

const U = 'user-1';

async function seedBuckets() {
  const repo = new LocalCategoryRepository();
  await repo.saveDistributionSet(U, [
    { id: 'b-needs', user_id: U, name: 'Necesidades', percentage: 50, is_default: true, is_savings: false },
    { id: 'b-wants', user_id: U, name: 'Gustos', percentage: 30, is_default: true, is_savings: false },
    { id: 'b-save', user_id: U, name: 'Ahorro', percentage: 20, is_default: true, is_savings: true },
  ]);
  return repo;
}

const finish = () => screen.findByRole('button', { name: /finalizar configuración/i });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('OnboardingStep3 — seeding and layout', () => {
  it('seeds example categories in every bucket (savings included) and lets the user finish', async () => {
    const repo = await seedBuckets();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    await waitFor(async () => expect((await repo.getExpenseCategories(U)).length).toBe(4));
    const categories = await repo.getExpenseCategories(U);
    expect(categories.some(category => category.distribution_category_id === 'b-save')).toBe(true);
    await waitFor(async () => expect(await finish()).toBeEnabled());
  });

  it('shows one section per bucket with its percentage, and the step heading', async () => {
    await seedBuckets();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Categorías de gasto' })).toBeInTheDocument();
    for (const [name, percentage] of [['Necesidades', '50%'], ['Gustos', '30%'], ['Ahorro', '20%']]) {
      const section = await screen.findByRole('region', { name });
      expect(within(section).getByText(percentage)).toBeInTheDocument();
      expect(within(section).getByRole('button', { name: new RegExp(`Nueva categoría en ${name}`) })).toBeInTheDocument();
    }
  });

  it('does not seed twice under React Strict Mode', async () => {
    const repo = await seedBuckets();
    render(<StrictMode><OnboardingStep3 profileId={U} onComplete={vi.fn()} /></StrictMode>);
    await finish();
    await waitFor(async () => expect((await repo.getExpenseCategories(U)).length).toBe(4));
  });

  it('calls onComplete from "Finalizar configuración"', async () => {
    const user = userEvent.setup();
    await seedBuckets();
    const onComplete = vi.fn();
    render(<OnboardingStep3 profileId={U} onComplete={onComplete} />);
    const button = await finish();
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('blocks finishing while a category has no subcategory', async () => {
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-empty', user_id: U, distribution_category_id: 'b-needs', name: 'Vacía' }, ['Temporal']);
    // An older install may hold a category whose subcategories were all removed.
    await db.expense_subcategories.where('category_id').equals('c-empty').delete();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    expect(await screen.findByText('Vacía')).toBeInTheDocument();
    expect(await finish()).toBeDisabled();
    expect(screen.getByText(/necesitás al menos una categoría con una subcategoría/i)).toBeInTheDocument();
  });
});

describe('OnboardingStep3 — managing categories', () => {
  it('adds a category to its bucket with a default subcategory (Enter submits, Escape cancels)', async () => {
    const user = userEvent.setup();
    const repo = await seedBuckets();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    const section = await screen.findByRole('region', { name: 'Gustos' });
    await waitFor(() => expect(within(section).getAllByRole('button', { name: /Eliminar categoría/ }).length).toBeGreaterThan(0));

    await user.click(within(section).getByRole('button', { name: /Nueva categoría en Gustos/ }));
    await user.type(within(section).getByLabelText('Nombre de categoría en Gustos'), 'Streaming{Enter}');

    expect(await within(section).findByText('Streaming')).toBeInTheDocument();
    const saved = (await repo.getExpenseCategories(U)).find(category => category.name === 'Streaming')!;
    expect(saved.distribution_category_id).toBe('b-wants');
    expect((await repo.getSubcategories(saved.id)).map(sub => sub.name)).toEqual(['General']);

    await user.click(within(section).getByRole('button', { name: /Nueva categoría en Gustos/ }));
    await user.keyboard('{Escape}');
    expect(within(section).queryByLabelText('Nombre de categoría en Gustos')).toBeNull();
  });

  it('ignores an empty category name', async () => {
    const user = userEvent.setup();
    const repo = await seedBuckets();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    const section = await screen.findByRole('region', { name: 'Gustos' });
    await waitFor(() => expect(within(section).getAllByRole('button', { name: /Eliminar categoría/ }).length).toBeGreaterThan(0));
    const before = (await repo.getExpenseCategories(U)).length;

    await user.click(within(section).getByRole('button', { name: /Nueva categoría en Gustos/ }));
    await user.type(within(section).getByLabelText('Nombre de categoría en Gustos'), '   {Enter}');

    expect((await repo.getExpenseCategories(U)).length).toBe(before);
  });

  it('adds a subcategory to a category', async () => {
    const user = userEvent.setup();
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado']);
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    await screen.findByText('Comida');
    await user.click(screen.getByRole('button', { name: '+ Agregar subcategoría' }));
    await user.type(screen.getByLabelText('Nombre de subcategoría en Comida'), 'Restaurantes{Enter}');

    expect(await screen.findByText(/Restaurantes/)).toBeInTheDocument();
    expect((await repo.getSubcategories('c-food')).map(sub => sub.name).sort()).toEqual(['Mercado', 'Restaurantes']);
  });

  it('deletes a category that has no movements', async () => {
    const user = userEvent.setup();
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado']);
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Eliminar categoría Comida' }));

    await waitFor(() => expect(screen.queryByText('Comida')).toBeNull());
    expect((await repo.getExpenseCategories(U)).some(category => category.id === 'c-food')).toBe(false);
  });

  it('refuses to delete a category that already has movements and says so', async () => {
    const user = userEvent.setup();
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado']);
    await new LocalMovementRepository().save({
      id: '', user_id: U, type: 'EXPENSE', amount: 1000, date: new Date(), distribution_category_id: 'b-needs',
      expense_category_id: 'c-food', is_recurring: false,
    });
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Eliminar categoría Comida' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede eliminar: tiene 1 movimiento asociado.');
    expect(screen.getByText('Comida')).toBeInTheDocument();
  });

  it('keeps the last subcategory of a category', async () => {
    const user = userEvent.setup();
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado']);
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Eliminar subcategoría Mercado' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('la categoría necesita al menos una subcategoría');
    expect((await repo.getSubcategories('c-food')).length).toBe(1);
  });

  it('deletes a subcategory when another one remains', async () => {
    const user = userEvent.setup();
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado', 'Restaurantes']);
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Eliminar subcategoría Restaurantes' }));

    await waitFor(() => expect(screen.queryByText(/Restaurantes/)).toBeNull());
    expect((await repo.getSubcategories('c-food')).map(sub => sub.name)).toEqual(['Mercado']);
  });
});
