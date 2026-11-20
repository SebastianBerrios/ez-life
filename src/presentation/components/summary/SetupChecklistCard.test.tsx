import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { SetupChecklist } from '../../../core/domain/models/types';
import SetupChecklistCard from './SetupChecklistCard';

const PARTIAL_CHECKLIST: SetupChecklist = {
  items: [
    { key: 'income', done: true },
    { key: 'accounts', done: true },
    { key: 'cards', done: false },
    { key: 'loans', done: false },
  ],
  doneCount: 2,
  visible: true,
  nextPending: 'cards',
};

describe('SetupChecklistCard (T077)', () => {
  it('renders counter, items, invokes onOpenStep with clicked key, and invokes onDismiss', async () => {
    const user = userEvent.setup();
    const onOpenStep = vi.fn();
    const onDismiss = vi.fn();

    render(
      <SetupChecklistCard
        checklist={PARTIAL_CHECKLIST}
        onOpenStep={onOpenStep}
        onDismiss={onDismiss}
      />,
    );

    const card = screen.getByTestId('setup-checklist');
    expect(card).toHaveAttribute('data-tour', 'setup');
    expect(screen.getByRole('heading', { name: 'Completa tu configuración · 2 de 4' })).toBeInTheDocument();

    expect(screen.getByTestId('setup-checklist-item-income')).toHaveAttribute('data-done', 'true');
    expect(screen.getByTestId('setup-checklist-item-cards')).toHaveAttribute('data-done', 'false');

    await user.click(screen.getByTestId('setup-checklist-item-cards'));
    expect(onOpenStep).toHaveBeenCalledWith('cards');

    await user.click(screen.getByRole('button', { name: 'Descartar lista de configuración' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when visible is false', () => {
    render(
      <SetupChecklistCard
        checklist={{ ...PARTIAL_CHECKLIST, visible: false }}
        onOpenStep={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('setup-checklist')).not.toBeInTheDocument();
  });
});
