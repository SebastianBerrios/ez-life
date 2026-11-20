# Verificación spec 013

## Línea base (Phase 1 — T001 y T002)

### T001 — Comandos sobre `main` (2026-11-19)

- `pnpm test`: **PASS** — 168 archivos de prueba, 1,313 tests pasando, 0 fallos preexistentes.
- `pnpm lint`: **PASS** — `✔ No ESLint warnings or errors`.
- `pnpm build`: **PASS** — build completado sin errores (`/` 570 kB, First Load JS 657 kB, offline cache: 32 assets).

### T002 — Consumidores externos de `useDashboardData` y `src/presentation/components/dashboard/*`

| Archivo / Símbolo | Consumidores fuera de `Dashboard.tsx` y `dashboard/*` | Acción en T071 |
|---|---|---|
| `useDashboardData.ts` | Ninguno | Borrar |
| `dashboard/BudgetPanel.tsx` | `src/presentation/components/finances/RuleSection.tsx` importa `{ STATUS_DOT_CLASS, STATUS_LABEL, STATUS_PROGRESS_CLASS, BucketBar }` (y `BudgetPanel.tsx` importa `Amount` de `./Amount` y `BudgetRow` de `useDashboardData`) | Extraer `STATUS_DOT_CLASS`, `STATUS_LABEL`, `STATUS_PROGRESS_CLASS`, `BucketBar` y el tipo de fila a `src/presentation/components/finances/` (o compartir `Amount`) antes de borrar `BudgetPanel.tsx` |
| `dashboard/Amount.tsx` | Ninguno directo (solo usado por `BudgetPanel`, `HeroBalance`, `DesktopKpis`, `dashboardParts.test.tsx`); puede reutilizarse en `summary/` y `BucketBar` | Mover a lugar compartido si `BucketBar`/`summary/` lo usan, o borrar si se reemplaza |
| `dashboard/HeroBalance.tsx` | Ninguno | Borrar |
| `dashboard/DesktopKpis.tsx` | Ninguno | Borrar |
| `dashboard/FocusPanel.tsx` | Ninguno | Borrar |
| `dashboard/LoansCard.tsx` | Ninguno | Borrar |
| `dashboard/PrimaryGoalCard.tsx` | Ninguno (se adapta/reutiliza en `summary/PrimaryGoal.tsx`) | Borrar tras T067 |
| `dashboard/RecentTransactions.tsx` | Ninguno | Borrar |
| `dashboard/SharedSpaceCard.tsx` | Ninguno | Borrar |
| `dashboard/Sparkline.tsx` | Ninguno (`core/use-cases/buildCycleSparkline.ts` solo era consumido por `useDashboardData`) | Borrar `Sparkline.tsx` |
| `dashboard/dashboardParts.test.tsx` | Solo pruebas de componentes en `dashboard/` | Borrar tras reemplazar por pruebas de `summary/` |

## Phase 2 — Foundational (T003–T023)

- `pnpm test` (T023): **PASS** — 171 archivos de prueba, 1,338 tests pasando, 0 fallos (incluye retiro de `useRecurrenceEvaluator` y `evaluateMonthlyRecurrences`, Dexie v19, sync `reminder_skips`, `recordAdapter.opening_date`, `LocalMovementRecurrenceRepository.adoptLegacySources`).
- `pnpm lint` (T023): **PASS** — `✔ No ESLint warnings or errors`.
- Migración SQL escrita en `supabase/migrations/20261110120000_balance_onboarding_reminders.sql` (NO aplicada; pendiente de T099).

## Phase 8 & 9 — Verificación automatizada, navegador y seguridad (2026-11-20)

### T095 — Suite completa (`pnpm test`)
- **PASS** — 197 archivos de prueba, 1,437 tests pasando, 0 fallos.
- Incluye:
  - `src/core/use-cases/calculateMonthBalance.test.ts` (44 tests: 24 casos de `balance-rules.md` + invariante por propiedad con 250 secuencias aleatorias multi-mes, SC-001).
  - `src/core/use-cases/buildPendingRegistrations.test.ts`, `buildRegistrationPrefill.test.ts`, `evaluateNotifications.test.ts` (simulación de 3 meses sin acciones = 0 movimientos creados y 1 notificación por ítem y mes, SC-004).
  - `src/core/use-cases/buildCompactRule.test.ts`, `buildSetupChecklist.test.ts`.
  - `src/presentation/components/Dashboard.test.tsx`, `Dashboard.us1.test.tsx`, `Dashboard.us3.test.tsx`, `OnboardingWizard.test.tsx` (flujo completo 6 pasos con fake-indexeddb), `MainFlow.test.tsx`, `SettingsScreen.test.tsx`.
  - `src/voseoGuard.test.ts` (**PASS**, 0 voseos).
  - `src/typographyGuard.test.ts` (**PASS**, 0 apariciones de `font-mono`, `label-mono`, `JetBrains` o `uppercase` de etiqueta en `src/`, SC-006).
  - `src/tokens.contrast.test.ts` (**PASS**, todos los pares semánticos en claro y oscuro ≥ 4.5:1 AA, SC-007).

### T096 — Lint, TypeScript y Build (`pnpm lint`, `tsc --noEmit`, `pnpm build`)
- `pnpm exec tsc --noEmit`: **PASS** (0 errores).
- `pnpm lint`: **PASS** (`✔ No ESLint warnings or errors`).
- `pnpm build`: **PASS** (`/` 580 kB, First Load JS 668 kB, `Offline cache: 27 assets`, fuentes Fredoka y Figtree empaquetadas localmente con `next/font/local` sin llamadas externas a Google Fonts).
- Dependencias en `package.json`: sin dependencias runtime nuevas (Principios I y VII).

### T093 — Verificación visual en navegador (Chrome DevTools MCP sobre `http://localhost:3013`)
- **Tema del sistema sin elección previa**:
  - SO claro → `localStorage.getItem('theme') === null`, `html.classList` incluye `light`, `background: rgb(251, 245, 234)` (`#FBF5EA`), `color: rgb(58, 39, 69)` (`#3A2745`).
  - SO oscuro → `localStorage.getItem('theme') === null`, `html.classList` incluye `dark`, `background: rgb(36, 26, 43)` (`#241A2B`), `color: rgb(246, 238, 227)` (`#F6EEE3`).
- **Persistencia en Ajustes → Apariencia**: selector `Claro` / `Oscuro` / `Sistema` aplica al instante y persiste `dark` tras recarga completa (`ignoreCache: true`).
- **Fuentes mismo origen (pestaña Network)**: `GET http://localhost:3013/_next/static/media/75fd644a71365107-s.p.woff2 [200]` y `GET http://localhost:3013/_next/static/media/93af595f71d0a236-s.p.woff2 [200]` (`__fredoka_*` y `__figtree_*` cargadas, cero peticiones externas).
- **Móvil 390×844 (SC-003, FR-038)**:
  - Sin scroll: `balance-amount` (`bottom: 180px`), `balance-flows` (`bottom: 212px`) y el primer ítem de `pending-registrations` (`bottom: 426px`) todos visibles dentro de los 844 px.
  - Acción primaria única (FR-038): solo `[data-tour="add"]` (`+`) usa `bg-primary` en el Resumen.
  - Controles táctiles: 0 botones visibles menores a 44 px de alto.
  - `prefers-reduced-motion: reduce` emulado sin errores.
- **Escritorio 1280×800**: columna centrada de `720px`, barra lateral de `240px`, Cuentas y Deudas lado a lado (`accountsAndDebtsSideBySide: true`).
- **Tour guiado (4 pasos) móvil y escritorio**: hallazgo detectado y corregido durante la verificación — al reabrir el tour desde Ajustes (`Ver tutorial`), `GuidedTour` ahora observa el DOM con `MutationObserver` si el destino aún está en carga (`Skeleton`), logrando resaltado visible en los 4 pasos tanto en 390 px como en escritorio (`balance`, `accounts`, `add`, `setup`/`settings`). También se agregó modo compacto (`compact`) a `ThemeToggle` en la barra lateral de escritorio para evitar desborde horizontal en `w-60`.

### T097 — Recorrido `quickstart.md` §2 a §7 en navegador
- **§2 Usuario nuevo (onboarding 6 pasos + tour)**: **sin diferencias**. Efectivo S/ 100 + BCP S/ 1,500 + BBVA S/ 800 de S/ 5,000 (pago día 15) + Préstamo Banco 6/12 cuotas (S/ 1,000 día 5) + 50/30/20 + Categorías → Balance `S/ 1,600.00`, `Entró S/ 0.00 · Salió S/ 0.00`, tarjeta `Usaste S/ 800.00 de S/ 5,000.00 · Pagas el 15`, préstamo saldo `S/ 6,000.00` y `Próxima cuota S/ 1,000.00 · día 5`, tour arranca en Paso 1 de 4. Tiempo medido del onboarding completo con banco + tarjeta + préstamo: **~1 min 55 s** (< 5 min, SC-002; omitiendo opcionales < 1 min, < 2 min SC-002).
- **§3 Reglas del Balance (comprobación 1,600 + 500 − 1,200 − 200 + 300 = 1,000)**: **sin diferencias**. Tras ejecutar los 8 pasos (ingreso S/ 500 a BCP, gasto efectivo S/ 300, compra BBVA S/ 100, pagos BCP→BBVA S/ 100 + S/ 700 + S/ 100, ahorro S/ 200, retiro ahorro S/ 300): Balance `S/ 1,000.00`, `Entró S/ 500.00 · Salió S/ 1,200.00`, `Ahorraste S/ 200.00`, `Sacaste S/ 300.00 de tus ahorros`, 50/30/20 `Te quedan S/ 1,100.00 para necesidades básicas` y `Este mes sacaste más de lo que ahorraste`; al pasar al mes siguiente (`Mes siguiente`) → Arranque `S/ 1,000.00` (`Entró S/ 0.00 · Salió S/ 0.00`).
- **§4 "Por registrar" y notificaciones**: **sin diferencias**. Sueldo y pago de BBVA salen de "Por registrar" al registrarse con su vínculo estructurado; `Omitir este mes` limpia el ítem del mes actual; 0 movimientos creados automáticamente; notificación `register_due` única verificada en `useNotificationEvaluator.test.tsx` y simulación de 3 meses en `evaluateNotifications.test.ts`.
- **§5 Usuario existente (`onboarding_step = 3` v1 + tarjeta sin línea)**: **sin diferencias**. Entra directo al Resumen sin repetir onboarding, muestra el tour una vez, muestra `Completa tu configuración · 2 de 4`, tarjeta `Visa Antigua` muestra `Debes S/ 450.00` + botón `Agregar línea de crédito`, que abre directamente el formulario de edición de esa tarjeta en Ajustes con `Línea de crédito`.
- **§6 Modo Offline (DevTools → Offline)**: **sin diferencias**. Banner `Sin conexión · tus cambios se guardan en este dispositivo.` visible; movimientos, `Omitir este mes` y navegación entre meses operan con normalidad y **0 errores en consola**.
- **§7 Visual**: **sin diferencias** (cubierto en T093 + guardias T090/T092).

### T098 — Revisión de seguridad y modo offline
- **FR-014 (nada se registra solo)**: auditoría sobre `db.movements.(put|add|bulkPut)` confirma que ninguna ruta nueva (`adoptLegacySources`, `LocalOnboardingRepository`, `LocalInstallmentLoanRepository.create(..., alreadyPaid)`, `LocalRegistrationRepository`, `useSummaryData`, `useNotificationEvaluator`) crea movimientos sin acción explícita del usuario.
- **RLS `reminder_skips`**: `supabase/migrations/20261110120000_balance_onboarding_reminders.sql` habilita RLS con política `"own rows only"` (`auth.uid() = user_id` y existencia previa en `ez_life.profiles`), revoca `ALL` por defecto y otorga solo `select, insert, update` a `authenticated` (borrado lógico vía `deleted_at`, sin trigger sobre `auth.users`).
- **`app_metadata`**: sin cambios ni referencias en `src/` ni `supabase/migrations/20261110120000_balance_onboarding_reminders.sql`.
- **Offline-first (SC-008)**: onboarding, "Por registrar", `reminder_skips` (Dexie v19 + `SYNCED_TABLES` + `CustomSyncLayer`), checklist y tour operan 100% contra IndexedDB y encolan cambios para sincronizar al reconectar.

### T099 — Migración Supabase (BLOQUEADA — pendiente de confirmación del dueño)
- Archivo listo en `supabase/migrations/20261110120000_balance_onboarding_reminders.sql`.
- **NO ejecutada** (regla de flota: requiere confirmación explícita del dueño antes de correr `fleet-auth-audit.sql`, `supabase db push --dry-run` y `supabase db push`).
