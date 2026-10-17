import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Sparkline from './Sparkline';
import { Amount, HideAmountsToggle, MASKED_AMOUNT } from './Amount';
import FocusPanel, { FOCUS_VISIBLE_ITEMS } from './FocusPanel';
import PrimaryGoalCard from './PrimaryGoalCard';
import type { FocusItem } from '../../../core/use-cases/buildFocusToday';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useHideAmounts, HIDE_AMOUNTS_STORAGE_KEY } from '../../hooks/useHideAmounts';

describe('Sparkline', () => {
  const point = (value: number, day: number) => ({ date: new Date(2026, 9, day), value });

  it('draws one polyline over the given points and is labelled for assistive tech', () => {
    render(<Sparkline label="Evolución" points={[point(0, 1), point(100, 2), point(50, 3)]} />);
    const svg = screen.getByRole('img', { name: 'Evolución' });
    const polyline = svg.querySelector('polyline');
    expect(polyline?.getAttribute('points')?.split(' ')).toHaveLength(3);
  });

  it('renders nothing with fewer than two points and survives a flat series', () => {
    const { container, rerender } = render(<Sparkline label="x" points={[point(5, 1)]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Sparkline label="x" points={[point(5, 1), point(5, 2)]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});

describe('Amount / HideAmountsToggle', () => {
  it('renders the money, or a mask with an accessible label when hidden', () => {
    const { rerender } = render(<Amount cents={123456} />);
    expect(screen.getByText('1,234.56')).toBeInTheDocument();
    rerender(<Amount cents={123456} hidden data-testid="amt" />);
    expect(screen.queryByText('1,234.56')).toBeNull();
    expect(screen.getByLabelText('Monto oculto')).toHaveTextContent(MASKED_AMOUNT);
    expect(screen.getByTestId('amt')).toBeInTheDocument();
  });

  it('the toggle exposes its state with aria-pressed and calls back', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<HideAmountsToggle hidden={false} onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: 'Ocultar montos' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<HideAmountsToggle hidden onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Mostrar montos' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('FocusPanel', () => {
  const habit = (id: number, overrides: Partial<FocusItem> = {}): FocusItem => ({ kind: 'habit', id: `h${id}`, title: `Hábito ${id}`, done: false, streak: 0, streakUnit: 'days', ...overrides });

  it('limits the visible rows but counts all of them in "Ver todo"', () => {
    const items = Array.from({ length: FOCUS_VISIBLE_ITEMS + 2 }, (_, i) => habit(i));
    render(<FocusPanel items={items} desktop={false} onToggle={vi.fn()} onSeeAll={vi.fn()} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(FOCUS_VISIBLE_ITEMS);
    expect(screen.getByRole('button', { name: `Ver todo (${FOCUS_VISIBLE_ITEMS + 2})` })).toBeInTheDocument();
  });

  it('labels a weekly streak in weeks and hides a zero streak', () => {
    render(<FocusPanel items={[habit(1, { streak: 2, streakUnit: 'weeks' }), habit(2, { streak: 0 })]} desktop={false} onToggle={vi.fn()} onSeeAll={vi.fn()} />);
    expect(screen.getByTestId('focus-item-habit-h1')).toHaveTextContent('Racha 2 sem');
    expect(screen.getByTestId('focus-item-habit-h2')).not.toHaveTextContent('Racha');
  });

  it('done items are checked, disabled and do not call back; pending ones do', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<FocusPanel items={[habit(1), habit(2, { done: true })]} desktop={false} onToggle={onToggle} onSeeAll={vi.fn()} />);
    const [pending, done] = screen.getAllByRole('checkbox');
    expect(pending).toHaveAttribute('aria-checked', 'false');
    expect(done).toHaveAttribute('aria-checked', 'true');
    expect(done).toBeDisabled();
    await user.click(done);
    expect(onToggle).not.toHaveBeenCalled();
    await user.click(pending);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }));
  });

  it('desktop shows the pending counter instead of the header link', () => {
    render(<FocusPanel items={[habit(1), habit(2, { done: true })]} desktop onToggle={vi.fn()} onSeeAll={vi.fn()} />);
    expect(screen.getByText('1 Pendiente')).toBeInTheDocument();
  });
});

describe('PrimaryGoalCard (empty)', () => {
  it('renders nothing on mobile and an invitation to create a goal on desktop', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const { container, rerender } = render(<PrimaryGoalCard goal={null} desktop={false} onContribute={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PrimaryGoalCard goal={null} desktop onContribute={vi.fn()} onCreate={onCreate} />);
    expect(screen.getByText('Sin meta de ahorro activa')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear meta' }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe('useMediaQuery', () => {
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  it('is false when matchMedia does not exist', () => {
    // @ts-expect-error simulating an environment without matchMedia
    window.matchMedia = undefined;
    expect(renderHook(() => useMediaQuery('(min-width: 768px)')).result.current).toBe(false);
  });

  it('reads the match and follows changes', () => {
    let matches = true;
    const listeners = new Set<() => void>();
    window.matchMedia = (() => ({
      get matches() { return matches; },
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    })) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
    act(() => { matches = false; listeners.forEach(cb => cb()); });
    expect(result.current).toBe(false);
  });
});

describe('useHideAmounts', () => {
  afterEach(() => window.localStorage.clear());

  it('defaults to visible, toggles and persists', () => {
    const { result } = renderHook(() => useHideAmounts());
    expect(result.current.hidden).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.hidden).toBe(true);
    expect(window.localStorage.getItem(HIDE_AMOUNTS_STORAGE_KEY)).toBe('1');
  });

  it('reads a stored choice', () => {
    window.localStorage.setItem(HIDE_AMOUNTS_STORAGE_KEY, '1');
    const { result } = renderHook(() => useHideAmounts());
    expect(result.current.hidden).toBe(true);
  });
});
