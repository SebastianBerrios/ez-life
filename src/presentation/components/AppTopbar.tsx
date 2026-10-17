'use client';

import React from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { MONTH_SELECTOR_ROUTES, navItems, AccountAvatar } from './BottomNav';
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

/** Desktop-only sticky topbar: breadcrumb + shared month selector on the left, bell + avatar on the right. */
export default function AppTopbar({ currentRoute, refDate, onShiftMonth, avatarUrl, hasUnreadNotifications, onOpenNotifications, onOpenSearch }: Props) {
  const routeLabel = navItems.find((item) => item.id === currentRoute)?.label ?? '';
  const showMonth = MONTH_SELECTOR_ROUTES.includes(currentRoute);

  return (
    <header
      aria-label="Barra superior"
      className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md md:flex lg:px-10"
    >
      <div className="flex min-w-0 items-center gap-4">
        <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-body-md">
          <span className="text-muted-foreground">Inicio</span>
          <ChevronRight className="size-3.5 text-subtle" aria-hidden="true" />
          <span className="font-medium text-foreground" aria-current="page">{routeLabel}</span>
        </nav>
        {showMonth && (
          <>
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <MonthSelector
              refDate={refDate}
              onPrevious={() => onShiftMonth(-1)}
              onNext={() => onShiftMonth(1)}
              className="rounded-lg border border-border bg-card"
            />
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onOpenSearch && <SearchButton variant="bar" onClick={onOpenSearch} />}
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
        <AccountAvatar avatarUrl={avatarUrl} className="size-8" />
      </div>
    </header>
  );
}
