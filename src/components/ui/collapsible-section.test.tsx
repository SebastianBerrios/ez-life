import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CollapsibleSection } from './collapsible-section';

describe('CollapsibleSection', () => {
  it('starts collapsed by default and toggles content in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleSection title="Más opciones" variant="inline" testId="more-options">
        <p>Campo avanzado</p>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /Más opciones/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Campo avanzado')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Campo avanzado')).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Campo avanzado')).not.toBeInTheDocument();
  });

  it('supports controlled open state and calls onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <CollapsibleSection
          title="Perfil"
          badge="2 activas"
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <p>Contenido de perfil</p>
        </CollapsibleSection>
      );
    }

    render(<Controlled />);
    expect(screen.getByText('2 activas')).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /Perfil/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Contenido de perfil')).toBeInTheDocument();
  });

  it('applies panel vs inline visual variants', () => {
    const { rerender } = render(
      <CollapsibleSection title="Sección panel" variant="panel" testId="sec">
        <span>A</span>
      </CollapsibleSection>,
    );
    expect(screen.getByTestId('sec')).toHaveAttribute('data-variant', 'panel');
    expect(screen.getByTestId('sec').className).toContain('bg-card');

    rerender(
      <CollapsibleSection title="Sección inline" variant="inline" testId="sec">
        <span>A</span>
      </CollapsibleSection>,
    );
    expect(screen.getByTestId('sec')).toHaveAttribute('data-variant', 'inline');
    expect(screen.getByTestId('sec').className).toContain('bg-surface-2/60');
  });
});
