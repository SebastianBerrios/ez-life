'use client';

import React, { useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ThemeToggle } from './ThemeToggle';
import { Edit2, Download, FileText, Bell, LogOut } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../infrastructure/supabase/client';

interface Props {
  userId: string;
  onEditDistribution?: () => void;
  onEditCategories?: () => void;
  onLogout?: () => void;
}

export default function SettingsScreen({ userId, onEditDistribution, onEditCategories, onLogout }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const repo = new LocalMovementRepository();
      const moves = await repo.getAll(userId);

      const headers = ['Fecha', 'Tipo', 'Monto', 'Descripcion'];
      const rows = moves.map(m => {
        const date = new Date(m.date).toLocaleDateString();
        const type = m.type === 'INCOME' ? 'Ingreso' : 'Egreso';
        const amount = (m.amount / 100).toFixed(2).replace('.', ',');
        const desc = m.description || '';
        return `${date};${type};${amount};${desc}`;
      });

      const csvContent = [headers.join(';'), ...rows].join('\n');
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

      const rows = moves.map(m => {
        const date = new Date(m.date).toLocaleDateString();
        const type = m.type === 'INCOME' ? 'Ingreso' : 'Egreso';
        const amount = `S/ ${(m.amount / 100).toFixed(2)}`;
        const desc = m.description || '-';
        return [date, type, amount, desc];
      });

      autoTable(doc, {
        startY: 30,
        head: [['Fecha', 'Tipo', 'Monto', 'Descripción']],
        body: rows,
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

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('ez-life', {
        body: '¡Notificaciones activadas! Te avisaremos cuando empiece un nuevo mes.',
        icon: '/favicon.ico'
      });
    } else {
      alert('Permiso de notificaciones denegado.');
    }
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
          <button
            onClick={onEditDistribution}
            className="w-full h-11 flex items-center justify-center gap-2 px-4 border border-border rounded-xl text-base font-medium text-foreground bg-background hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Edit2 className="w-4 h-4" />
            Editar distribución (%)
          </button>

          <button
            onClick={onEditCategories}
            className="w-full h-11 flex items-center justify-center gap-2 px-4 border border-border rounded-xl text-base font-medium text-foreground bg-background hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Edit2 className="w-4 h-4" />
            Gestionar categorías de gasto
          </button>
        </div>
      </Section>

      {/* Export */}
      <Section title="Exportar Datos">
        <p className="text-sm text-muted-foreground">
          Descargá todo tu historial de movimientos en CSV (Excel) o PDF.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex-1 h-11 flex items-center justify-center gap-2 px-4 rounded-xl text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="w-4 h-4" />
            {exporting ? '...' : 'CSV'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex-1 h-11 flex items-center justify-center gap-2 px-4 rounded-xl text-base font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="w-4 h-4" />
            {exporting ? '...' : 'PDF'}
          </button>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notificaciones">
        <p className="text-sm text-muted-foreground">
          Recibí alertas cuando empiece un nuevo ciclo mensual o superes un presupuesto.
        </p>
        <button
          onClick={handleEnableNotifications}
          className="w-full h-11 flex items-center justify-center gap-2 px-4 border border-border rounded-xl text-base font-medium text-foreground bg-background hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="w-4 h-4" />
          Activar Notificaciones
        </button>
      </Section>

      {/* Account / Logout */}
      <Section title="Cuenta">
        <p className="text-sm text-muted-foreground">
          Al cerrar sesión, tus datos locales se conservan en este dispositivo.
        </p>
        <button
          onClick={handleLogout}
          className="w-full h-11 flex items-center justify-center gap-2 px-4 rounded-xl text-base font-medium text-destructive border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
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
