import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVEAL_HIGHLIGHT_MS, useRevealTarget } from './useRevealTarget';

function Probe({ testId, nonce = 1, ready = true, onDone, showCard = true }: {
  testId?: string; nonce?: number; ready?: boolean; onDone?: () => void; showCard?: boolean;
}) {
  useRevealTarget(testId, nonce, ready, onDone);
  return <ul>{showCard && <li data-testid="task-card-1">Tarea</li>}</ul>;
}

let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRevealTarget', () => {
  it('scrolls to, focuses and highlights the element, then removes the highlight', () => {
    const onDone = vi.fn();
    const { getByTestId } = render(<Probe testId="task-card-1" onDone={onDone} />);
    const card = getByTestId('task-card-1');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(document.activeElement).toBe(card);
    expect(card).toHaveAttribute('tabindex', '-1');
    expect(card).toHaveAttribute('data-reveal', 'true');
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(REVEAL_HIGHLIGHT_MS + 10); });
    expect(card).not.toHaveAttribute('data-reveal');
  });

  it('keeps the highlight when onDone clears the target', () => {
    function Host() {
      const [id, setId] = React.useState<string | undefined>('task-card-1');
      return <Probe testId={id} onDone={() => setId(undefined)} />;
    }
    const { getByTestId } = render(<Host />);
    expect(getByTestId('task-card-1')).toHaveAttribute('data-reveal', 'true');
  });

  it('smooth-scrolls only when motion is allowed', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<Probe testId="task-card-1" />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('respects prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<Probe testId="task-card-1" />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
  });

  it('waits until the data is ready', () => {
    const onDone = vi.fn();
    const { rerender, getByTestId } = render(<Probe testId="task-card-1" ready={false} onDone={onDone} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    rerender(<Probe testId="task-card-1" ready onDone={onDone} />);
    expect(getByTestId('task-card-1')).toHaveAttribute('data-reveal', 'true');
  });

  it('does nothing without a target', () => {
    const onDone = vi.fn();
    render(<Probe onDone={onDone} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('gives up quietly (and still reports done) when the element never appears', () => {
    const onDone = vi.fn();
    render(<Probe testId="task-card-9" onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('finds an element that renders a few frames later', () => {
    const onDone = vi.fn();
    const { rerender, getByTestId } = render(<Probe testId="task-card-1" showCard={false} onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(40); });
    rerender(<Probe testId="task-card-1" showCard onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(40); });
    expect(getByTestId('task-card-1')).toHaveAttribute('data-reveal', 'true');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reveals again for a new nonce', () => {
    const { rerender } = render(<Probe testId="task-card-1" nonce={1} />);
    rerender(<Probe testId="task-card-1" nonce={2} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
