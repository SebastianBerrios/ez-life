'use client';

import React from 'react';
import { forgetLocalAccount } from '../../infrastructure/auth/localAccount';
import type { LucideIcon } from 'lucide-react';
import { Plus, LogOut, LayoutDashboard, Wallet, CheckCircle2, Users, Award, Settings, User } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

interface Props {
  gamificationEnabled?: boolean;
  currentRoute: string;
  onNavigate: (route: string) => void;
  onNewMovement?: () => void;
  avatarUrl?: string;
  /** Real account display name, when the session provides one. Never invented. */
  accountName?: string;
  /** Real account email, when the session provides one. Never invented. */
  accountEmail?: string;
  onLogout?: () => void;
}

export interface NavItem {
  id: string;
  /** Desktop (sidebar / breadcrumb) label. */
  label: string;
  /** Shorter label used by the mobile bottom nav; falls back to `label`. */
  mobileLabel?: string;
  Icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Resumen', mobileLabel: 'Inicio', Icon: LayoutDashboard },
  { id: 'finances', label: 'Finanzas', Icon: Wallet },
  { id: 'control', label: 'Control & Hábitos', mobileLabel: 'Hábitos', Icon: CheckCircle2 },
  { id: 'shared-space', label: 'Espacio Compartido', Icon: Users },
  { id: 'progress', label: 'Mi Progreso', Icon: Award },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
];

// Mobile keeps four destinations around the central "+"; Espacio Compartido and Mi Progreso are
// reached from Inicio and Ajustes (transitional entry rows until the Phase 4 cards).
const PRIMARY_ROUTE_IDS = ['dashboard', 'finances', 'control', 'settings'];
export const primaryNavItems: NavItem[] = navItems.filter((item) => PRIMARY_ROUTE_IDS.includes(item.id));

/** Routes whose content depends on the shared month selector. */
export const MONTH_SELECTOR_ROUTES = ['dashboard', 'finances'];

const NEW_MOVEMENT_LABEL = 'Registrar nuevo movimiento';

function MobileNavButton({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: (route: string) => void }) {
  const { id, label, mobileLabel, Icon } = item;
  return (
    <button
      type="button"
      data-route-id={id}
      onClick={() => onNavigate(id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
      <span className="font-mono text-label-mono-xs uppercase">{mobileLabel ?? label}</span>
    </button>
  );
}

function AccountAvatar({ avatarUrl, className }: { avatarUrl?: string; className?: string }) {
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt="Foto de perfil" className={cn('rounded-full border border-border object-cover', className)} />
  ) : (
    <span className={cn('flex items-center justify-center rounded-full bg-primary text-primary-foreground', className)} aria-hidden="true">
      <User className="size-4" />
    </span>
  );
}

export { AccountAvatar };

export default function Navigation({
  gamificationEnabled = true,
  currentRoute,
  onNavigate,
  onNewMovement,
  avatarUrl,
  accountName,
  accountEmail,
  onLogout,
}: Props) {
  const isOnline = useOnlineStatus();

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    forgetLocalAccount();
    onLogout?.();
    await supabase.auth.signOut({ scope: 'local' });
  };

  const [mobileLeft, mobileRight] = [primaryNavItems.slice(0, 2), primaryNavItems.slice(2)];
  const accountTitle = accountName ?? accountEmail;
  const accountSubtitle = accountName ? accountEmail : undefined;

  return (
    <>
      {/* ── Mobile Bottom Nav ─────────────────────────────────── */}
      <nav
        className="fixed bottom-0 z-40 w-full border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegación principal"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {mobileLeft.map((item) => (
            <MobileNavButton key={item.id} item={item} active={currentRoute === item.id} onNavigate={onNavigate} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onNewMovement?.()}
              aria-label={NEW_MOVEMENT_LABEL}
              className="-mt-6 flex size-14 items-center justify-center rounded-xl border border-primary bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:shadow-focus active:translate-y-px"
            >
              <Plus className="size-6" strokeWidth={2.25} />
            </button>
          </div>
          {mobileRight.map((item) => (
            <MobileNavButton key={item.id} item={item} active={currentRoute === item.id} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col overflow-y-auto border-r border-border bg-card md:flex"
        aria-label="Barra lateral"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 px-5">
          <h1 className="text-headline-md font-semibold tracking-tight text-foreground">
            ez<span className="text-primary">·</span>life
          </h1>
          <span
            role="img"
            aria-label={isOnline ? 'En línea' : 'Sin conexión'}
            title={isOnline ? 'En línea' : 'Sin conexión'}
            className={cn(
              'size-2 rounded-full',
              isOnline ? 'bg-primary motion-safe:animate-pulse' : 'bg-subtle'
            )}
          />
        </div>

        <div className="shrink-0 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={onNewMovement}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:shadow-focus"
          >
            <Plus className="size-4" />
            Nuevo Registro
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Secciones">
          {navItems.filter((item) => item.id !== 'progress' || gamificationEnabled).map(({ id, label, Icon }) => {
            const active = currentRoute === id;
            return (
              <button
                type="button"
                key={id}
                data-route-id={id}
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus-visible:shadow-focus',
                  active ? 'bg-surface-2 font-medium text-foreground' : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 p-3">
          <div className="rounded-lg border border-border bg-background p-2">
            <div className="flex items-center gap-2">
              <AccountAvatar avatarUrl={avatarUrl} className="size-8 shrink-0" />
              <div className="min-w-0 flex-1">
                {accountTitle && <p className="truncate text-body-md font-medium text-foreground">{accountTitle}</p>}
                {accountSubtitle && <p className="truncate font-mono text-label-mono-xs text-muted-foreground">{accountSubtitle}</p>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 border-t border-border pt-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:shadow-focus-destructive"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
