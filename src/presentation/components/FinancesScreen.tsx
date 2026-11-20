'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { buildMovementsCsv } from '../../core/use-cases/exportMovements';
import { useFinancesData } from '../hooks/useFinancesData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { MovementFocus } from '../../core/use-cases/paletteCommand';
import { downloadTextFile } from '../lib/downloadTextFile';
import { loadExportLookups } from '../lib/loadExportLookups';
import MovementList from './MovementList';
import InstallmentLoanForm from './InstallmentLoanForm';
import DebtForm from './DebtForm';
import FinancesHeader from './finances/FinancesHeader';
import RuleSection from './finances/RuleSection';
import LoansSection from './finances/LoansSection';

export type FinancesTab = 'movements' | 'budget' | 'loans';

const TAB_OPTIONS = [
  { value: 'movements', label: 'Movimientos' },
  { value: 'budget', label: 'Regla 50/30/20' },
  { value: 'loans', label: 'Préstamos' },
];

interface Props {
  userId: string;
  /** Month shown by the shared selector; defaults to the current month. */
  refDate?: Date;
  /** Deep link into a section (e.g. from Dashboard buttons): selects the matching tab. */
  initialTab?: FinancesTab;
  /** Opens the app-level movement form. */
  onNewMovement: () => void;
  /** Opens credit card settings for cards without a credit limit. */
  onAddCreditLimit?: (accountId: string) => void;
  /** Bumped by the app shell after a movement is saved, to reload the screen's data. */
  movementsRefreshKey?: number;
  /** Movement a ⌘K selection wants shown (its edit sheet opens, or its row is revealed). */
  focus?: MovementFocus;
  /** Changes every time the same movement is requested again. */
  focusNonce?: number;
  /** Called once the request was served so the shell can forget it. */
  onFocusHandled?: () => void;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Finanzas (spec 014): 3-tab Segmented view (Movimientos, Regla 50/30/20, Préstamos)
 * across all viewports, with 1 hero figure per tab, warm rounded cards, and zero KPI grids or tables.
 */
export default function FinancesScreen({
  userId,
  refDate,
  initialTab = 'movements',
  onNewMovement,
  onAddCreditLimit,
  movementsRefreshKey = 0,
  focus,
  focusNonce,
  onFocusHandled,
}: Props) {
  const online = useOnlineStatus();
  const { loading, view, reload } = useFinancesData(userId, refDate, movementsRefreshKey);

  const [tab, setTab] = useState<FinancesTab>(initialTab);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtsRefreshKey, setDebtsRefreshKey] = useState(0);
  const [showInstallmentLoanForm, setShowInstallmentLoanForm] = useState(false);
  const [installmentLoansRefreshKey, setInstallmentLoansRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { if (focus) setTab('movements'); }, [focus, focusNonce]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError('');
    try {
      const month = refDate ?? new Date();
      const rows = [...view.movements].sort((a, b) => a.date.getTime() - b.date.getTime());
      downloadTextFile(`ez-life-movimientos-${monthKey(month)}.csv`, buildMovementsCsv(rows, await loadExportLookups(userId)));
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setExportError('No se pudo exportar el CSV.');
    } finally {
      setExporting(false);
    }
  }, [refDate, userId, view.movements]);

  const hasLoansOrDebts = view.loans.length > 0 || view.debts.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <FinancesHeader
        online={online}
        exportDisabled={view.movements.length === 0}
        exporting={exporting}
        exportError={exportError}
        onExport={() => { void handleExport(); }}
      />

      <Segmented
        ariaLabel="Secciones de Finanzas"
        idPrefix="finances"
        value={tab}
        onValueChange={(value) => setTab(value as FinancesTab)}
        options={TAB_OPTIONS}
        fullWidth
        className="max-sm:[&>button]:px-2 max-sm:[&>button]:text-body-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      />

      <div
        role="tabpanel"
        id={`finances-panel-${tab}`}
        aria-labelledby={`finances-tab-${tab}`}
        className="flex flex-col gap-4"
      >
        {tab === 'movements' && (
          <MovementList
            userId={userId}
            movements={view.movements}
            lookups={view.lookups}
            today={view.today}
            loading={loading}
            onChanged={() => { void reload(); }}
            onNewMovement={onNewMovement}
            focusId={focus?.id}
            focusNonce={focusNonce}
            onFocusHandled={onFocusHandled}
          />
        )}
        {tab === 'budget' && (
          <RuleSection rule={view.rule} savingsBucketIds={view.savingsBucketIds} />
        )}
        {tab === 'loans' && (
          <LoansSection
            userId={userId}
            hero={view.hero}
            hasLoansOrDebts={hasLoansOrDebts}
            installmentRefreshKey={installmentLoansRefreshKey}
            debtRefreshKey={debtsRefreshKey}
            onNewInstallmentLoan={() => setShowInstallmentLoanForm(true)}
            onNewDebt={() => setShowDebtForm(true)}
            onAddCreditLimit={onAddCreditLimit}
          />
        )}
      </div>

      <Sheet open={showInstallmentLoanForm} onOpenChange={(open) => !open && setShowInstallmentLoanForm(false)}>
        <SheetContent>
          <InstallmentLoanForm
            userId={userId}
            onComplete={() => {
              setShowInstallmentLoanForm(false);
              setInstallmentLoansRefreshKey((k) => k + 1);
            }}
            onCancel={() => setShowInstallmentLoanForm(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={showDebtForm} onOpenChange={(open) => !open && setShowDebtForm(false)}>
        <SheetContent>
          <DebtForm
            userId={userId}
            onComplete={() => {
              setShowDebtForm(false);
              setDebtsRefreshKey((k) => k + 1);
            }}
            onCancel={() => setShowDebtForm(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
