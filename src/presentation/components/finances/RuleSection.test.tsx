import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import RuleSection from './RuleSection';
import type { RuleBucket, RuleView } from '../../../core/use-cases/buildRuleView';

function bucket(patch: Partial<RuleBucket> & { id: string }): RuleBucket {
  return {
    name: 'Necesidades', percentage: 50, budget: 150000, spent: 0, progress: 0, usedPercent: 0, status: 'ok', remaining: 150000,
    categories: [], uncategorized: 0, ...patch,
  };
}

function rule(buckets: RuleBucket[], patch: Partial<RuleView> = {}): RuleView {
  const totalBudget = buckets.reduce((sum, b) => sum + b.budget, 0);
  const totalSpent = buckets.reduce((sum, b) => sum + b.spent, 0);
  return {
    base: totalBudget, hasBuckets: true, buckets, totalBudget, totalSpent,
    spentPercentOfBase: totalBudget > 0 ? Math.round((totalSpent * 100) / totalBudget) : null,
    remaining: totalBudget - totalSpent, status: 'ok', ...patch,
  };
}

const needs = bucket({
  id: 'needs', spent: 160000, progress: 106.7, usedPercent: 107, status: 'over', remaining: -10000,
  categories: [
    { id: 'food', name: 'Alimentación', spent: 60000, share: 38, subcategories: [{ id: 's', name: 'Restaurantes', spent: 60000 }] },
    { id: 'rent', name: 'Vivienda', spent: 100000, share: 63, subcategories: [] },
  ],
});
const wants = bucket({ id: 'wants', name: 'Deseos', percentage: 30, budget: 90000, spent: 13000, remaining: 77000 });
const savings = bucket({ id: 'save', name: 'Ahorro', percentage: 20, budget: 60000, spent: 60000, remaining: 0 });

describe('RuleSection', () => {
  it('shows hero % spent of monthly income and pastel-pill bucket phrases', () => {
    render(
      <RuleSection
        rule={rule([needs, wants, savings], { status: 'warning', spentPercentOfBase: 78 })}
        savingsBucketIds={new Set(['save'])}
      />,
    );

    const hero = screen.getByTestId('rule-execution');
    expect(within(hero).getByText('78%')).toBeInTheDocument();

    expect(within(screen.getByTestId('rule-bucket-needs')).getByText('Te pasaste S/ 100.00 en necesidades')).toBeInTheDocument();
    expect(within(screen.getByTestId('rule-bucket-wants')).getByText('Llevas S/ 130.00 de S/ 900.00 en deseos')).toBeInTheDocument();
    expect(within(screen.getByTestId('rule-bucket-save')).getByText('Ahorraste S/ 600.00 · meta cumplida')).toBeInTheDocument();
    expect(screen.getByTestId('budget-status-needs')).toHaveAttribute('aria-label', 'Presupuesto excedido');
    expect(screen.getByTestId('budget-status-wants')).toHaveAttribute('aria-label', 'Dentro del límite');
  });

  it('expands collapsible category breakdown and subcategories on demand', async () => {
    const user = userEvent.setup();
    render(<RuleSection rule={rule([needs])} />);

    const card = screen.getByTestId('rule-bucket-needs');
    expect(within(card).queryByText('Alimentación')).toBeNull();

    await user.click(within(card).getByRole('button', { name: /Ver 2 categorías/i }));
    expect(within(card).getByText('Alimentación')).toBeInTheDocument();
    expect(within(card).getByText('Vivienda')).toBeInTheDocument();

    const toggle = within(card).getByRole('button', { name: /Alimentación/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(card).getByText('Restaurantes')).toBeInTheDocument();
  });

  it('shows guidance phrase when there is no expected income configured', () => {
    render(<RuleSection rule={rule([bucket({ id: 'needs', budget: 0, remaining: 0 })], { base: 0, spentPercentOfBase: null })} />);
    expect(screen.getByText('Sin ingreso esperado')).toBeInTheDocument();
  });

  it('shows empty state when no distribution exists', () => {
    render(<RuleSection rule={rule([], { hasBuckets: false })} />);
    expect(screen.getByText(/Aún no configuras tu regla 50\/30\/20/i)).toBeInTheDocument();
    expect(screen.queryByTestId('rule-execution')).toBeNull();
  });
});
