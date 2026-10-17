import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMacPlatform, modKeyLabel, useHotkey, type HotkeyOptions } from './useHotkey';

function Probe({ combo = 'mod+k', onKey, options }: { combo?: string; onKey: (event: KeyboardEvent) => void; options?: HotkeyOptions }) {
  useHotkey(combo, onKey, options);
  return <input aria-label="campo" />;
}

function setPlatform(value: string) {
  Object.defineProperty(window.navigator, 'platform', { value, configurable: true });
}

afterEach(() => {
  setPlatform('Win32');
  document.body.innerHTML = '';
});

describe('useHotkey', () => {
  it('fires on Ctrl+K outside Apple platforms and prevents the browser default', () => {
    setPlatform('Win32');
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    const notCancelled = fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(onKey).toHaveBeenCalledTimes(1);
    expect(notCancelled).toBe(false);
  });

  it('does not fire on Cmd+K there, and fires on Cmd+K (not Ctrl+K) on a Mac', () => {
    setPlatform('Win32');
    const onKey = vi.fn();
    const { unmount } = render(<Probe onKey={onKey} />);
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    expect(onKey).not.toHaveBeenCalled();
    unmount();

    setPlatform('MacIntel');
    expect(isMacPlatform()).toBe(true);
    expect(modKeyLabel()).toBe('⌘');
    render(<Probe onKey={onKey} />);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(onKey).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'K', metaKey: true });
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it('labels the modifier "Ctrl" off Apple platforms', () => {
    setPlatform('Win32');
    expect(modKeyLabel()).toBe('Ctrl');
  });

  it('ignores other keys, extra modifiers and key repeat', () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    fireEvent.keyDown(document.body, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'k' });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, altKey: true });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, repeat: true });
    expect(onKey).not.toHaveBeenCalled();
  });

  it('ignores IME composition', () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, isComposing: true });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, keyCode: 229 });
    expect(onKey).not.toHaveBeenCalled();
  });

  it('fires while a text field has focus (the combo is not typing)', () => {
    const onKey = vi.fn();
    const { getByLabelText } = render(<Probe onKey={onKey} />);
    const input = getByLabelText('campo');
    input.focus();
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it('does not fire over another open dialog, but does over an allowed one', () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} options={{ allowInDialog: '[data-command-palette]' }} />);
    const other = document.createElement('div');
    other.setAttribute('role', 'dialog');
    document.body.appendChild(other);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(onKey).not.toHaveBeenCalled();
    other.remove();

    const palette = document.createElement('div');
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('data-command-palette', '');
    document.body.appendChild(palette);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it('is inert while disabled', () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} options={{ enabled: false }} />);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(onKey).not.toHaveBeenCalled();
  });

  it('always calls the latest handler and removes its listener on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = render(<Probe onKey={first} />);
    rerender(<Probe onKey={second} />);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('supports other combos', () => {
    const onKey = vi.fn();
    render(<Probe combo="ctrl+shift+p" onKey={onKey} />);
    fireEvent.keyDown(document.body, { key: 'P', ctrlKey: true, shiftKey: true });
    expect(onKey).toHaveBeenCalledTimes(1);
  });
});
