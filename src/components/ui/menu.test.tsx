import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './menu';

function Demo({ onEdit = vi.fn(), onDelete = vi.fn() }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Acciones">...</DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Acciones del movimiento">
        <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('exposes a menu trigger that opens a menu of items', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByRole('button', { name: 'Acciones' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(trigger);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Editar', 'Eliminar']);
  });

  it('runs the chosen action and closes', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Demo onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByRole('button', { name: 'Acciones' });
    await user.click(trigger);
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('opens from the keyboard and moves between items with the arrow keys', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Demo onDelete={onDelete} />);
    screen.getByRole('button', { name: 'Acciones' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
