import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import QuickRecordSheet, { type QuickRecordKind, type QuickRecordTab } from './QuickRecordSheet';

const sharedSpaces = vi.hoisted(() => ({
  list: [] as Array<{ id: string; name: string; members: Array<{ user_id: string }> }>,
}));

vi.mock('../hooks/useActiveSharedSpaces', () => ({ useActiveSharedSpaces: () => sharedSpaces.list }));

vi.mock('./MovementForm', () => ({
  default: function MovementFormStub(props: {
    type?: string;
    sharedSpaces?: Array<{ id: string; name: string }>;
    onComplete: () => void;
    onSavedAndNew?: () => void;
    onContinueShared?: (draft: { spaceId: string; amount: string }) => void;
  }) {
    const [text, setText] = React.useState('');
    return (
      <div data-testid="movement-form" data-type={props.type} data-spaces={props.sharedSpaces?.map(s => s.id).join(',')}>
        <input aria-label="Monto" value={text} onChange={event => setText(event.target.value)} />
        <button onClick={props.onComplete}>stub-save</button>
        <button onClick={props.onSavedAndNew}>stub-save-new</button>
        <button onClick={() => props.onContinueShared?.({ spaceId: 's1', amount: '10.00' })}>stub-share</button>
      </div>
    );
  },
}));
vi.mock('./TransferForm', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => <div data-testid="transfer-form"><button onClick={onComplete}>stub-transfer-save</button></div>,
}));
vi.mock('./HabitForm', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => <div data-testid="habit-form"><input aria-label="Nombre del hábito" /><button onClick={onComplete}>stub-habit-save</button></div>,
}));
vi.mock('./TaskForm', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => <div data-testid="task-form"><button onClick={onComplete}>stub-task-save</button></div>,
}));
vi.mock('./GoalForm', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => <div data-testid="goal-form"><input aria-label="Nombre de la meta" /><button onClick={onComplete}>stub-goal-save</button></div>,
}));
vi.mock('./SavingsGoalForm', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => <div data-testid="savings-goal-form"><button onClick={onComplete}>stub-savings-save</button></div>,
}));
vi.mock('./SharedMovementForm', () => ({
  default: function SharedStub(props: { spaceId: string; members: unknown[]; initial?: { amount?: string }; onComplete: () => void; onCancel: () => void }) {
    return (
      <div data-testid="shared-movement-form" data-space={props.spaceId} data-members={props.members.length} data-amount={props.initial?.amount}>
        <button onClick={props.onComplete}>stub-shared-save</button>
        <button onClick={props.onCancel}>stub-shared-cancel</button>
      </div>
    );
  },
}));

function Host({ initialTab, initialKind, onSaved, onOpenChange }: { initialTab?: QuickRecordTab; initialKind?: QuickRecordKind; onSaved: (kind: string) => void; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>host-open</button>
      <QuickRecordSheet
        open={open}
        onOpenChange={value => { setOpen(value); onOpenChange?.(value); }}
        userId="A"
        initialTab={initialTab}
        initialKind={initialKind}
        onSaved={onSaved}
      />
    </>
  );
}

describe('QuickRecordSheet: initialKind (deep links from Control)', () => {
  it.each([
    ['habit', 'Hábito', 'habit-form'],
    ['task', 'Hábito', 'task-form'],
    ['goal', 'Meta', 'goal-form'],
    ['savings-goal', 'Meta', 'savings-goal-form'],
  ] as const)('opens "%s" on the %s tab with its form already shown', (kind, tab, testId) => {
    render(<Host initialKind={kind} onSaved={vi.fn()} />);
    expect(within(screen.getByRole('tablist', { name: 'Tipo de registro' })).getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('the inner switch reflects the kind and can still be changed', async () => {
    const user = userEvent.setup();
    render(<Host initialKind="savings-goal" onSaved={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Ahorro' })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(screen.getByRole('tablist', { name: 'Qué tipo de meta' })).getByRole('tab', { name: 'Meta' }));
    expect(screen.getByTestId('goal-form')).toBeInTheDocument();
  });

  it('an explicit initialTab wins over the tab implied by the kind; no kind keeps the old defaults', () => {
    const { unmount } = render(<Host initialTab="income" initialKind="task" onSaved={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Ingreso' })).toHaveAttribute('aria-selected', 'true');
    unmount();
    render(<Host initialTab="habit" onSaved={vi.fn()} />);
    expect(screen.getByTestId('habit-form')).toBeInTheDocument();
  });

  it('reports what was saved through the kind it opened on', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<Host initialKind="task" onSaved={onSaved} />);
    await user.click(screen.getByRole('button', { name: 'stub-task-save' }));
    expect(onSaved).toHaveBeenCalledWith('task');
  });
});

describe('QuickRecordSheet', () => {
  it('is titled "Nuevo Registro" and offers the five tabs in order', () => {
    render(<Host onSaved={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Nuevo Registro' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).toEqual(['Gasto', 'Ingreso', 'Mover', 'Hábito', 'Meta']);
    expect(screen.getByRole('tab', { name: 'Gasto' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on "Gasto" by default and on the requested tab otherwise', () => {
    const { unmount } = render(<Host onSaved={vi.fn()} />);
    expect(screen.getByTestId('movement-form')).toHaveAttribute('data-type', 'EXPENSE');
    unmount();
    render(<Host initialTab="transfer" onSaved={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Mover' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('transfer-form')).toBeInTheDocument();
  });

  it('fixes the movement type from the tab and keeps what was typed when switching Gasto <-> Ingreso', async () => {
    const user = userEvent.setup();
    render(<Host onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText('Monto'), '45');
    await user.click(screen.getByRole('tab', { name: 'Ingreso' }));
    expect(screen.getByTestId('movement-form')).toHaveAttribute('data-type', 'INCOME');
    expect(screen.getByLabelText('Monto')).toHaveValue('45');
    await user.click(screen.getByRole('tab', { name: 'Gasto' }));
    expect(screen.getByTestId('movement-form')).toHaveAttribute('data-type', 'EXPENSE');
    expect(screen.getByLabelText('Monto')).toHaveValue('45');
  });

  it('renders the form of every tab, with an inner switch for Hábito/Tarea and Meta/Ahorro', async () => {
    const user = userEvent.setup();
    render(<Host onSaved={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: 'Mover' }));
    expect(screen.getByTestId('transfer-form')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Hábito' }));
    expect(screen.getByTestId('habit-form')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Tarea' }));
    expect(screen.getByTestId('task-form')).toBeInTheDocument();
    expect(screen.queryByTestId('habit-form')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Meta' }));
    expect(screen.getByTestId('goal-form')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Ahorro' }));
    expect(screen.getByTestId('savings-goal-form')).toBeInTheDocument();
    expect(screen.queryByTestId('goal-form')).not.toBeInTheDocument();
  });

  it.each([
    ['Gasto', 'stub-save', 'movement'],
    ['Mover', 'stub-transfer-save', 'transfer'],
    ['Hábito', 'stub-habit-save', 'habit'],
    ['Meta', 'stub-goal-save', 'goal'],
  ])('reports the saved kind and closes after saving from "%s"', async (tabName, button, kind) => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<Host onSaved={onSaved} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('tab', { name: tabName }));
    await user.click(screen.getByRole('button', { name: button }));
    expect(onSaved).toHaveBeenCalledWith(kind);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('reports "task" and "savings-goal" from the inner switches', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<Host initialTab="habit" onSaved={onSaved} />);
    await user.click(screen.getByRole('tab', { name: 'Tarea' }));
    await user.click(screen.getByRole('button', { name: 'stub-task-save' }));
    expect(onSaved).toHaveBeenLastCalledWith('task');

    await user.click(screen.getByRole('button', { name: 'host-open' }));
    await user.click(await screen.findByRole('tab', { name: 'Meta' }));
    await user.click(screen.getByRole('tab', { name: 'Ahorro' }));
    await user.click(screen.getByRole('button', { name: 'stub-savings-save' }));
    expect(onSaved).toHaveBeenLastCalledWith('savings-goal');
  });

  it('"Guardar y registrar otro" reports the save but keeps the sheet open', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<Host onSaved={onSaved} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'stub-save-new' }));
    expect(onSaved).toHaveBeenCalledWith('movement');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Host onSaved={vi.fn()} onOpenChange={onOpenChange} />);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets the tab and every draft when the sheet is closed and reopened', async () => {
    const user = userEvent.setup();
    render(<Host onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText('Monto'), '99');
    await user.click(screen.getByRole('tab', { name: 'Meta' }));
    await user.click(screen.getByRole('tab', { name: 'Ahorro' }));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'host-open' }));

    expect(await screen.findByRole('tab', { name: 'Gasto' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Monto')).toHaveValue('');
    await user.click(screen.getByRole('tab', { name: 'Meta' }));
    expect(screen.getByTestId('goal-form')).toBeInTheDocument(); // inner switch is back on "Meta"
  });

  it('puts focus on the first field when it opens on a tab without an amount', async () => {
    render(<Host initialTab="habit" onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Nombre del hábito')).toHaveFocus());
  });

  describe('shared space', () => {
    it('passes the active spaces to the movement form', () => {
      sharedSpaces.list = [{ id: 's1', name: 'Casa', members: [{ user_id: 'A' }, { user_id: 'B' }] }];
      render(<Host onSaved={vi.fn()} />);
      expect(screen.getByTestId('movement-form')).toHaveAttribute('data-spaces', 's1');
    });

    it('swaps the body for the shared-expense form, pre-filled, and can go back to the draft', async () => {
      sharedSpaces.list = [{ id: 's1', name: 'Casa', members: [{ user_id: 'A' }, { user_id: 'B' }] }];
      const user = userEvent.setup();
      render(<Host onSaved={vi.fn()} />);
      await user.type(screen.getByLabelText('Monto'), '10');
      await user.click(screen.getByRole('button', { name: 'stub-share' }));

      const shared = screen.getByTestId('shared-movement-form');
      expect(shared).toHaveAttribute('data-space', 's1');
      expect(shared).toHaveAttribute('data-members', '2');
      expect(shared).toHaveAttribute('data-amount', '10.00');
      expect(screen.getByRole('tab', { name: 'Gasto' }).closest('.hidden')).not.toBeNull(); // tabs + draft stay mounted, hidden

      await user.click(screen.getByRole('button', { name: 'stub-shared-cancel' }));
      expect(screen.queryByTestId('shared-movement-form')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Monto')).toHaveValue('10'); // the draft survived
    });

    it('reports a "movement" and closes when the shared expense is saved', async () => {
      sharedSpaces.list = [{ id: 's1', name: 'Casa', members: [{ user_id: 'A' }] }];
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const onOpenChange = vi.fn();
      render(<Host onSaved={onSaved} onOpenChange={onOpenChange} />);
      await user.click(screen.getByRole('button', { name: 'stub-share' }));
      await user.click(screen.getByRole('button', { name: 'stub-shared-save' }));
      expect(onSaved).toHaveBeenCalledWith('movement');
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
  });
});
