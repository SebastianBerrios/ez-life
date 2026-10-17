'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { MONTH_SELECTOR_ROUTES, AccountAvatar } from './BottomNav';
import MonthSelector from './MonthSelector';
import SearchButton from './SearchButton';

interface Props {
  currentRoute: string;
  refDate: Date;
  onShiftMonth: (delta: number) => void;
  avatarUrl?: string;
  hasUnreadNotifications?: boolean;
  onOpenNotifications?: () => void;
  /** Opens the ⌘K palette. */
  onOpenSearch?: () => void;
}

/** Mobile-only header: logo, month selector (Inicio / Finanzas), bell and avatar. */
export default function MobileHeader({ currentRoute, refDate, onShiftMonth, avatarUrl, hasUnreadNotifications, onOpenNotifications, onOpenSearch }: Props) {
  const showMonth = MONTH_SELECTOR_ROUTES.includes(currentRoute);

  return (
    <header aria-label="Encabezado móvil" className="flex items-center justify-between gap-2 py-2 md:hidden">
      <h1 className="text-headline-md font-semibold tracking-tight text-foreground">
        ez<span className="text-primary">·</span>life
      </h1>
      <div className="flex items-center gap-1">
        {showMonth && (
          <MonthSelector refDate={refDate} onPrevious={() => onShiftMonth(-1)} onNext={() => onShiftMonth(1)} />
        )}
        {onOpenSearch && <SearchButton variant="icon" onClick={onOpenSearch} />}
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Ver notificaciones"
            className="relative flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:shadow-focus"
          >
            <Bell className="size-[18px]" />
            {hasUnreadNotifications && (
              <span data-testid="unread-dot" className="absolute right-3 top-3 size-2 rounded-full bg-primary" />
            )}
          </button>
        )}
        {/* Phones have no room for it next to the month, search and bell; the account lives in Ajustes. */}
        <span className="hidden sm:inline-flex"><AccountAvatar avatarUrl={avatarUrl} className="size-8" /></span>
      </div>
    </header>
  );
}
