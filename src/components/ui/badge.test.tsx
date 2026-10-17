import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it.each(['positive', 'negative', 'neutral', 'warning', 'primary'] as const)(
    'renders the %s variant',
    (variant) => {
      render(<Badge variant={variant}>etiqueta</Badge>);
      const badge = screen.getByText('etiqueta');
      expect(badge).toHaveAttribute('data-slot', 'badge');
      expect(badge).toHaveAttribute('data-variant', variant);
    }
  );

  it('defaults to neutral and merges custom classes', () => {
    render(<Badge className="uppercase">CRÍTICO</Badge>);
    const badge = screen.getByText('CRÍTICO');
    expect(badge).toHaveAttribute('data-variant', 'neutral');
    expect(badge).toHaveClass('uppercase');
  });
});
