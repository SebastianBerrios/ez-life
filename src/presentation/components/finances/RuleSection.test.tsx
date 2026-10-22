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
const wants = bucket({ id: 'wants', name: 'Deseos', percentage: 30, budget: 90000, remaining: 90000 });

describe('RuleSection (desktop)', () => {
  it('shows the cycle execution with one status tile per bucket and the global figures', () => {
    render(<RuleSection rule={rule([needs, wants], { status: 'warning', spentPercentOfBase: 67 })} desktop />);
    const execution = screen.getByTestId('rule-execution');
    expect(within(execution).getByText('Ejecución del ciclo')).toBeInTheDocument();
    expect(within(execution).getByText('Base: S/ 2,400.00')).toBeInTheDocument();
    expect(within(execution).getByText('S/ 1,600.00 gastados (67%)')).toBeInTheDocument();
    expect(within(execution).getByText('Margen restante disponible: S/ 800.00')).toBeInTheDocument();
    expect(screen.getByTestId('budget-status-needs')).toHaveAttribute('aria-label', 'Presupuesto excedido');
    expect(screen.getByTestId('budget-status-wants')).toHaveAttribute('aria-label', 'Dentro del límite');
    expect(within(screen.getByTestId('rule-tile-needs')).getByText('107% usado')).toBeInTheDocument();
  });

  it('lists each bucket column with its categories, share bars and the used subtotal', () => {
    render(<RuleSection rule={rule([needs, wants])} desktop />);
    const column = screen.getByTestId('rule-bucket-needs');
    expect(within(column).getByText('Alimentación')).toBeInTheDocument();
    expect(within(column).getByText('Vivienda')).toBeInTheDocument();
    expect(within(column).getByRole('progressbar', { name: 'Participación de Alimentación en Necesidades' })).toHaveAttribute('aria-valuenow', '38');
    expect(within(column).getByText('Usado')).toBeInTheDocument();
    expect(within(column).getByText('S/ 1,600.00 / S/ 1,500.00')).toBeInTheDocument();
    expect(within(column).getByText('Excedido por S/ 100.00')).toBeInTheDocument();
    expect(within(screen.getByTestId('rule-bucket-wants')).getByText('Sin categorías de gasto en esta categoría de distribución.')).toBeInTheDocument();
  });

  it('expands a category with subcategories using a real disclosure button', async () => {
    const user = userEvent.setup();
    render(<RuleSection rule={rule([needs])} desktop />);
    const toggle = screen.getByRole('button', { name: /Alimentación/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Restaurantes')).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Restaurantes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vivienda/ })).toBeNull(); // no subcategories: plain row
  });

  it('shows spending without a category as its own line', () => {
    render(<RuleSection rule={rule([bucket({ id: 'needs', spent: 5000, uncategorized: 5000 })])} desktop />);
    expect(within(screen.getByTestId('rule-bucket-needs')).getByText('Sin categoría')).toBeInTheDocument();
  });

  it('warns when there is no expected income to apply the percentages to', () => {
    render(<RuleSection rule={rule([bucket({ id: 'needs', budget: 0, remaining: 0 })], { base: 0 })} desktop />);
    expect(screen.getByText(/Sin ingreso esperado configurado/)).toBeInTheDocument();
  });

  it('explains when no distribution exists', () => {
    render(<RuleSection rule={rule([], { hasBuckets: false })} desktop />);
    expect(screen.getByText(/no hay categorías de distribución configuradas/i)).toBeInTheDocument();
    expect(screen.queryByTestId('rule-execution')).toBeNull();
  });
});

describe('RuleSection (mobile)', () => {
  it('shows "Distribución mensual" with the bucket bar and a flat "Gastos por categoría" list', () => {
    render(<RuleSection rule={rule([needs, wants])} desktop={false} />);
    const monthly = screen.getByTestId('rule-execution');
    expect(within(monthly).getByText('Distribución mensual')).toBeInTheDocument();
    expect(within(monthly).getByTestId('bucket-bar')).toBeInTheDocument();
    expect(within(monthly).getByText('50% Necesidades')).toBeInTheDocument();
    expect(screen.getByTestId('budget-status-needs')).toHaveAttribute('aria-label', 'Presupuesto excedido');

    const list = screen.getByRole('region', { name: 'Gastos por categoría' });
    expect(within(list).getByText('Alimentación')).toBeInTheDocument();
    expect(within(list).getByText('38% de Necesidades')).toBeInTheDocument();
    expect(within(list).getByText('Vivienda')).toBeInTheDocument();
  });

  it('says so when there are no categories yet', () => {
    render(<RuleSection rule={rule([wants])} desktop={false} />);
    expect(screen.getByText('Sin categorías de gasto todavía.')).toBeInTheDocument();
  });
});
