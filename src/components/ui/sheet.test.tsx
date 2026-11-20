import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

function Harness({ withFooter = false }: { withFooter?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>Abrir hoja</SheetTrigger>
      <SheetContent
        footer={withFooter ? <button type="button">Guardar sticky</button> : undefined}
      >
        <SheetHeader>
          <SheetTitle>Nuevo registro</SheetTitle>
          <SheetDescription>Registra un movimiento</SheetDescription>
        </SheetHeader>
        <p>Contenido de la hoja</p>
        {!withFooter && (
          <SheetFooter>
            <button type="button">Guardar</button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

describe('Sheet', () => {
  it('is closed by default and opens from its trigger with an accessible title', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir hoja' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo registro' });
    expect(dialog).toHaveAttribute('data-slot', 'sheet-content');
    expect(dialog).toHaveAttribute('data-side', 'bottom');
    expect(dialog.className).toContain('max-h-[92dvh]');
    expect(screen.getByText('Contenido de la hoja')).toBeInTheDocument();
  });

  it('renders sticky footer with safe-area padding', async () => {
    const user = userEvent.setup();
    render(<Harness withFooter />);
    await user.click(screen.getByRole('button', { name: 'Abrir hoja' }));
    const dialog = await screen.findByRole('dialog');
    const stickyFooter = dialog.querySelector('[data-slot="sheet-sticky-footer"]');
    expect(stickyFooter).not.toBeNull();
    expect(stickyFooter?.className).toContain('safe-area-inset-bottom');
    expect(screen.getByRole('button', { name: 'Guardar sticky' })).toBeInTheDocument();
  });

  it('closes with the close button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir hoja' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir hoja' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
