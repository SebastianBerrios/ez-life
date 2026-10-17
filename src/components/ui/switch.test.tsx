import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Switch } from './switch';

function Harness({ onChange }: { onChange?: (v: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      aria-label="Afecta al Espacio Compartido"
      checked={checked}
      onCheckedChange={(v) => {
        setChecked(v);
        onChange?.(v);
      }}
    />
  );
}

describe('Switch', () => {
  it('renders role=switch reflecting aria-checked', () => {
    render(<Switch aria-label="x" checked onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'x' })).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles on click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('toggles with the keyboard (Space and Enter)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('switch');
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('does not toggle when disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch aria-label="x" checked={false} disabled onCheckedChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
