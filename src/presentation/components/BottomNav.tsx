'use client';

import React from 'react';
import { Plus, LogOut, LayoutDashboard, ArrowLeftRight, Target, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';

interface Props {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onNewMovement?: () => void;
  avatarUrl?: string;
  onLogout?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Resumen', Icon: LayoutDashboard },
  { id: 'movements', label: 'Movimientos', Icon: ArrowLeftRight },
  { id: 'goals', label: 'Metas', Icon: Target },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
];

export default function Navigation({ currentRoute, onNavigate, onNewMovement, avatarUrl, onLogout }: Props) {
  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    onLogout?.();
  };

  return (
    <>
      {/* ── Mobile Bottom Nav ─────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 w-full bg-card border-t border-border pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.06)] z-40"
        aria-label="Navegación principal"
      >
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ id, label, Icon }) => {
            const active = currentRoute === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors
                  ${active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-56 lg:w-64 h-screen fixed left-0 top-0 bg-card border-r border-border overflow-y-auto z-40"
        aria-label="Barra lateral"
      >
        {/* Logo + theme */}
        <div className="flex items-center justify-between px-5 py-5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">ez-life</h1>
          </div>
          <ThemeToggle />
        </div>

        {/* New movement button */}
        {onNewMovement && (
          <div className="px-4 mb-4 shrink-0">
            <button
              onClick={onNewMovement}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 shadow-sm transition-colors font-semibold text-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ id, label, Icon }) => {
            const active = currentRoute === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm
                  ${active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 1.8} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer: avatar + logout */}
        <div className="px-3 py-4 border-t border-border shrink-0 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>

          {avatarUrl && (
            <div className="flex items-center gap-2 px-3 py-2 mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt="Foto de perfil"
                className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
              />
              <span className="text-xs text-muted-foreground truncate">Mi cuenta</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
