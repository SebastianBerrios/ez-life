import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Segmented, SegmentedPanel } from './segmented';

const options = [
  { value: 'movements', label: 'Movimientos' },
  { value: 'budget', label: 'Regla 50/30/20', count: 3 },
  { value: 'loans', label: 'Préstamos' },
];

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('movements');
  return (
    <>
      <Segmented
        ariaLabel="Secciones de finanzas"
        value={value}
        idPrefix="fin"
        onValueChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
        options={options}
      />
      <SegmentedPanel idPrefix="fin" value="movements" current={value}>
        Panel movimientos
      </SegmentedPanel>
      <SegmentedPanel idPrefix="fin" value="budget" current={value}>
        Panel regla
      </SegmentedPanel>
    </>
  );
}

describe('Segmented', () => {
  it('exposes a labelled tablist with aria-selected on the active tab', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Secciones de finanzas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Regla 50\/30\/20/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onValueChange on click and swaps the linked panel', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: /Regla/ }));
    expect(onChange).toHaveBeenCalledWith('budget');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel regla');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'fin-tab-budget');
  });

  it('moves selection and focus with arrow keys, wrapping at the ends, plus Home/End', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const first = screen.getByRole('tab', { name: 'Movimientos' });
    first.focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Regla/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Regla/ })).toHaveFocus();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Préstamos' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(first).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Préstamos' })).toHaveFocus();
  });

  it('keeps only the active tab in the tab order (roving tabindex)', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Préstamos' })).toHaveAttribute('tabindex', '-1');
  });
});
