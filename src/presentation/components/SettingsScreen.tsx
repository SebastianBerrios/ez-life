'use client';

import React, { useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { Profile } from '../../core/domain/models/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildMovementsCsv, buildMovementsPdfTable } from '../../core/use-cases/exportMovements';
import { calendarKey } from '../../core/use-cases/calendar';
import type { AccountFocus } from '../../core/use-cases/paletteCommand';
import { downloadTextFile } from '../lib/downloadTextFile';
import { loadExportLookups } from '../lib/loadExportLookups';
import { useRevealTarget } from '../hooks/useRevealTarget';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell, Compass, Download, Edit2, FileText, ListChecks, Loader2, LogOut, Palette, User, Wallet,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';
import IncomeSourceSettings from './IncomeSourceSettings';
import PaymentAccountSettings from './PaymentAccountSettings';
import { forgetLocalAccount } from '../../infrastructure/auth/localAccount';

export type SettingsSectionId =
  | 'profile'
  | 'accounts'
  | 'notifications'
  | 'appearance'
  | 'data';

interface Props {
  userId: string;
  onEditDistribution?: () => void;
  onEditCategories?: () => void;
  onCompleteSetup?: () => void;
  onReplayTour?: () => void;
  onLogout?: () => void;
  accountName?: string;
  accountEmail?: string;
  focus?: AccountFocus;
  focusNonce?: number;
  onFocusHandled?: () => void;
  editAccountId?: string;
  editAccountNonce?: number;
  onEditAccountHandled?: () => void;
}

export default function SettingsScreen({
  userId,
  onEditDistribution,
  onEditCategories,
  onCompleteSetup,
  onReplayTour,
  onLogout,
  accountName,
  accountEmail,
  focus,
  focusNonce,
  onFocusHandled,
  editAccountId,
  editAccountNonce,
  onEditAccountHandled,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationHour, setNotificationHour] = useState<string>('');
  const [inappEnabled, setInappEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [savingGamification, setSavingGamification] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<SettingsSectionId>>(() => {
    const initial = new Set<SettingsSectionId>();
    if (focus || editAccountId) initial.add('accounts');
    return initial;
  });

  useEffect(() => {
    if (!focus && !editAccountId) return;
    setOpenSections((prev) => {
      if (prev.has('accounts')) return prev;
      const next = new Set(prev);
      next.add('accounts');
      return next;
    });
  }, [focus, focusNonce, editAccountId, editAccountNonce]);

  useRevealTarget(focus ? `account-${focus.id}` : undefined, focusNonce, openSections.has('accounts'), onFocusHandled);

  const toggleSection = (id: SettingsSectionId, open: boolean) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileRepo = new LocalProfileRepository();
        const data = await profileRepo.get(userId);
        if (data) {
          setProfile(data);
          setNotificationHour(data.notification_hour !== undefined ? String(data.notification_hour) : '');
          setInappEnabled(data.inapp_enabled !== false);
          setPushEnabled(data.push_enabled === true);
          setGamificationEnabled(data.gamification_enabled !== false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadProfile();
  }, [userId]);

  const saveProfile = async (changes: Partial<Profile>) => {
    try {
      const profileRepo = new LocalProfileRepository();
      const current = profile ?? { id: userId, created_at: new Date(), updated_at: new Date() };
      const updated = await profileRepo.save({ ...current, ...changes, id: userId });
      setProfile(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGamificationChange = async (enabled: boolean) => {
    const previous = gamificationEnabled;
    setGamificationEnabled(enabled);
    setSavingGamification(true);
    setPreferenceError(null);
    try {
      const updated = await new LocalProfileRepository().save({ id: userId, gamification_enabled: enabled });
      setProfile(updated);
    } catch {
      setGamificationEnabled(previous);
      setPreferenceError('No pudimos guardar esta preferencia. Intenta de nuevo.');
    } finally {
      setSavingGamification(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const repo = new LocalMovementRepository();
      const moves = await repo.getAll(userId);
      const csvContent = buildMovementsCsv(moves, await loadExportLookups(userId));
      downloadTextFile(`ezlife_export_${calendarKey(new Date())}.csv`, csvContent);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Hubo un error exportando los datos.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const repo = new LocalMovementRepository();
      const moves = await repo.getAll(userId);

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Reporte de Movimientos - ez-life', 14, 22);

      const { head, body } = buildMovementsPdfTable(moves, await loadExportLookups(userId));

      autoTable(doc, {
        startY: 30,
        head,
        body,
        theme: 'striped',
        headStyles: { fillColor: [4, 120, 87] },
      });

      doc.save(`ezlife_report_${calendarKey(new Date())}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Hubo un error exportando los datos.');
    } finally {
      setExporting(false);
    }
  };

  const handleNotificationHourChange = async (value: string) => {
    setNotificationHour(value);
    if (value === '') {
      await saveProfile({ notification_hour: undefined });
      return;
    }
    const hour = Number(value);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) return;
    await saveProfile({ notification_hour: hour });
  };

  const handleToggleInapp = async (checked: boolean) => {
    setInappEnabled(checked);
    await saveProfile({ inapp_enabled: checked });
  };

  const handleTogglePush = async (checked: boolean) => {
    if (checked) {
      if (!('Notification' in window)) {
        alert('Tu navegador no soporta notificaciones.');
        setPushEnabled(false);
        return;
      }
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Permiso de notificaciones denegado.');
          setPushEnabled(false);
          return;
        }
      }
    }
    setPushEnabled(checked);
    await saveProfile({ push_enabled: checked });
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    forgetLocalAccount();
    onLogout?.();
    await supabase.auth.signOut({ scope: 'local' });
  };

  const switchRow = (
    id: string,
    label: React.ReactNode,
    hint: string | null,
    checked: boolean,
    onChange: (next: boolean) => void,
    disabled = false,
  ) => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-body-md font-medium text-foreground">{label}</p>
        {hint && <p id={`${id}-hint`} className="text-body-sm text-muted-foreground">{hint}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onCheckedChange={onChange}
      />
    </div>
  );

  return (
    <div className="space-y-4 pb-6" data-testid="settings-screen">
      <h2 className="font-fredoka text-headline-lg-mobile text-foreground md:text-headline-lg">Ajustes</h2>

      {/* Always-visible quick access entries at the top (FR-020) */}
      <Panel className="gap-3 p-5" data-testid="settings-quick-access">
        <p className="text-sm text-muted-foreground">
          Retoma cualquier paso pendiente de tu configuración inicial o vuelve a ver el recorrido rápido.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCompleteSetup} className="flex-1">
            <ListChecks className="size-4" aria-hidden="true" />
            Completar configuración
          </Button>
          <Button variant="outline" onClick={onReplayTour} className="flex-1">
            <Compass className="size-4" aria-hidden="true" />
            Ver tutorial
          </Button>
        </div>
      </Panel>

      {/* 5 independent collapsible sections, all collapsed by default (FR-021) */}
      <div className="flex flex-col gap-3">
        <CollapsibleSection
          variant="panel"
          testId="settings-section-profile"
          icon={<User className="size-4" />}
          title="Perfil"
          subtitle="Tu cuenta y sesión"
          open={openSections.has('profile')}
          onOpenChange={(open) => toggleSection('profile', open)}
        >
          <div className="space-y-4 pt-2">
            {(accountName || accountEmail) && (
              <div className="flex items-center gap-3 rounded-2xl bg-surface-2/60 p-3.5">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="size-5" />
                </span>
                <div className="min-w-0">
                  {accountName && <p className="truncate text-body-md font-medium text-foreground">{accountName}</p>}
                  {accountEmail && <p className="truncate text-xs text-muted-foreground">{accountEmail}</p>}
                </div>
              </div>
            )}
            <p className="text-body-sm text-muted-foreground">
              Al cerrar sesión, tus datos locales se conservan en este dispositivo.
            </p>
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          variant="panel"
          testId="settings-section-accounts"
          icon={<Wallet className="size-4" />}
          title="Cuentas e ingresos"
          subtitle="Cuentas de pago, ingresos y categorías 50/30/20"
          open={openSections.has('accounts')}
          onOpenChange={(open) => toggleSection('accounts', open)}
        >
          <div className="space-y-6 pt-2">
            <div className="space-y-2">
              <h3 className="font-fredoka text-headline-sm text-foreground">Cuentas de pago</h3>
              <PaymentAccountSettings
                userId={userId}
                editAccountId={editAccountId}
                editNonce={editAccountNonce}
                onEditHandled={onEditAccountHandled}
              />
            </div>

            <div className="space-y-2">
              <h3 className="font-fredoka text-headline-sm text-foreground">Fuentes de ingreso</h3>
              <IncomeSourceSettings userId={userId} />
            </div>

            <div className="space-y-2">
              <h3 className="font-fredoka text-headline-sm text-foreground">Categorías y distribución</h3>
              <p className="text-body-sm text-muted-foreground">
                Ajusta tus porcentajes 50/30/20 y gestiona tus categorías y subcategorías de gasto.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={onEditDistribution} className="flex-1">
                  <Edit2 className="size-4" aria-hidden="true" />
                  Editar distribución (%)
                </Button>
                <Button variant="outline" onClick={onEditCategories} className="flex-1">
                  <Edit2 className="size-4" aria-hidden="true" />
                  Gestionar categorías de gasto
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          variant="panel"
          testId="settings-section-notifications"
          icon={<Bell className="size-4" />}
          title="Notificaciones"
          subtitle="Recordatorio diario y alertas de presupuesto"
          open={openSections.has('notifications')}
          onOpenChange={(open) => toggleSection('notifications', open)}
        >
          <div className="space-y-4 pt-2">
            <p className="text-body-sm text-muted-foreground">
              Recibe alertas cuando superes el 80% de un presupuesto, cumplas una meta de ahorro,
              o un recordatorio diario para registrar tus movimientos.
            </p>

            <div className="space-y-2">
              <label htmlFor="notificationHour" className="text-body-md font-medium text-foreground">
                Hora del recordatorio diario
              </label>
              <Select
                value={notificationHour === '' ? 'off' : notificationHour}
                onValueChange={(val) => handleNotificationHourChange(val === 'off' ? '' : (val ?? ''))}
              >
                <SelectTrigger id="notificationHour" className="w-full">
                  <SelectValue placeholder="Desactivado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Desactivado</SelectItem>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {String(hour).padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {switchRow('inappEnabled', 'Notificaciones in-app', null, inappEnabled, next => void handleToggleInapp(next))}
            {switchRow(
              'pushEnabled',
              <span className="flex items-center gap-1.5"><Bell className="size-3.5" aria-hidden="true" />Notificaciones push del navegador</span>,
              null,
              pushEnabled,
              next => void handleTogglePush(next),
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          variant="panel"
          testId="settings-section-appearance"
          icon={<Palette className="size-4" />}
          title="Apariencia"
          subtitle="Tema visual y visibilidad de logros"
          open={openSections.has('appearance')}
          onOpenChange={(open) => toggleSection('appearance', open)}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-body-md text-muted-foreground">Cambiar tema visual</p>
              <ThemeToggle />
            </div>

            {switchRow(
              'gamificationEnabled',
              'Mostrar logros personales y celebraciones',
              'Puedes ocultarlos cuando quieras. Tu historial se conserva.',
              gamificationEnabled,
              next => void handleGamificationChange(next),
              savingGamification || !profile,
            )}
            {preferenceError && <p role="alert" className="text-body-md text-destructive">{preferenceError}</p>}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          variant="panel"
          testId="settings-section-data"
          icon={<Download className="size-4" />}
          title="Datos y exportación"
          subtitle="Descarga tu historial en CSV o PDF"
          open={openSections.has('data')}
          onOpenChange={(open) => toggleSection('data', open)}
        >
          <div className="space-y-3 pt-2">
            <p className="text-body-sm text-muted-foreground">
              Descarga todo tu historial de movimientos en CSV (Excel) o PDF.
            </p>
            <div className="flex gap-3">
              <Button variant="default" onClick={handleExportCSV} disabled={exporting} className="flex-1">
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                CSV
              </Button>
              <Button variant="outline" onClick={handleExportPDF} disabled={exporting} className="flex-1">
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                PDF
              </Button>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
