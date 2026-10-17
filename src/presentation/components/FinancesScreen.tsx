'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { buildMovementsCsv } from '../../core/use-cases/exportMovements';
import { describeSavingsInsight } from '../../core/use-cases/buildFinancesKpis';
import { countByFilter } from '../../core/use-cases/filterMovements';
import { useFinancesData } from '../hooks/useFinancesData';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { MovementFocus } from '../../core/use-cases/paletteCommand';
import { downloadTextFile } from '../lib/downloadTextFile';
import { loadExportLookups } from '../lib/loadExportLookups';
import MovementList from './MovementList';
import InstallmentLoanForm from './InstallmentLoanForm';
import DebtForm from './DebtForm';
import { FORM_DIALOG_CONTENT_CLASS } from './dialogChrome';
import FinancesHeader from './finances/FinancesHeader';
import FinancesKpis from './finances/FinancesKpis';
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
  /** Deep link into a section (e.g. from Dashboard buttons): selects the tab on phones, scrolls to it on desktop. */
  initialTab?: FinancesTab;
  /** Opens the app-level movement form (same one as the "+" / "Nuevo Registro" actions). */
  onNewMovement: () => void;
  /** Bumped by the app shell after a movement is saved, to reload the screen's data. */
  movementsRefreshKey?: number;
  /** Movement a ⌘K selection wants shown (its edit dialog opens, or its row is revealed). */
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
 * Finanzas (spec 010): KPIs plus Regla 50/30/20, Préstamos and the movement history.
 * Desktop stacks every section on one page; phones switch one section at a time with the Segmented
 * control. All numbers come from `useFinancesData` (local data); this component only composes and wires events.
 */
export default function FinancesScreen({ userId, refDate, initialTab = 'movements', onNewMovement, movementsRefreshKey = 0, focus, focusNonce, onFocusHandled }: Props) {
  const desktop = useIsDesktop();
  const online = useOnlineStatus();
  const { loading, view, reload } = useFinancesData(userId, refDate, movementsRefreshKey);

  const [tab, setTab] = useState<FinancesTab>(initialTab);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtsRefreshKey, setDebtsRefreshKey] = useState(0);
  const [showInstallmentLoanForm, setShowInstallmentLoanForm] = useState(false);
  const [installmentLoansRefreshKey, setInstallmentLoansRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const sections = useRef<Partial<Record<FinancesTab, HTMLElement | null>>>({});

  // A deep link that changes while the screen is mounted selects its tab too.
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  // A requested movement lives in the history, whichever section the phone was showing.
  useEffect(() => { if (focus) setTab('movements'); }, [focus, focusNonce]);

  // Desktop shows every section: a deep link scrolls to its section instead of switching tabs. It waits for the
  // data to load, because the sections above the target change height once their numbers arrive.
  const scrolledFor = useRef<FinancesTab | null>(null);
  useEffect(() => {
    if (!desktop || loading || initialTab === 'movements' || scrolledFor.current === initialTab) return;
    scrolledFor.current = initialTab;
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sections.current[initialTab]?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [desktop, loading, initialTab]);

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

  const { kpis, rule } = view;
  const counts = countByFilter(view.movements);
  const insight = describeSavingsInsight(kpis);

  const history = (
    <>
      <MovementList
        userId={userId}
        movements={view.movements}
        lookups={view.lookups}
        pendingIds={view.pendingMovementIds}
        balanceCents={kpis.netBalance}
        today={view.today}
        loading={loading}
        desktop={desktop}
        onChanged={() => { void reload(); }}
        focusId={focus?.id}
        focusNonce={focusNonce}
        onFocusHandled={onFocusHandled}
      />
      {!desktop && !loading && (
        <aside aria-label="Tasa de ahorro" className="flex items-center gap-3 rounded-lg border border-border bg-card p-4" data-testid="savings-insight">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary">
            <Sparkles className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-body-md font-semibold text-foreground">{insight.title}</p>
            <p className="text-body-sm text-muted-foreground">{insight.body}</p>
          </div>
        </aside>
      )}
    </>
  );

  const rules = <RuleSection rule={rule} desktop={desktop} />;

  const loans = (
    <LoansSection
      userId={userId}
      desktop={desktop}
      activeCount={view.activeDebtCount + view.activeLoanCount}
      installmentRefreshKey={installmentLoansRefreshKey}
      debtRefreshKey={debtsRefreshKey}
      onNewInstallmentLoan={() => setShowInstallmentLoanForm(true)}
      onNewDebt={() => setShowDebtForm(true)}
    />
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <FinancesHeader
        desktop={desktop}
        online={online}
        exportDisabled={view.movements.length === 0}
        exporting={exporting}
        exportError={exportError}
        onExport={() => { void handleExport(); }}
        onNewMovement={onNewMovement}
      />

      <FinancesKpis kpis={kpis} incomeCount={counts.income} budgetBase={rule.totalBudget} />

      {desktop ? (
        <>
          <section ref={node => { sections.current.budget = node; }} aria-label="Regla 50/30/20" className="scroll-mt-24">{rules}</section>
          <section ref={node => { sections.current.loans = node; }} aria-label="Sección de préstamos" className="scroll-mt-24">{loans}</section>
          <section ref={node => { sections.current.movements = node; }} aria-label="Historial de movimientos" className="scroll-mt-24 flex flex-col gap-4">{history}</section>
        </>
      ) : (
        <>
          <Segmented
            ariaLabel="Secciones de Finanzas"
            idPrefix="finances"
            value={tab}
            onValueChange={(value) => setTab(value as FinancesTab)}
            options={TAB_OPTIONS}
            fullWidth
            className="max-md:[&>button]:px-2 max-md:[&>button]:text-body-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
          <div role="tabpanel" id={`finances-panel-${tab}`} aria-labelledby={`finances-tab-${tab}`} className="flex flex-col gap-4">
            {tab === 'movements' && history}
            {tab === 'budget' && rules}
            {tab === 'loans' && loans}
          </div>
        </>
      )}

      <Dialog open={showInstallmentLoanForm} onOpenChange={(open) => !open && setShowInstallmentLoanForm(false)}>
        <DialogContent className={FORM_DIALOG_CONTENT_CLASS}>
          <InstallmentLoanForm
            userId={userId}
            onComplete={() => {
              setShowInstallmentLoanForm(false);
              setInstallmentLoansRefreshKey((k) => k + 1);
            }}
            onCancel={() => setShowInstallmentLoanForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDebtForm} onOpenChange={(open) => !open && setShowDebtForm(false)}>
        <DialogContent className={FORM_DIALOG_CONTENT_CLASS}>
          <DebtForm
            userId={userId}
            onComplete={() => {
              setShowDebtForm(false);
              setDebtsRefreshKey((k) => k + 1);
            }}
            onCancel={() => setShowDebtForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
