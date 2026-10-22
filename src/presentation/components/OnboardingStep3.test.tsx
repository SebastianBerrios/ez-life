import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(screen.getByText(/necesitas al menos una categoría con una subcategoría/i)).toBeInTheDocument();
    expect(screen.getByText('Agrega al menos una subcategoría.')).toBeInTheDocument();
  });

  it('shows the neutral Spanish step description', async () => {
    await seedBuckets();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    expect(await screen.findByText('Organiza tus gastos en categorías y subcategorías, agrupadas por cada categoría de distribución.')).toBeInTheDocument();
  });
});

describe('OnboardingStep3 — managing categories', () => {
  it('adds a category to its bucket with no subcategories (Enter submits, Escape cancels)', async () => {
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
    expect(await repo.getSubcategories(saved.id)).toEqual([]);
    expect(screen.queryByText('General')).toBeNull();

    await user.click(within(section).getByRole('button', { name: /Nueva categoría en Gustos/ }));
    await user.keyboard('{Escape}');
    expect(within(section).queryByLabelText('Nombre de categoría en Gustos')).toBeNull();
  });

  it('puts new categories at the end, flags them as empty and blocks "Finalizar" until each has a subcategory', async () => {
    const user = userEvent.setup();
    await seedBuckets();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    const section = await screen.findByRole('region', { name: 'Gustos' });
    await waitFor(async () => expect(await finish()).toBeEnabled());
    const names = () => within(section).getAllByRole('button', { name: /^Eliminar categoría / }).map(button => button.getAttribute('aria-label'));
    expect(names()).toEqual(['Eliminar categoría Ocio']);

    for (const name of ['Streaming', 'Ropa']) {
      await user.click(within(section).getByRole('button', { name: /Nueva categoría en Gustos/ }));
      await user.type(within(section).getByLabelText('Nombre de categoría en Gustos'), `${name}{Enter}`);
      await within(section).findByText(name);
    }

    expect(names()).toEqual(['Eliminar categoría Ocio', 'Eliminar categoría Streaming', 'Eliminar categoría Ropa']);
    expect(screen.getAllByText('Agrega al menos una subcategoría.')).toHaveLength(2);
    expect(await finish()).toBeDisabled();

    // Categories keep their creation order, so the add buttons are [Ocio, Streaming, Ropa].
    await user.click(within(section).getAllByRole('button', { name: '+ Agregar subcategoría' })[1]);
    await user.type(screen.getByLabelText('Nombre de subcategoría en Streaming'), 'Plataformas{Enter}');
    await within(section).findByText(/Plataformas/);
    expect(screen.getAllByText('Agrega al menos una subcategoría.')).toHaveLength(1);
    expect(await finish()).toBeDisabled();

    await user.click(within(section).getAllByRole('button', { name: '+ Agregar subcategoría' })[2]);
    await user.type(screen.getByLabelText('Nombre de subcategoría en Ropa'), 'Calzado{Enter}');
    await within(section).findByText(/Calzado/);
    expect(screen.queryByText('Agrega al menos una subcategoría.')).toBeNull();
    expect(await finish()).toBeEnabled();
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
    expect((await repo.getSubcategories('c-food')).map(sub => sub.name)).toEqual(['Mercado', 'Restaurantes']);
    // A new subcategory goes at the end of its category.
    expect(screen.getAllByRole('button', { name: /^Eliminar subcategoría / }).map(button => button.getAttribute('aria-label')))
      .toEqual(['Eliminar subcategoría Mercado', 'Eliminar subcategoría Restaurantes']);
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

describe('OnboardingStep3 — transient messages (FR-020, FR-021)', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  // Only setTimeout is faked: React, Testing Library and fake-indexeddb keep their real scheduling.
  const fakeClock = () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Testing Library only advances a fake clock for its own waits when it detects `jest`.
    vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
    return userEvent.setup({ advanceTimers: ms => vi.advanceTimersByTime(ms) });
  };

  it('hides the "last subcategory" notice after 4 seconds, next to that subcategory', async () => {
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado']);
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    const remove = await screen.findByRole('button', { name: 'Eliminar subcategoría Mercado' });
    const user = fakeClock();

    await user.click(remove);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se puede eliminar: la categoría necesita al menos una subcategoría.');
    expect(alert.closest('li')).toHaveTextContent('Mercado');

    act(() => { vi.advanceTimersByTime(3999); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the notice as soon as another category or subcategory action starts', async () => {
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado']);
    await repo.saveExpenseCategory({ id: 'c-ropa', user_id: U, distribution_category_id: 'b-wants', name: 'Ropa' }, ['Calzado', 'Botas']);
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    const lastOne = await screen.findByRole('button', { name: 'Eliminar subcategoría Mercado' });
    const user = fakeClock();

    await user.click(lastOne);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar subcategoría Botas' }));
    await waitFor(() => expect(screen.queryByText(/Botas/)).toBeNull());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the "has movements" notice for a category after 4 seconds', async () => {
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-food', user_id: U, distribution_category_id: 'b-needs', name: 'Comida' }, ['Mercado']);
    await new LocalMovementRepository().save({
      id: '', user_id: U, type: 'EXPENSE', amount: 1000, date: new Date(), distribution_category_id: 'b-needs',
      expense_category_id: 'c-food', is_recurring: false,
    });
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    const remove = await screen.findByRole('button', { name: 'Eliminar categoría Comida' });
    const user = fakeClock();

    await user.click(remove);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede eliminar: tiene 1 movimiento asociado.');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not auto-hide the empty-category hint nor the finish help text', async () => {
    const repo = await seedBuckets();
    await repo.saveExpenseCategory({ id: 'c-empty', user_id: U, distribution_category_id: 'b-needs', name: 'Vacía' }, ['Temporal']);
    await db.expense_subcategories.where('category_id').equals('c-empty').delete();
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    await screen.findByText('Agrega al menos una subcategoría.');
    fakeClock();

    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText('Agrega al menos una subcategoría.')).toBeInTheDocument();
    expect(screen.getByText(/necesitas al menos una categoría con una subcategoría/i)).toBeInTheDocument();
  });

  it('does not auto-hide a seeding error', async () => {
    await seedBuckets();
    vi.spyOn(LocalCategoryRepository.prototype, 'seedDefaults').mockRejectedValue(new Error('No se pudieron preparar las categorías.'));
    render(<OnboardingStep3 profileId={U} onComplete={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron preparar las categorías.');
    fakeClock();

    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron preparar las categorías.');
  });
});
