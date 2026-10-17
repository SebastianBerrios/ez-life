import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Money } from './money';

function parts(container: HTMLElement) {
  return {
    sign: container.querySelector('[data-slot="money-sign"]')?.textContent ?? null,
    symbol: container.querySelector('[data-slot="money-symbol"]')?.textContent,
    amount: container.querySelector('[data-slot="money-amount"]')?.textContent,
  };
}

describe('Money', () => {
  it('renders the muted symbol and the grouped amount separately', () => {
    const { container } = render(<Money cents={210000} />);
    expect(parts(container)).toEqual({ sign: null, symbol: 'S/', amount: '2,100.00' });
    expect(container.querySelector('[data-slot="money-symbol"]')).toHaveClass('text-muted-foreground');
  });

  it('uses a true minus for negatives and hides it with sign="never"', () => {
    const { container, rerender } = render(<Money cents={-1200} />);
    expect(parts(container)).toEqual({ sign: '−', symbol: 'S/', amount: '12.00' });
    rerender(<Money cents={-1200} sign="never" />);
    expect(parts(container).sign).toBeNull();
  });

  it('adds a plus only with sign="always" and never signs zero', () => {
    const { container, rerender } = render(<Money cents={500} sign="always" />);
    expect(parts(container).sign).toBe('+');
    rerender(<Money cents={0} sign="always" />);
    expect(parts(container).sign).toBeNull();
  });

  it('resolves tone: auto follows the sign, explicit tones win, default is neutral', () => {
    const { rerender } = render(<Money cents={500} tone="auto" data-testid="m" />);
    expect(screen.getByTestId('m')).toHaveAttribute('data-tone', 'income');
    rerender(<Money cents={-500} tone="auto" data-testid="m" />);
    expect(screen.getByTestId('m')).toHaveAttribute('data-tone', 'expense');
    rerender(<Money cents={0} tone="auto" data-testid="m" />);
    expect(screen.getByTestId('m')).toHaveAttribute('data-tone', 'neutral');
    rerender(<Money cents={500} tone="expense" data-testid="m" />);
    expect(screen.getByTestId('m')).toHaveAttribute('data-tone', 'expense');
    rerender(<Money cents={500} data-testid="m" />);
    expect(screen.getByTestId('m')).toHaveAttribute('data-tone', 'neutral');
  });

  it('applies tabular-nums', () => {
    render(<Money cents={100} data-testid="m" />);
    expect(screen.getByTestId('m')).toHaveClass('tabular-nums');
  });
});
