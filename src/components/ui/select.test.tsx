import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

describe('SelectContent', () => {
  it('anchors the menu below the trigger by default (alignItemWithTrigger=false), instead of overlapping the selected item on top of it (US4, FR-001)', async () => {
    const user = userEvent.setup();

    render(
      <Select defaultValue="b">
        <SelectTrigger>
          <SelectValue placeholder="Elegir..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opción A</SelectItem>
          <SelectItem value="b">Opción B</SelectItem>
          <SelectItem value="c">Opción C</SelectItem>
        </SelectContent>
      </Select>
    );

    await user.click(screen.getByRole('combobox'));

    await screen.findByRole('option', { name: 'Opción A' });
    const popup = document.querySelector('[data-slot="select-content"]');
    // data-align-trigger mirrors alignItemWithTrigger — false means the
    // Positioner uses side="bottom" placement instead of overlapping the trigger.
    expect(popup).toHaveAttribute('data-align-trigger', 'false');
  });

  it('still lets alignItemWithTrigger be explicitly overridden to true by a caller that wants the native-select-style overlap', async () => {
    const user = userEvent.setup();

    render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue placeholder="Elegir..." />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger>
          <SelectItem value="a">Opción A</SelectItem>
        </SelectContent>
      </Select>
    );

    await user.click(screen.getByRole('combobox'));

    await screen.findByRole('option', { name: 'Opción A' });
    const popup = document.querySelector('[data-slot="select-content"]');
    expect(popup).toHaveAttribute('data-align-trigger', 'true');
  });
});
