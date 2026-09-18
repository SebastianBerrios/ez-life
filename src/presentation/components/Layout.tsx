'use client';

import React from 'react';
import Navigation from './BottomNav';

interface Props {
  children: React.ReactNode;
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenMore?: () => void;
  onNewMovement?: () => void;
  avatarUrl?: string;
  onLogout?: () => void;
  onOpenNotifications?: () => void;
}

export default function Layout({ children, currentRoute, onNavigate, onOpenMore, onNewMovement, avatarUrl, onLogout, onOpenNotifications }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <Navigation
        currentRoute={currentRoute}
        onNavigate={onNavigate}
        onOpenMore={onOpenMore}
        onNewMovement={onNewMovement}
        avatarUrl={avatarUrl}
        onLogout={onLogout}
        onOpenNotifications={onOpenNotifications}
      />

      <main className="flex-1 w-full pb-20 md:pb-0 md:ml-56 lg:ml-64">
        <div className="max-w-3xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
