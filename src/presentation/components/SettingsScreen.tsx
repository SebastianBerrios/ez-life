'use client';

import React, { useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { Profile } from '../../core/domain/models/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildMovementsCsv, buildMovementsPdfTable } from '../../core/use-cases/exportMovements';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Download, FileText, Bell, LogOut, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';

interface Props {
  userId: string;
  onEditDistribution?: () => void;
  onEditCategories?: () => void;
  onLogout?: () => void;
}

export default function SettingsScreen({ userId, onEditDistribution, onEditCategories, onLogout }: Props) {
  const [exporting, setExporting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationHour, setNotificationHour] = useState<string>('');
  const [inappEnabled, setInappEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

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

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const repo = new LocalMovementRepository();
      const moves = await repo.getAll(userId);

      const csvContent = buildMovementsCsv(moves);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ezlife_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

      const { head, body } = buildMovementsPdfTable(moves);

      autoTable(doc, {
        startY: 30,
        head,
        body,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }
      });

      doc.save(`ezlife_report_${new Date().toISOString().split('T')[0]}.pdf`);
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
    await supabase.auth.signOut();
    onLogout?.();
  };

  return (
    <div className="space-y-5 pb-6">
      <h2 className="text-2xl font-bold text-foreground">Ajustes</h2>

      {/* Appearance */}
      <Section title="Apariencia">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Cambiar tema visual</p>
          <ThemeToggle />
        </div>
      </Section>

      {/* Categories */}
      <Section title="Categorías y Distribución">
        <p className="text-sm text-muted-foreground">
          Ajustá tus categorías de distribución (%) y gestioná las categorías y subcategorías de gasto.
        </p>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={onEditDistribution}
            className="w-full text-base"
          >
            <Edit2 className="w-4 h-4" />
            Editar distribución (%)
          </Button>

          <Button
            variant="outline"
            onClick={onEditCategories}
            className="w-full text-base"
          >
            <Edit2 className="w-4 h-4" />
            Gestionar categorías de gasto
          </Button>
        </div>
      </Section>

      {/* Export */}
      <Section title="Exportar Datos">
        <p className="text-sm text-muted-foreground">
          Descargá todo tu historial de movimientos en CSV (Excel) o PDF.
        </p>
        <div className="flex gap-3">
          <Button
            variant="default"
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex-1 text-base"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </Button>
          <Button
            variant="destructive"
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex-1 text-base"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            PDF
          </Button>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notificaciones">
        <p className="text-sm text-muted-foreground">
          Recibí alertas cuando superes el 80% de un presupuesto, cumplas una meta de ahorro,
          o un recordatorio diario para registrar tus movimientos.
        </p>

        <div className="space-y-2">
          <label htmlFor="notificationHour" className="text-sm font-medium text-foreground">
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

        <div className="flex items-center space-x-2">
          <input
            id="inappEnabled"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            checked={inappEnabled}
            onChange={(e) => handleToggleInapp(e.target.checked)}
          />
          <label htmlFor="inappEnabled" className="text-sm text-foreground cursor-pointer">
            Notificaciones in-app
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="pushEnabled"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            checked={pushEnabled}
            onChange={(e) => handleTogglePush(e.target.checked)}
          />
          <label htmlFor="pushEnabled" className="text-sm text-foreground cursor-pointer flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Notificaciones push del navegador
          </label>
        </div>
      </Section>

      {/* Account / Logout */}
      <Section title="Cuenta">
        <p className="text-sm text-muted-foreground">
          Al cerrar sesión, tus datos locales se conservan en este dispositivo.
        </p>
        <Button
          variant="destructive"
          onClick={handleLogout}
          className="w-full text-base"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </Button>
      </Section>
    </div>
  );
}

// Shared section wrapper
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
