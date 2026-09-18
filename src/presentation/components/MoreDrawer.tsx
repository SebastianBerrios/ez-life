'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { NavItem } from './BottomNav';

interface Props {
  overflowNavItems: NavItem[];
  currentRoute: string;
  onNavigate: (route: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Historia 1 (spec 002-mobile-nav-loans-ux): drawer tipo bottom-sheet
// reutilizando el Dialog existente (Principio I/VII, research.md #1) — se
// ancla abajo y ocupa el ancho completo, en vez del modal centrado que usan
// los demás diálogos de MainFlow.tsx.
const MORE_DRAWER_CONTENT_CLASS =
  'bg-card inset-x-0 right-0 bottom-0 top-auto left-0 w-full max-w-full translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none border border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl max-h-[75vh] overflow-y-auto sm:max-w-full';

export default function MoreDrawer({ overflowNavItems, currentRoute, onNavigate, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent
        data-testid="more-drawer"
        showCloseButton={false}
        className={MORE_DRAWER_CONTENT_CLASS}
      >
        <div className="grid grid-cols-3 gap-3">
          {overflowNavItems.map(({ id, label, Icon }) => {
            const active = currentRoute === id;
            return (
              <button
                key={id}
                data-testid={`more-drawer-item-${id}`}
                data-route-id={id}
                onClick={() => {
                  onNavigate(id);
                  onOpenChange(false);
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl py-4 transition-colors
                  ${active
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
