import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Panel, PanelBody, PanelHeader } from './panel';
import { StatCard } from './stat-card';

describe('Panel', () => {
  it('renders eyebrow, title, action and body', () => {
    render(
      <Panel>
        <PanelHeader eyebrow="Distribución" title="Regla 50/30/20" action={<button>Ver todo</button>} />
        <PanelBody>cuerpo</PanelBody>
      </Panel>
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Regla 50/30/20' })).toBeInTheDocument();
    expect(screen.getByText('Distribución')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver todo' })).toBeInTheDocument();
    expect(screen.getByText('cuerpo')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders label, value, hint and tone', () => {
    render(<StatCard label="Ingresos" value="S/ 2,100.00" hint="Este ciclo" tone="positive" data-testid="s" />);
    expect(screen.getByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByText('S/ 2,100.00')).toBeInTheDocument();
    expect(screen.getByText('Este ciclo')).toBeInTheDocument();
    expect(screen.getByTestId('s')).toHaveAttribute('data-tone', 'positive');
  });
});
