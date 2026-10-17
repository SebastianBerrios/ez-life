import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RingProgress } from './ring-progress';

describe('RingProgress', () => {
  it('exposes progressbar semantics with the rounded value', () => {
    render(<RingProgress value={74.6} aria-label="Efectividad diaria" />);
    const bar = screen.getByRole('progressbar', { name: 'Efectividad diaria' });
    expect(bar).toHaveAttribute('aria-valuenow', '75');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it.each([
    [-20, '0'],
    [140, '100'],
    [Number.NaN, '0'],
  ])('clamps %s to %s', (value, expected) => {
    render(<RingProgress value={value} aria-label="anillo" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', expected);
  });

  it('fills the dash offset proportionally and renders the center label', () => {
    const { container } = render(
      <RingProgress value={50} size={100} strokeWidth={10}>
        <span>50%</span>
      </RingProgress>
    );
    const indicator = container.querySelector('[data-slot="ring-progress-indicator"]')!;
    const circumference = 2 * Math.PI * 45;
    expect(Number(indicator.getAttribute('stroke-dasharray'))).toBeCloseTo(circumference);
    expect(Number(indicator.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference / 2);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
