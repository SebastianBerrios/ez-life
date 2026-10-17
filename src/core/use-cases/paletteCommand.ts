import type { PaletteEntry, PaletteFinancesTab } from './buildPaletteIndex';

export type PaletteQuickRecordTab = 'expense' | 'income' | 'transfer' | 'habit' | 'goal';
export type PaletteQuickRecordKind = 'habit' | 'task' | 'goal' | 'savings-goal';

export interface MovementFocus { kind: 'movement'; id: string; date?: Date }
export interface ControlFocus { kind: 'habit' | 'task' | 'goal' | 'savings-goal'; id: string }
export interface AccountFocus { kind: 'account'; id: string }

/** Item the destination screen should reveal after a navigation. */
export type FocusTarget = MovementFocus | ControlFocus | AccountFocus;

export const isMovementFocus = (target: FocusTarget | undefined): target is MovementFocus => target?.kind === 'movement';
export const isAccountFocus = (target: FocusTarget | undefined): target is AccountFocus => target?.kind === 'account';
export const isControlFocus = (target: FocusTarget | undefined): target is ControlFocus =>
  target?.kind === 'habit' || target?.kind === 'task' || target?.kind === 'goal' || target?.kind === 'savings-goal';

export interface NavigateOptions {
  financesTab?: PaletteFinancesTab;
  focus?: FocusTarget;
}

/** What selecting a palette entry asks the shell to do. */
export type PaletteCommand =
  | { type: 'quick-record'; tab: PaletteQuickRecordTab; kind?: PaletteQuickRecordKind }
  | { type: 'navigate'; route: string; options?: NavigateOptions }
  | { type: 'toggle-theme' };

/** Single mapping from an entry to the shell call it triggers (so the component stays declarative). */
export function paletteCommand(entry: PaletteEntry): PaletteCommand {
  const { payload } = entry;
  switch (payload.type) {
    case 'action':
      switch (payload.action) {
        case 'new-expense': return { type: 'quick-record', tab: 'expense' };
        case 'new-income': return { type: 'quick-record', tab: 'income' };
        case 'transfer': return { type: 'quick-record', tab: 'transfer' };
        case 'new-habit': return { type: 'quick-record', tab: 'habit', kind: 'habit' };
        case 'new-task': return { type: 'quick-record', tab: 'habit', kind: 'task' };
        case 'new-goal': return { type: 'quick-record', tab: 'goal', kind: 'goal' };
        case 'new-savings-goal': return { type: 'quick-record', tab: 'goal', kind: 'savings-goal' };
        case 'toggle-theme': return { type: 'toggle-theme' };
      }
      break;
    case 'route':
      return { type: 'navigate', route: payload.route, options: payload.financesTab ? { financesTab: payload.financesTab } : undefined };
    case 'movement':
      return { type: 'navigate', route: 'finances', options: { financesTab: 'movements', focus: { kind: 'movement', id: payload.id, date: payload.date } } };
    case 'account':
      return { type: 'navigate', route: 'settings', options: { focus: { kind: 'account', id: payload.id } } };
    default:
      return { type: 'navigate', route: 'control', options: { focus: { kind: payload.type, id: payload.id } } };
  }
  return { type: 'navigate', route: 'dashboard' };
}
