import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
  /** Listener is attached only while true. Default true. */
  enabled?: boolean;
  /**
   * By default the combo does nothing while a dialog (`role="dialog"`) is open, so a shortcut never
   * stacks a second modal on top of a form. Dialogs matching this selector do not block it
   * (the palette itself, so the same combo can close it).
   */
  allowInDialog?: string;
}

interface Combo {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

function parseCombo(combo: string): Combo {
  const parts = combo.toLowerCase().split('+').map(part => part.trim()).filter(Boolean);
  const key = parts[parts.length - 1] ?? '';
  const has = (name: string) => parts.slice(0, -1).includes(name);
  return { key, mod: has('mod'), ctrl: has('ctrl'), meta: has('meta'), shift: has('shift'), alt: has('alt') };
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform || navigator.userAgent || '');
}

/** Label of the primary modifier for display: "⌘" on Apple platforms, "Ctrl" elsewhere. */
export function modKeyLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

function matches(event: KeyboardEvent, combo: Combo, mac: boolean): boolean {
  if (event.key.toLowerCase() !== combo.key) return false;
  const wantMeta = combo.meta || (combo.mod && mac);
  const wantCtrl = combo.ctrl || (combo.mod && !mac);
  return event.metaKey === wantMeta && event.ctrlKey === wantCtrl && event.shiftKey === combo.shift && event.altKey === combo.alt;
}

function blockedByDialog(allowInDialog: string | undefined): boolean {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
  return dialogs.some(dialog => !(allowInDialog && dialog.matches(allowInDialog)));
}

/**
 * Global keyboard shortcut. `"mod+k"` is Cmd+K on Apple platforms and Ctrl+K elsewhere. Ignores IME
 * composition, key repeat and other modifiers, calls `preventDefault` when it fires and removes its
 * listener on unmount. `handler` may change every render without re-subscribing.
 */
export function useHotkey(combo: string, handler: (event: KeyboardEvent) => void, options: HotkeyOptions = {}): void {
  const { enabled = true, allowInDialog } = options;
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const parsed = parseCombo(combo);
    const mac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229 || event.repeat) return;
      if (!matches(event, parsed, mac)) return;
      if (blockedByDialog(allowInDialog)) return;
      event.preventDefault();
      latest.current(event);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [combo, enabled, allowInDialog]);
}
