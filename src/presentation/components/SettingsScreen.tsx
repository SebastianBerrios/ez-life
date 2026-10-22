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
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Download, FileText, Bell, LogOut, Loader2, User } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';
import IncomeSourceSettings from './IncomeSourceSettings';
import PaymentAccountSettings from './PaymentAccountSettings';
import { forgetLocalAccount } from '../../infrastructure/auth/localAccount';

interface Props {
  userId: string;
  onEditDistribution?: () => void;
  onEditCategories?: () => void;
  onLogout?: () => void;
  /** Real account data from the session; the profile panel only shows what exists. */
  accountName?: string;
  accountEmail?: string;
  /** Account a ⌘K selection wants revealed in "Cuentas de pago". */
  focus?: AccountFocus;
  /** Changes every time the same account is requested again. */
  focusNonce?: number;
  onFocusHandled?: () => void;
}

export default function SettingsScreen({
  userId, onEditDistribution, onEditCategories, onLogout, accountName, accountEmail, focus, focusNonce, onFocusHandled,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationHour, setNotificationHour] = useState<string>('');
  const [inappEnabled, setInappEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [savingGamification, setSavingGamification] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  useRevealTarget(focus ? `account-${focus.id}` : undefined, focusNonce, true, onFocusHandled);

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
        // Brand emerald (primary #047857) in RGB: jsPDF takes numbers, not CSS variables.
        headStyles: { fillColor: [4, 120, 87] }
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
      <h2 className="text-headline-lg-mobile text-foreground md:text-headline-lg">Ajustes</h2>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          {(accountName || accountEmail) && (
            <Section title="Perfil" eyebrow="Cuenta">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="size-5" />
                </span>
                <div className="min-w-0">
                  {accountName && <p className="truncate text-body-md font-medium text-foreground">{accountName}</p>}
                  {accountEmail && <p className="truncate font-mono text-label-mono-xs text-muted-foreground">{accountEmail}</p>}
                </div>
              </div>
            </Section>
          )}

          <Section title="Cuentas de pago" eyebrow="Dinero"><PaymentAccountSettings userId={userId} /></Section>
          <Section title="Fuentes de ingreso" eyebrow="Dinero"><IncomeSourceSettings userId={userId} /></Section>

          <Section title="Categorías y Distribución" eyebrow="Presupuesto">
            <p className="text-body-md text-muted-foreground">
              Ajusta tus categorías de distribución (%) y gestiona las categorías y subcategorías de gasto.
            </p>
            <div className="space-y-2">
              <Button variant="outline" onClick={onEditDistribution} className="w-full">
                <Edit2 className="size-4" />
                Editar distribución (%)
              </Button>
              <Button variant="outline" onClick={onEditCategories} className="w-full">
                <Edit2 className="size-4" />
                Gestionar categorías de gasto
              </Button>
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Apariencia" eyebrow="Preferencias">
            <div className="flex items-center justify-between gap-3">
              <p className="text-body-md text-muted-foreground">Cambiar tema visual</p>
              <ThemeToggle />
            </div>
          </Section>

          <Section title="Mi progreso" eyebrow="Preferencias">
            {switchRow(
              'gamificationEnabled',
              'Mostrar logros personales y celebraciones',
              'Puedes ocultarlos cuando quieras. Tu historial se conserva.',
              gamificationEnabled,
              next => void handleGamificationChange(next),
              savingGamification || !profile,
            )}
            {preferenceError && <p role="alert" className="text-body-md text-destructive">{preferenceError}</p>}
          </Section>

          <Section title="Notificaciones" eyebrow="Preferencias">
            <p className="text-body-md text-muted-foreground">
              Recibí alertas cuando superes el 80% de un presupuesto, cumplas una meta de ahorro,
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
              <span className="flex items-center gap-1.5"><Bell className="size-3.5" />Notificaciones push del navegador</span>,
              null,
              pushEnabled,
              next => void handleTogglePush(next),
            )}
          </Section>

          <Section title="Exportar Datos" eyebrow="Datos">
            <p className="text-body-md text-muted-foreground">
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
          </Section>

          <Section title="Cuenta" eyebrow="Sesión">
            <p className="text-body-md text-muted-foreground">
              Al cerrar sesión, tus datos locales se conservan en este dispositivo.
            </p>
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}

// Shared section wrapper: one Panel per setting group.
function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <Panel>
      <PanelHeader eyebrow={eyebrow} title={title} />
      <PanelBody className="space-y-3">{children}</PanelBody>
    </Panel>
  );
}
