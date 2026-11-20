import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { CompactRule } from '../../../core/use-cases/buildCompactRule';
import CompactRuleView from './CompactRule';

describe('CompactRule', () => {
  it('renders each bucket bar and phrase, keeping negative savings informational with floor 0', () => {
    const rule: CompactRule = {
      expectedIncome: 300000,
      hasBuckets: true,
      buckets: [
        {
          id: 'needs',
          name: 'Necesidades',
          percentage: 50,
          isSavings: false,
          kind: 'needs',
          budget: 150000,
          spent: 61500,
          remaining: 88500,
          barPercent: 41,
          exceeded: false,
          negativeSavings: false,
          phrase: 'Te quedan S/ 885.00 para necesidades',
        },
        {
          id: 'wants',
          name: 'Deseos',
          percentage: 30,
          isSavings: false,
          kind: 'wants',
          budget: 90000,
          spent: 102000,
          remaining: -12000,
          barPercent: 100,
          exceeded: true,
          negativeSavings: false,
          phrase: 'Te pasaste S/ 120.00 en deseos',
        },
        {
          id: 'savings',
          name: 'Ahorro',
          percentage: 20,
          isSavings: true,
          kind: 'savings',
          budget: 60000,
          spent: -10000,
          remaining: 70000,
          barPercent: 0,
          exceeded: false,
          negativeSavings: true,
          phrase: 'Este mes sacaste más de lo que ahorraste',
        },
      ],
    };

    render(<CompactRuleView rule={rule} />);

    expect(screen.getByText('Te quedan S/ 885.00 para necesidades')).toBeInTheDocument();
    expect(screen.getByText('Te pasaste S/ 120.00 en deseos')).toBeInTheDocument();

    const savingsRow = screen.getByTestId('compact-rule-bucket-savings');
    expect(savingsRow).toHaveAttribute('data-negative-savings', 'true');
    expect(within(savingsRow).getByText('Este mes sacaste más de lo que ahorraste')).toBeInTheDocument();
    expect(within(savingsRow).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(savingsRow.innerHTML).not.toContain('destructive');
  });

  it('masks money amounts in phrases when hidden is true', () => {
    const rule: CompactRule = {
      expectedIncome: 300000,
      hasBuckets: true,
      buckets: [
        {
          id: 'needs',
          name: 'Necesidades',
          percentage: 50,
          isSavings: false,
          kind: 'needs',
          budget: 150000,
          spent: 61500,
          remaining: 88500,
          barPercent: 41,
          exceeded: false,
          negativeSavings: false,
          phrase: 'Te quedan S/ 885.00 para necesidades',
        },
      ],
    };

    render(<CompactRuleView rule={rule} hidden />);
    expect(screen.getByText('Te quedan •••• para necesidades')).toBeInTheDocument();
    expect(screen.queryByText(/885\.00/)).not.toBeInTheDocument();
  });

  it('renders an empty message when there are no distribution buckets', () => {
    render(<CompactRuleView rule={{ expectedIncome: 0, hasBuckets: false, buckets: [] }} />);
    expect(screen.getByText('Configura tu distribución 50/30/20 en Ajustes.')).toBeInTheDocument();
  });
});
