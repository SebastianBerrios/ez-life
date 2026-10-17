'use client';

import React from 'react';
import Navigation from './BottomNav';
import AppTopbar from './AppTopbar';
import MobileHeader from './MobileHeader';
import type { NavigateOptions } from '../../core/use-cases/paletteCommand';

interface Props {
  children: React.ReactNode;
  gamificationEnabled?: boolean;
  currentRoute: string;
  onNavigate: (route: string, options?: NavigateOptions) => void;
  onNewMovement?: () => void;
  avatarUrl?: string;
  accountName?: string;
  accountEmail?: string;
  onLogout?: () => void;
  onOpenNotifications?: () => void;
  /** Opens the ⌘K palette (topbar search field, mobile header icon). */
  onOpenSearch?: () => void;
  hasUnreadNotifications?: boolean;
  /** First day of the month shown by the shared month selector. */
  refDate: Date;
  /** Moves the shared month by `delta` months (negative = earlier). */
  onShiftMonth: (delta: number) => void;
}

export default function Layout({
  gamificationEnabled,
  children,
  currentRoute,
  onNavigate,
  onNewMovement,
  avatarUrl,
  accountName,
  accountEmail,
  onLogout,
  onOpenNotifications,
  onOpenSearch,
  hasUnreadNotifications,
  refDate,
  onShiftMonth,
}: Props) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation
        gamificationEnabled={gamificationEnabled}
        currentRoute={currentRoute}
        onNavigate={onNavigate}
        onNewMovement={onNewMovement}
        avatarUrl={avatarUrl}
        accountName={accountName}
        accountEmail={accountEmail}
        onLogout={onLogout}
      />

      <div className="md:ml-60">
        <AppTopbar
          currentRoute={currentRoute}
          refDate={refDate}
          onShiftMonth={onShiftMonth}
          avatarUrl={avatarUrl}
          hasUnreadNotifications={hasUnreadNotifications}
          onOpenNotifications={onOpenNotifications}
          onOpenSearch={onOpenSearch}
        />
        <main className="mx-auto w-full max-w-[1680px] px-4 pb-24 md:px-6 md:pb-10 md:pt-6 lg:px-10">
          <MobileHeader
            currentRoute={currentRoute}
            refDate={refDate}
            onShiftMonth={onShiftMonth}
            avatarUrl={avatarUrl}
            hasUnreadNotifications={hasUnreadNotifications}
            onOpenNotifications={onOpenNotifications}
            onOpenSearch={onOpenSearch}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
