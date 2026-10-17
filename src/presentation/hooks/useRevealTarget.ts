import { useEffect, useRef } from 'react';

/** How long the highlight stays on the revealed element. */
export const REVEAL_HIGHLIGHT_MS = 2200;
/** Frames to keep looking for the element (it may appear after a tab/layout switch inside the screen). */
const MAX_ATTEMPTS = 60;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reveals the element with `data-testid === testId` after a navigation asked for it (⌘K): scrolls it
 * into view (smooth only if motion is allowed), highlights it briefly with `data-reveal` and moves
 * keyboard focus to it. Runs once per `nonce`, only when `ready` (data loaded). Keeps looking for a few
 * frames because the element can appear after the screen switches tab or layout. Always calls
 * `onDone` (even when the element does not exist, e.g. it was deleted meanwhile).
 */
export function useRevealTarget(testId: string | undefined, nonce: number | undefined, ready: boolean, onDone?: () => void): void {
  const done = useRef(onDone);
  done.current = onDone;
  // The highlight outlives the effect on purpose: `onDone` usually clears the target, which re-runs the effect.
  const highlight = useRef<{ element: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => () => {
    if (!highlight.current) return;
    clearTimeout(highlight.current.timer);
    highlight.current.element.removeAttribute('data-reveal');
  }, []);

  useEffect(() => {
    if (!testId || !ready) return;
    let frame = 0;
    let attempts = 0;

    const find = () => {
      const element = document.querySelector<HTMLElement>(`[data-testid="${testId.replace(/"/g, '\\"')}"]`);
      if (!element) {
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          frame = requestAnimationFrame(find);
        } else {
          done.current?.();
        }
        return;
      }
      element.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
      if (highlight.current) {
        clearTimeout(highlight.current.timer);
        highlight.current.element.removeAttribute('data-reveal');
      }
      element.setAttribute('data-reveal', 'true');
      highlight.current = { element, timer: setTimeout(() => element.removeAttribute('data-reveal'), REVEAL_HIGHLIGHT_MS) };
      done.current?.();
    };
    find();

    return () => cancelAnimationFrame(frame);
  }, [testId, nonce, ready]);
}
