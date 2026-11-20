# Tasks: Minimalismo en el resto de la app

**Input**: Design documents from `/specs/014-minimalismo-resto-app/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contracts.md`, `quickstart.md`

**Tests**: Included per `spec.md` (`FR-025`, `FR-029`, `SC-006`) and Constitution Principle IV — unit tests for all 4 new pure modules in `src/core/use-cases/` and Testing Library tests for new UI wiring (`CollapsibleSection`, `"Más opciones"` + auto-expansion on error, Finanzas tabs, Control segmented selector, Espacio Compartido phrases, Ajustes 5 collapsible sections + deep-link).

**Organization**: Tasks are grouped by user story in priority order (P1 → P2 → P3) so each story is independently implementable and testable. Zero runtime dependencies added (Principles I & VII), zero data model / migration / sync changes (FR-024, Principles V & XII), money always in integer cents PEN (Principle VIII), UI copy in neutral Latin American Spanish with tuteo and zero voseo (Principle VI).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with sibling tasks in the same wave once any explicit `(depends on ...)` tasks complete (different files)
- **[Story]**: User story label (`[US1]`..`[US6]`) — used only in user story phases
- Every task includes exact repository file paths

---

## Phase 1: Setup (Baseline & Viewport Verification)

**Purpose**: Confirm clean baseline before edits and verify existing PWA viewport / CSS foundation.

- [X] T001 Verify baseline test suite, linter, and build pass (`pnpm test`, `pnpm lint`, `pnpm build`) at repository root
- [X] T002 [P] Verify `viewportFit: "cover"` and light/dark `themeColor` metadata (`#FBF5EA` / `#241A2B`) in `src/app/layout.tsx` and confirm token utilities in `src/app/globals.css` preserve `src/tokens.contrast.test.ts`

---

## Phase 2: Foundational (Shared UI Primitives)

**Purpose**: Build and update the shared presentation primitives required by all user stories before modifying individual screens.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T003 [P] Create `CollapsibleSection` primitive in `src/components/ui/collapsible-section.tsx` implementing `CollapsibleSectionProps` (`title`, `subtitle?`, `icon?`, `badge?`, `open?`, `defaultOpen?`, `onOpenChange?`, `variant?: 'panel' | 'inline'`, `testId?`, `children`), trigger button with `min-h-11` (≥ 44 px), `aria-expanded`, `aria-controls`, visible focus ring, `motion-reduce:transition-none`, `variant="panel"` (`rounded-card bg-card shadow-card`), and `variant="inline"` (`rounded-2xl bg-surface-2/60`)
- [X] T004 [P] Create `EmptyState` primitive in `src/components/ui/empty-state.tsx` implementing `EmptyStateProps` (`icon?`, `title`, `description?`, `actionLabel?`, `onAction?`, `secondaryActionLabel?`, `onSecondaryAction?`, `testId?`) as a centered warm `Panel` with `bg-surface-2` icon circle, tuteo copy, and pill action button(s) (`min-h-11`)
- [X] T005 [P] Update `SheetContent` in `src/components/ui/sheet.tsx` to enforce mobile bottom sheet (`< 768px`, `fixed inset-x-0 bottom-0 rounded-t-card max-h-[92dvh]`) with internal scroll (`overscroll-contain`), bottom safe-area support (`pb-[env(safe-area-inset-bottom)]`), a sticky bottom footer slot (`bg-popover` + `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`) kept within thumb reach, and centered dialog at `md:` (`>= 768px`, `md:top-1/2 md:left-1/2 md:max-w-lg md:rounded-card`)
- [X] T006 Create unit and wiring tests for `CollapsibleSection` (controlled/uncontrolled toggle, `aria-expanded`, badge rendering, `panel` vs `inline` variants) in `src/components/ui/collapsible-section.test.tsx` (depends on T003)
- [X] T007 Update `Sheet` tests to cover mobile bottom-sheet sticky footer and safe-area structure in `src/components/ui/sheet.test.tsx` (depends on T005)

**Checkpoint**: Shared primitives (`CollapsibleSection`, `EmptyState`, updated `Sheet`) are ready and tested; user story phases can now proceed.

---

## Phase 3: User Story 1 - Navegación ligera y lenguaje visual unificado en toda la app (Priority: P1) 🎯 MVP

**Goal**: Unify the app shell, responsive PWA navigation (`< 1024px` fixed bottom bar, `>= 1024px` fixed sidebar, centered `max-w-[720px]` column), sentence-case labels, single primary CTA `"Nuevo registro"`, synced `theme-color`, and warm system screens (login, loading, error).

**Independent Test**: Navigate all sections at 360 px (mobile), 768 px (tablet portrait), 1024 px (tablet landscape), and 1440 px (desktop) in light and dark mode, plus login, loading, and error states: labels are in sentence case, `"Nuevo registro"` is the only highlighted primary action, content centers at ~720 px, safe-area insets are applied, and zero terminal/monospace-uppercase labels remain.

- [X] T008 [P] [US1] Sync `<meta name="theme-color">` with resolved active theme (`#FBF5EA` in light, `#241A2B` in dark) via lightweight effect in `src/components/theme-provider.tsx` without touching `public/sw.js`
- [X] T009 [P] [US1] Create warm error boundary screen in `src/app/error.tsx` using cream/plum palette, rounded `Panel`, friendly tuteo copy, and pill `"Reintentar"` button (`min-h-11`, AA contrast in light/dark)
- [X] T010 [P] [US1] Update shell layout in `src/presentation/components/Layout.tsx` to switch bottom-nav ↔ sidebar breakpoint from `md` to `lg` (`1024px`), unify `<main>` container to centered `mx-auto w-full max-w-[720px]` across all screens, and apply bottom safe-area padding `pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10`
- [X] T011 [P] [US1] Update `MobileHeader` in `src/presentation/components/MobileHeader.tsx` and `AppTopbar` in `src/presentation/components/AppTopbar.tsx` to use the `lg` (`1024px`) breakpoint and apply top safe-area inset `pt-[env(safe-area-inset-top)]` on mobile/tablet-portrait header
- [X] T012 [P] [US1] Update `BottomNav` in `src/presentation/components/BottomNav.tsx` to use the `lg` (`1024px`) breakpoint, sentence-case navigation labels (`Resumen` / mobile `Inicio`, `Finanzas`, `Control y hábitos` / mobile `Hábitos`, `Espacio compartido`, `Mi progreso`, `Ajustes`), lighter visual weight, touch targets ≥ 44 px, and pill styling (`rounded-full`) for the sole primary CTA (`Nuevo registro` on sidebar / `+` on bottom bar)
- [X] T013 [P] [US1] Update `LoginScreen` in `src/presentation/components/LoginScreen.tsx` to use warm rounded `Panel` cards, pill buttons, soft warm shadows, and neutral tuteo copy in light and dark mode
- [X] T014 [US1] Update `MainFlow` in `src/presentation/components/MainFlow.tsx` to apply warm loading state, sentence-case route titles/labels, and present `SharedSpace` creation/join modals inside `Sheet` (depends on T005, T010, T012)
- [X] T015 [P] [US1] Update navigation and system screen tests for sentence-case labels, `lg` breakpoint, and warm states in `src/presentation/components/BottomNav.test.tsx`, `src/presentation/components/AppTopbar.test.tsx`, `src/presentation/components/LoginScreen.test.tsx`, and `src/presentation/components/MainFlow.test.tsx` (depends on T011, T012, T013, T014)

**Checkpoint**: User Story 1 is complete and independently verifiable — the entire app shell, navigation, theme-color, login, loading, and error screens share the warm minimalist language.

---

## Phase 4: User Story 2 - Finanzas claras de un vistazo (Priority: P1)

**Goal**: Replace the 4-KPI grid and rigid desktop table in Finanzas with a 3-tab `Segmented` view (`Movimientos`, `Regla 50/30/20`, `Préstamos`) where each tab leads with one hero metric, short human phrases built by pure functions, rounded cards, and actionable empty states while preserving all existing financial mutations.

**Independent Test**: Open Finanzas with populated data and with empty data across all 3 tabs: Movimientos shows filtered net balance (`ingresos − egresos`) and a day-grouped card list (no table); Regla 50/30/20 shows `%` spent of monthly income and pastel-pill bucket phrases; Préstamos shows total owed (loans + credit cards + `borrowed` debts), a separate secondary `"Te deben"` block for `lent` debts, credit cards with `"Agregar línea de crédito"` fallback, and singular/plural loan phrases; all existing actions work identically.

### Pure Use-Cases & Unit Tests for User Story 2

- [X] T016 [P] [US2] Implement `buildFinancesHero` in `src/core/use-cases/buildFinancesHero.ts` returning `FinancesHeroSummary` (`movementsNetCents = income - expense` excluding `TRANSFER` and soft-deleted items, `ruleSpentPercent = rule.spentPercentOfBase`, `creditCards` via `calculateAccountBalances` + `selectCardOwed` for active non-archived `credit` accounts, `totalOwedCents` = active loans `remaining_installments * installment_amount` + credit cards `owedCents` + active `borrowed` debts `Math.max(0, amount - settled_amount)`, and `totalOwedToMeCents` = active `lent` debts pending; never subtract `lent` from `totalOwedCents`; all amounts integer cents PEN)
- [X] T017 [P] [US2] Implement `formatFinancesPhrases` in `src/core/use-cases/formatFinancesPhrases.ts` exporting `formatRuleBucketPhrase` (expense `"Llevas S/ ... de S/ ... en ..."` / `"Te pasaste S/ ... en ..."`, savings `isSavings = true` `"Ahorraste S/ ... de S/ ..."` / `"Ahorraste S/ ... · meta cumplida"` / `"Ahorraste S/ ... · superaste tu meta de S/ ..."`, and `budget <= 0` fallback), `formatInstallmentLoanPhrase` (singular `"Te falta 1 cuota · próxima el 15"`, plural `"Te faltan 8 cuotas · próxima el 15"`, no `payment_day` `"Te faltan 3 cuotas"`, settled `"Préstamo saldado"`), `formatInformalDebtPhrase` (`"Le debes S/ ... a ..."`, `"... te debe S/ ..."`, `"Saldado con ..."`), and `formatCreditCardPhrase` (`"Usaste S/ ... de S/ ... · Pagas el ..."` / `"Debes S/ ..."`) using `formatMoney` and neutral tuteo
- [X] T018 [P] [US2] Add unit tests for `buildFinancesHero` (net balance excluding transfers/deleted, `ruleSpentPercent` null when base ≤ 0, total owed vs separate owed-to-me, settled loans excluded) in `src/core/use-cases/buildFinancesHero.test.ts` (depends on T016)
- [X] T019 [P] [US2] Add unit tests for `formatFinancesPhrases` (expense + savings bucket statuses including met/exceeded and `budget <= 0`, 1 vs N installments, missing `payment_day`, settled loan, `borrowed`/`lent`/settled debt, credit card with/without limit) in `src/core/use-cases/formatFinancesPhrases.test.ts` (depends on T017)

### Implementation for User Story 2

- [X] T020 [US2] Extend `useFinancesData` (read-only) in `src/presentation/hooks/useFinancesData.ts` to expose active accounts/credit cards, loans, debts, and computed `FinancesHeroSummary` via `buildFinancesHero` without duplicating Dexie queries (depends on T016)
- [X] T021 [P] [US2] Simplify `FinancesHeader` in `src/presentation/components/finances/FinancesHeader.tsx` (sentence case, no primary button competing with `"Nuevo registro"`) and remove unused `src/presentation/components/finances/FinancesKpis.tsx` (FR-002, FR-009)
- [X] T022 [P] [US2] Update `MovementRows` in `src/presentation/components/finances/MovementRows.tsx` to style `MovementCard` with warm rounded cards and pastel pills, and remove `MovementTable` completely (FR-003, FR-010)
- [X] T023 [US2] Refactor `MovementList` in `src/presentation/components/MovementList.tsx` to render the day-grouped `MovementCard` list on all viewports (no table), use `EmptyState` when empty with direct action, open movement editing inside `Sheet`, and preserve all filtering/search/edit/delete flows (depends on T004, T005, T022)
- [X] T024 [P] [US2] Refactor `RuleSection` in `src/presentation/components/finances/RuleSection.tsx` to render hero `%` spent of monthly income (or guidance phrase when `ruleSpentPercent === null`), one rounded card per bucket (`Necesidades`, `Deseos`, `Ahorro`) with pastel pills (`pill-needs`, `pill-wants`, `pill-savings`), `formatRuleBucketPhrase`, soft progress bar, collapsible category breakdown via `CollapsibleSection`, and actionable `EmptyState` (depends on T003, T004, T017)
- [X] T025 [P] [US2] Refactor `InstallmentLoanList` in `src/presentation/components/InstallmentLoanList.tsx` to render rounded cards with `formatInstallmentLoanPhrase`, open edit/payment actions in `Sheet`, and preserve `recordInstallmentPayment` / `recordPrincipalPayment` behavior intact (Principle X) (depends on T005, T017)
- [X] T026 [P] [US2] Refactor `DebtList` in `src/presentation/components/DebtList.tsx` to render rounded cards with `formatInformalDebtPhrase`, open edit/settle actions in `Sheet`, and preserve `recordSettlement` bookkeeping-only behavior intact (Principle X) (depends on T005, T017)
- [X] T027 [US2] Refactor `LoansSection` in `src/presentation/components/finances/LoansSection.tsx` to display hero `totalOwedCents`, a separate secondary `"Te deben"` block when `totalOwedToMeCents > 0`, credit cards with `formatCreditCardPhrase` and `"Agregar línea de crédito"` fallback when `creditLimitCents` is missing, `InstallmentLoanList`, `DebtList`, and actionable `EmptyState` when no obligations exist (depends on T004, T017, T025, T026)
- [X] T028 [US2] Refactor `FinancesScreen` in `src/presentation/components/FinancesScreen.tsx` to remove `FinancesKpis` and stacked desktop layout, render `Segmented` (`Movimientos` / `Regla 50/30/20` / `Préstamos`) across all viewports with 1 hero metric per tab (Movimientos hero net balance, Regla hero `%`, Préstamos hero total owed), and auto-select the target tab on deep-link `focus` (depends on T020, T021, T023, T024, T027)
- [X] T029 [P] [US2] Update and add Testing Library tests for Finanzas tabs, hero figures, phrases, day-grouped list without table, and empty states in `src/presentation/components/FinancesScreen.test.tsx`, `src/presentation/components/MovementList.test.tsx`, `src/presentation/components/finances/RuleSection.test.tsx`, `src/presentation/components/InstallmentLoanList.test.tsx`, and `src/presentation/components/DebtList.test.tsx` (depends on T023, T024, T025, T026, T028)

**Checkpoint**: User Story 2 is complete and independently testable — Finanzas displays 3 clean tabs with 1 hero figure each, zero KPI grids, zero tables, and full functional parity.

---

## Phase 5: User Story 3 - Formularios y hojas enfocados en lo esencial (Priority: P1)

**Goal**: Present all 6 forms (`QuickRecordSheet`, `MovementForm`, `TransferForm`, `PaymentAccountForm`, `InstallmentLoanForm`, `DebtForm`) as mobile bottom sheets with thumb-reach sticky save footer (and centered dialog on tablet/desktop), showing only essential fields first and hiding advanced fields inside `"Más opciones"` with active-count badge on edit and automatic expansion on validation error.

**Independent Test**: Open each of the 6 forms on mobile (360 px) and desktop: only essential fields appear initially; saving with defaults works without opening `"Más opciones"`; editing a record with populated advanced fields starts with `"Más opciones · N activas"` collapsed; submitting with an invalid value inside `"Más opciones"` auto-expands the section and shows the inline error.

### Pure Use-Case & Unit Test for User Story 3

- [X] T030 [P] [US3] Implement `formAdvancedFields` in `src/core/use-cases/formAdvancedFields.ts` exporting `countActiveFields(flags: readonly boolean[]): number`, `formatMoreOptionsLabel(activeCount: number): string` (`"Más opciones"` for `0`, `"Más opciones · 1 activa"` for `1`, `"Más opciones · N activas"` for `> 1`), and `hasAdvancedFieldError(errorFlags: readonly boolean[]): boolean`
- [X] T031 [P] [US3] Add unit tests for `formAdvancedFields` (`0`, `1`, `2+`, mixed boolean flags, and `hasAdvancedFieldError`) in `src/core/use-cases/formAdvancedFields.test.ts` (depends on T030)

### Implementation for User Story 3

- [X] T032 [P] [US3] Update `QuickRecordSheet` in `src/presentation/components/QuickRecordSheet.tsx` to use sentence-case title `"Nuevo registro"` and coordinate sticky save footer inside `Sheet` (depends on T005)
- [X] T033 [P] [US3] Refactor `MovementForm` in `src/presentation/components/MovementForm.tsx` to show essentials first (`AmountHero`, `AccountChips`, expense category / income source, brief concept), move advanced fields (subcategory, custom date/time, shared space, savings goal, recurring, balance adjustment) into `CollapsibleSection` (`variant="inline"`, `defaultOpen={false}`) with `formatMoreOptionsLabel` active count on edit, auto-open `CollapsibleSection` when validation fails on an advanced field (FR-023), and place save button in sticky `Sheet` footer (depends on T003, T005, T030)
- [X] T034 [P] [US3] Refactor `TransferForm` in `src/presentation/components/TransferForm.tsx` to show essentials first (`AmountHero`, source account, destination account + swap), move advanced fields (custom date/time, concept/description) into `CollapsibleSection` (`variant="inline"`) with active count badge and auto-expand on error, and place save button in sticky `Sheet` footer (depends on T003, T005, T030)
- [X] T035 [P] [US3] Refactor `PaymentAccountForm` in `src/presentation/components/PaymentAccountForm.tsx` and its host `src/presentation/components/PaymentAccountSettings.tsx` to open in `Sheet` with sticky save footer, show essentials first (name, type, and credit limit when creating a new credit card per `validateNewCreditCard`), and move advanced fields (initial balance, closing day, payment day, credit limit on edit) into `CollapsibleSection` (`variant="inline"`) with active count badge and auto-expand on error (depends on T003, T005, T030)
- [X] T036 [P] [US3] Refactor `InstallmentLoanForm` in `src/presentation/components/InstallmentLoanForm.tsx` to open in `Sheet` with sticky save footer, show essentials first (institution, total amount, installments count, installment amount, 50/30/20 category), and move advanced fields (payment day, interest rate %) into `CollapsibleSection` (`variant="inline"`) with active count badge and auto-expand on error (depends on T003, T005, T030)
- [X] T037 [P] [US3] Refactor `DebtForm` in `src/presentation/components/DebtForm.tsx` to open in `Sheet` with sticky save footer, show essentials first (counterparty name, direction, amount), and move advanced fields (due date, interest rate %) into `CollapsibleSection` (`variant="inline"`) with active count badge and auto-expand on error (depends on T003, T005, T030)
- [X] T038 [P] [US3] Update and add Testing Library wiring tests for `"Más opciones"` (collapsed default, `"Más opciones · N activas"` in edit mode, auto-expand on validation error in hidden advanced field, saving with essentials only) in `src/presentation/components/QuickRecordSheet.test.tsx`, `src/presentation/components/MovementForm.test.tsx`, `src/presentation/components/TransferForm.test.tsx`, `src/presentation/components/PaymentAccountSettings.test.tsx`, `src/presentation/components/InstallmentLoanForm.test.tsx`, and `src/presentation/components/DebtForm.test.tsx` (depends on T032, T033, T034, T035, T036, T037)

**Checkpoint**: User Story 3 is complete — all 6 forms use consistent mobile bottom-sheet / desktop centered-dialog ergonomics with `"Más opciones"` progressive disclosure and error auto-expansion.

---

## Phase 6: User Story 4 - Control y Hábitos centrado en "lo de hoy" (Priority: P2)

**Goal**: Restructure Control y Hábitos into a single centered ~720 px column prioritizing today's habit score and `"Foco de Hoy"` at the top, followed by a `Segmented` selector (`Hábitos` / `Tareas` / `Metas`) keeping the 3 entities distinct (Principle XIII), with `AnalyticsSection` collapsed by default underneath.

**Independent Test**: Open Control y Hábitos with active habits, tasks, and goals: today's habit score and `"Foco de Hoy"` appear immediately at the top without expanding anything; switching `Hábitos` / `Tareas` / `Metas` renders one list at a time with actionable empty states; `AnalyticsSection` starts collapsed and mounts charts on expand; completing a habit or task persists identically.

- [X] T039 [P] [US4] Refactor `ControlHeader` in `src/presentation/components/control/ControlHeader.tsx` to show today's habit score in Fredoka + clean `RingProgress` (removing uppercase `"SCORE"` label), active streak, and clean `WeekStrip` without uppercase month abbreviations or multi-panel desktop header
- [X] T040 [P] [US4] Create `TodayFocusCard` in `src/presentation/components/control/TodayFocusCard.tsx` consuming existing `ControlView` (`view.habits.filter(h => h.scheduledToday)` and `view.tasks.overdue` + `view.tasks.today`) without merging domain entities (Principle XIII), providing one-tap completion actions and a calm `"Todo listo por hoy"` state when empty
- [X] T041 [P] [US4] Update `HabitsPanel`, `TasksPanel`, and `GoalsPanel` in `src/presentation/components/control/HabitsPanel.tsx`, `src/presentation/components/control/TasksPanel.tsx`, and `src/presentation/components/control/GoalsPanel.tsx` to use warm rounded cards, short phrases, one clear primary action per panel, and actionable `EmptyState` (depends on T004)
- [X] T042 [P] [US4] Refactor `AnalyticsSection` in `src/presentation/components/control/AnalyticsSection.tsx` to wrap analytics inside `CollapsibleSection` (`variant="panel"`, `defaultOpen={false}`) and mount heavy charts only when expanded (depends on T003)
- [X] T043 [US4] Refactor `ControlPage` in `src/presentation/components/ControlPage.tsx` to remove the 2-column `wide` layout, stack `ControlHeader` → `TodayFocusCard` → `Segmented` (`Hábitos` / `Tareas` / `Metas`) → `AnalyticsSection` in a single column, and auto-select the matching tab when a ⌘K `focus` deep-link arrives (depends on T039, T040, T041, T042)
- [X] T044 [US4] Update and add Testing Library tests in `src/presentation/components/ControlPage.test.tsx` verifying `"Foco de Hoy"` visibility, `Segmented` switching (`Hábitos` / `Tareas` / `Metas`), collapsed-by-default `AnalyticsSection` toggle, and deep-link tab auto-selection (depends on T043)

**Checkpoint**: User Story 4 is complete — Control y Hábitos surfaces today's score and `"Foco de Hoy"` cleanly with tabbed entity lists and on-demand analytics.

---

## Phase 7: User Story 5 - Espacio Compartido en frases claras y flujo de invitación simple (Priority: P2)

**Goal**: Express shared-space balances as natural tuteo phrases (`"Ana te debe S/ 40.00"`, `"Le debes S/ 40.00 a Ana"`, `"Están al día"`), list shared movements cleanly without rigid tables, and simplify create/join/invite flows in `Sheet` while preserving explicit membership consent (Principle IX) and best-effort realtime over offline-first local data (Principle XII).

**Independent Test**: Test Espacio Compartido both without a space (friendly `EmptyState` with `"Crear espacio"` and `"Unirme con código"`) and with an active space containing divided movements (net hero balance phrase, per-member natural phrases, readable shared movements list with payer and split description, collapsed space settings).

### Pure Use-Case & Unit Test for User Story 5

- [X] T045 [P] [US5] Implement `formatSharedSpacePhrases` in `src/core/use-cases/formatSharedSpacePhrases.ts` exporting `buildSharedSpaceSummary(balances, currentUserId, memberNames?)` (`netCents` integer PEN, `tone: 'positive' | 'negative' | 'settled'`, `heroPhrase` `"Te deben S/ ..."` / `"Debes S/ ..."` / `"Están al día"`, `pairPhrases` with `"Ana te debe S/ 40.00"` / `"Le debes S/ 40.00 a Ana"` / third-party `tone: 'neutral'` `"Ana le debe S/ 40.00 a Luis"`, and `"Otro miembro"` fallback when missing from `memberNames`) and `formatSharedMovementSplit(movement, currentUserId, memberNames?)` (`"Pagó Ana · dividido en partes iguales"`, `"Pagaste tú · división personalizada"`)
- [X] T046 [P] [US5] Add unit tests for `formatSharedSpacePhrases` (empty balances → `"Están al día"`, positive/negative/neutral third-party pairs, missing `memberNames` fallback `"Otro miembro"`, net calculation with cents, split phrase for current user vs member and equal vs custom split) in `src/core/use-cases/formatSharedSpacePhrases.test.ts` (depends on T045)

### Implementation for User Story 5

- [X] T047 [P] [US5] Update `SharedSpaceCreate` and `SharedSpaceJoin` in `src/presentation/components/SharedSpaceCreate.tsx` and `src/presentation/components/SharedSpaceJoin.tsx` to present clean step cards inside `Sheet`, include a one-tap copy-code button on creation, and preserve explicit invitation + acceptance membership rules (Principle IX) (depends on T005)
- [X] T048 [P] [US5] Update `SharedSpaceSettings` in `src/presentation/components/SharedSpaceSettings.tsx` to render permissions mode and leave-space controls inside a `CollapsibleSection` (`variant="panel"`, `defaultOpen={false}`) (depends on T003)
- [X] T049 [US5] Refactor `SharedSpaceBalances` in `src/presentation/components/SharedSpaceBalances.tsx` to display the net balance hero card via `buildSharedSpaceSummary`, per-member balance rows in warm rounded cards without `divide-y`, and a readable list of shared movements (from `LocalSharedMovementRepository.getAllForSpace`) using `formatSharedMovementSplit` without tables or hard borders, preserving `useSharedSpaceRealtime` best-effort sync (Principle XII) (depends on T045)
- [X] T050 [US5] Refactor `SharedSpaceScreen` in `src/presentation/components/SharedSpaceScreen.tsx` to show actionable `EmptyState` (`"Crear espacio"` + `"Unirme con código"`) when no space exists, and `+ Movimiento` primary action opening `SharedMovementForm` in `Sheet` when a space is active; adapt `src/presentation/components/SharedMovementForm.tsx` for the `Sheet` sticky save footer, warm rounded styling, and neutral tuteo copy (depends on T004, T005, T047, T048, T049)
- [X] T051 [P] [US5] Update and add Testing Library tests for natural balance phrases, `"Están al día"` state, shared movements list, and create/join flows in `src/presentation/components/SharedSpaceBalances.test.tsx`, `src/presentation/components/SharedSpaceScreen.test.tsx`, `src/presentation/components/SharedSpaceCreate.test.tsx`, and `src/presentation/components/SharedSpaceJoin.test.tsx` (depends on T047, T049, T050)

**Checkpoint**: User Story 5 is complete — Espacio Compartido communicates balances and shared splits in natural Spanish phrases with a clean invitation flow.

---

## Phase 8: User Story 6 - Mi Progreso ligero y Ajustes ordenados por secciones (Priority: P3)

**Goal**: Restyle Mi Progreso into a light 6-achievement grid with clear `Logrado` / `En curso` pills (preserving the hide toggle), and reorganize Ajustes so `"Completar configuración"` and `"Ver tutorial"` remain visible at the top while all other preferences live inside 5 independent collapsed-by-default sections.

**Independent Test**: Open Mi Progreso to verify the hero summary and 6 achievements with `Logrado` / `En curso` pills and hide toggle. Open Ajustes to verify `"Completar configuración"` and `"Ver tutorial"` are visible above 5 collapsed sections (`Perfil`, `Cuentas e ingresos`, `Notificaciones`, `Apariencia`, `Datos y exportación`), multiple sections can stay open simultaneously, and deep-linking with `focus` or `editAccountId` auto-opens `Cuentas e ingresos`.

- [X] T052 [P] [US6] Refactor `PersonalProgress` in `src/presentation/components/PersonalProgress.tsx` to display a hero summary (`X de 6 logros`) and a light responsive grid (`grid-cols-1 sm:grid-cols-2`) of 6 warm rounded achievement cards with clear `Logrado` / `En curso` pastel pills, preserving the existing visibility toggle
- [X] T053 [P] [US6] Refactor `SettingsScreen` in `src/presentation/components/SettingsScreen.tsx` to remove `xl:grid-cols-2`, keep `"Completar configuración"` and `"Ver tutorial"` visible at the top outside any collapsible section (FR-020), and group all remaining controls into 5 independent `CollapsibleSection`s (`variant="panel"`) backed by `Set<SettingsSectionId>` (`'profile' | 'accounts' | 'notifications' | 'appearance' | 'data'`): **Perfil**, **Cuentas e ingresos**, **Notificaciones**, **Apariencia**, and **Datos y exportación** — all collapsed by default, multiple open simultaneously, auto-opening `'accounts'` when `focus` or `editAccountId` is provided (FR-021) (depends on T003)
- [X] T054 [P] [US6] Update and add Testing Library tests in `src/presentation/components/PersonalProgress.test.tsx` and `src/presentation/components/SettingsScreen.test.tsx` verifying the 6 achievements grid, top visible `"Completar configuración"` / `"Ver tutorial"` entries, all 5 sections starting collapsed, multi-section simultaneous expansion, and auto-opening `Cuentas e ingresos` on deep-link (depends on T052, T053)

**Checkpoint**: User Story 6 is complete — Mi Progreso and Ajustes match the warm minimalist design and close end-to-end visual consistency across the entire app.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Remove dead terminal-era components, verify all automated guards and accessibility/offline criteria, and run the full validation suite.

- [X] T055 Check remaining consumers of `src/components/ui/stat-card.tsx` and `src/presentation/components/dialogChrome.ts` across `src/`; remove any unused files or terminal-style helper classes with zero consumers (FR-002, FR-005)
- [X] T056 [P] Run automatic guards (`src/typographyGuard.test.ts`, `src/voseoGuard.test.ts`, `src/tokens.contrast.test.ts`) and perform a manual tuteo/voseo sweep across all modified presentation files and pure phrase modules (FR-027, FR-028)
- [X] T057 Run full automated verification (`pnpm test`, `pnpm lint`, `pnpm build`) and fix any remaining warnings or type errors (FR-029, SC-006)
- [ ] T058 Execute manual validation checklist in `specs/014-minimalismo-resto-app/quickstart.md` across 360 px mobile, 768 px tablet portrait, 1024 px / 1440 px desktop, light/dark modes, `prefers-reduced-motion: reduce`, keyboard navigation, and DevTools Offline mode (SC-001..SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all user story phases (`CollapsibleSection`, `EmptyState`, updated `Sheet`).
- **Phase 3 (US1 — Shell & Navigation, P1)**: Depends on Phase 2. Establishes the unified `max-w-[720px]` shell and `lg` breakpoint for all screens.
- **Phase 4 (US2 — Finanzas, P1)**: Depends on Phase 2 (and benefits from US1 shell, though pure use-cases `T016`–`T019` can start in parallel with Phase 2/US1).
- **Phase 5 (US3 — Formularios, P1)**: Depends on Phase 2 (`CollapsibleSection`, `Sheet`). Can run in parallel with US2/US4/US5/US6 once Phase 2 is done.
- **Phase 6 (US4 — Control y Hábitos, P2)**: Depends on Phase 2 (`CollapsibleSection`, `EmptyState`). Independent of US2, US3, US5, US6.
- **Phase 7 (US5 — Espacio Compartido, P2)**: Depends on Phase 2 (`CollapsibleSection`, `EmptyState`, `Sheet`). Independent of US2, US3, US4, US6.
- **Phase 8 (US6 — Mi Progreso y Ajustes, P3)**: Depends on Phase 2 (`CollapsibleSection`). Independent of US2, US3, US4, US5.
- **Phase 9 (Polish)**: Depends on all desired user stories being complete.

### User Story Independence

- **US1 (P1)**: Independent after Phase 2.
- **US2 (P1)**: Independent after Phase 2 (note: editing movements/loans/debts in `Sheet` integrates seamlessly with US3 forms when both are complete).
- **US3 (P1)**: Independent after Phase 2.
- **US4 (P2)**: Independent after Phase 2.
- **US5 (P2)**: Independent after Phase 2.
- **US6 (P3)**: Independent after Phase 2.

---

## Parallel Execution Examples

### Phase 2 (Foundational)

```text
# Build all three shared primitives in parallel:
T003: src/components/ui/collapsible-section.tsx
T004: src/components/ui/empty-state.tsx
T005: src/components/ui/sheet.tsx
```

### User Story 1 (Shell & Navigation)

```text
# Update independent shell/system files in parallel:
T008: src/components/theme-provider.tsx
T009: src/app/error.tsx
T010: src/presentation/components/Layout.tsx
T011: src/presentation/components/MobileHeader.tsx + AppTopbar.tsx
T012: src/presentation/components/BottomNav.tsx
T013: src/presentation/components/LoginScreen.tsx
```

### User Story 2 (Finanzas)

```text
# Build pure use-cases in parallel first:
T016: src/core/use-cases/buildFinancesHero.ts
T017: src/core/use-cases/formatFinancesPhrases.ts

# Then update independent tab sub-components in parallel:
T021: FinancesHeader.tsx (and remove FinancesKpis.tsx)
T022: MovementRows.tsx (remove MovementTable)
T024: RuleSection.tsx
T025: InstallmentLoanList.tsx
T026: DebtList.tsx
```

### User Story 3 (Formularios)

```text
# After T030 (formAdvancedFields.ts), refactor all 6 forms in parallel:
T032: QuickRecordSheet.tsx
T033: MovementForm.tsx
T034: TransferForm.tsx
T035: PaymentAccountForm.tsx + PaymentAccountSettings.tsx
T036: InstallmentLoanForm.tsx
T037: DebtForm.tsx
```

### User Story 4 (Control y Hábitos)

```text
# Build independent Control sub-components in parallel:
T039: ControlHeader.tsx
T040: TodayFocusCard.tsx
T041: HabitsPanel.tsx, TasksPanel.tsx, GoalsPanel.tsx
T042: AnalyticsSection.tsx
```

### User Story 5 (Espacio Compartido)

```text
# After T045 (formatSharedSpacePhrases.ts), update components in parallel:
T047: SharedSpaceCreate.tsx + SharedSpaceJoin.tsx
T048: SharedSpaceSettings.tsx
T049: SharedSpaceBalances.tsx
```

### User Story 6 (Mi Progreso y Ajustes)

```text
# Both screens are fully independent:
T052: PersonalProgress.tsx
T053: SettingsScreen.tsx
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + User Story 1)

1. Complete Phase 1 (Setup baseline) and Phase 2 (Foundational primitives: `CollapsibleSection`, `EmptyState`, `Sheet`).
2. Complete Phase 3 (User Story 1: shell, navigation, `lg` breakpoint, `max-w-[720px]`, `theme-color`, login, loading, error).
3. **STOP and VALIDATE**: Run `pnpm test` and inspect mobile (360 px), tablet portrait (768 px), and desktop (1024+ px) in light/dark mode.

### Incremental Delivery

1. **MVP**: Phase 1 + Phase 2 + US1 (Unified shell & navigation).
2. **Core Daily Flows (P1)**: Add US3 (Forms with `"Más opciones"`) and US2 (Finanzas 3 tabs) — validate each independently.
3. **Secondary Daily Flows (P2)**: Add US4 (Control y Hábitos) and US5 (Espacio Compartido) — validate each independently.
4. **Full Consistency (P3)**: Add US6 (Mi Progreso & Ajustes) + Phase 9 (dead-code cleanup, guards, full `quickstart.md` validation).

---

## Notes

- `[P]` marks tasks touching different files with no dependency on incomplete tasks.
- Never add runtime dependencies (Principles I & VII) and never alter IndexedDB schema, migrations, sync, or business rules (FR-024).
- All monetary values remain integer cents in PEN (`formatMoney` / `<Money>` / `parseMoney`).
- All new and updated copy must use neutral Latin American Spanish with tuteo and zero voseo (`src/voseoGuard.test.ts` + manual review).
- Verify `pnpm test` and `pnpm lint` pass after each phase checkpoint before proceeding.
