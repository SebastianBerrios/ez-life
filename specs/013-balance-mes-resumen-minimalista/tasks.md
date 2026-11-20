---

description: "Task list for spec 013 — Balance del mes, cuentas y deudas, tutorial y Resumen minimalista"
---

# Tasks: Balance del mes, cuentas y deudas, tutorial y Resumen minimalista

**Input**: Design documents from `/specs/013-balance-mes-resumen-minimalista/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R14), data-model.md, contracts/ (`balance-rules.md`, `repositories.md`, `supabase-migration.md`, `ui-copy.md`), quickstart.md

**Tests**: INCLUDED. La constitución (Principio IV) exige un test unitario por caso de uso y un test de Testing Library por cada cambio de wiring de UI; el plan y el quickstart enumeran los archivos de prueba. Los cambios puramente de estilo/tokens no exigen test (Principio IV), salvo las guardias `typographyGuard` y `tokens.contrast` (SC-006/SC-007). Sin e2e.

**Organization**: Tareas agrupadas por historia de usuario. Dentro de una historia, el test de un caso de uso se escribe **antes** y debe fallar antes de implementar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencia de tareas incompletas)
- **[Story]**: historia de usuario (US1…US6); Setup, Foundational y Polish no llevan etiqueta
- Todos los comandos se ejecutan desde la raíz `D:\Programming\Frontend\ez-life` con `pnpm`

## Reglas transversales (aplican a TODAS las tareas)

- **Dinero**: enteros en céntimos, solo PEN; nunca floats (Principio VIII). En formularios usar `parseMoney`/`formatMoney`.
- **Capas**: lógica en `src/core/use-cases` (pura, sin imports de React/Dexie); solo `src/infrastructure/repositories/local` toca `db`; `src/presentation` solo renderiza y delega (Principio III).
- **Copy**: español latinoamericano neutro con **tuteo**, sin voseo, escrito a mano en los componentes; los mensajes de error de dominio también (`DomainError`). `src/voseoGuard.test.ts` debe seguir verde. El copy literal está en `contracts/ui-copy.md`.
- **Dependencias**: ninguna dependencia runtime nueva (Principios I y VII). Sin librería de tours, de fechas ni de property-testing: los tests por propiedad usan un generador pseudoaleatorio con semilla escrito a mano.
- **Supabase (reglas de la flota)**: la migración se **escribe** pero **NUNCA** se aplica con MCP (`apply_migration`/`execute_sql`) ni con `supabase db pull`; solo `supabase db push` con confirmación explícita del dueño (ver T099).
- **Dexie/offline-first**: todo dato nuevo se guarda primero en IndexedDB y sincroniza por la cola existente; nada requiere red.
- **Nada se registra solo**: ninguna tarea puede introducir creación automática de movimientos (FR-014).

## Path Conventions

Proyecto único Next.js 14 (App Router) en capas: `src/core`, `src/infrastructure`, `src/presentation`, `src/components/ui`, `src/app`, `supabase/migrations`. Alias `@/*` → `src/*`. Ver "Source Code" en `plan.md`.

---

## Phase 1: Setup (línea base)

**Purpose**: Dejar constancia del punto de partida antes de tocar código.

- [X] T001 Ejecutar `pnpm test`, `pnpm lint` y `pnpm build` sobre `main` y anotar en `specs/013-balance-mes-resumen-minimalista/verification.md` (crear el archivo con el encabezado "Verificación spec 013") el resultado de cada uno y cualquier fallo **preexistente**, para distinguirlo de regresiones propias
- [X] T002 Ejecutar `grep -rn "useDashboardData\|presentation/components/dashboard\|from \"./dashboard\|HeroBalance\|DesktopKpis\|FocusPanel\|BudgetPanel\|LoansCard\|RecentTransactions\|SharedSpaceCard\|Sparkline\|PrimaryGoalCard\|Amount" src` y anotar en `specs/013-balance-mes-resumen-minimalista/verification.md` qué archivos de `src/presentation/components/dashboard/` tienen consumidores **fuera** de `Dashboard.tsx` (esa lista decide qué se puede borrar en T071)

**Checkpoint**: línea base registrada.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: Modelo de datos, esquema Dexie/sync, migración escrita, utilidades puras compartidas y retiro de la generación automática de recurrencias. **Ninguna historia puede empezar hasta terminar esta fase.**

**⚠️ CRITICAL**: el retiro de la generación automática (T019–T023) se hace aquí, **antes** del Resumen nuevo, para que ningún movimiento aparezca solo durante el desarrollo (plan, paso 3).

### Modelo de dominio y contratos

- [X] T003 Ampliar `src/core/domain/models/types.ts` con los campos nuevos, todos opcionales, citando estas restricciones literalmente en comentarios JSDoc: `PaymentAccount.credit_limit?: number` (céntimos, > 0; solo `kind = 'credit'`), `PaymentAccount.closing_day?: number` (1–31; solo crédito), `PaymentAccount.payment_day?: number` (1–31; solo crédito), `PaymentAccount.opening_date?: Date` (día local en que se declaró `opening_balance`); `IncomeSource.pay_day?: number` (1–31) y `IncomeSource.received_month?: string` (`'YYYY-MM'`); `InstallmentLoan.payment_day?: number` (1–31); `Profile.onboarding_step?` ampliado a `0..6` (antes `0..3`), `Profile.onboarding_version?: 2`, `Profile.balance_since?: string` (`'YYYY-MM'`), `Profile.checklist_dismissed?: boolean`, `Profile.checklist_not_applicable?: ChecklistKey[]` con `type ChecklistKey = 'accounts' | 'cards' | 'loans'`, `Profile.tour_seen?: boolean`. Agregar la entidad `ReminderSkip extends BaseEntity` con `id: UUID` (= `stableId('skip:<userId>:<itemKey>')`), `user_id: UUID`, `item_key: string` (`<kind>:<refId>:<YYYY-MM>`, `kind ∈ income | recurrence | installment | card`), `month: string` (`'YYYY-MM'`), más `created_at`, `updated_at`, `deleted_at?`. Agregar `'register_due'` a `NotificationType`. Agregar los tipos `RegistrationKind = 'income' | 'recurrence' | 'installment' | 'card'`, `PendingRegistration` (`key`, `kind`, `refId`, `title`, `amount`, `day`, `overdue`), `MonthBalance`, `CardDebtSummary` y `SetupChecklist` tal como están definidos en `data-model.md` (sección "Entidades derivadas"; los derivados pueden ir también junto a su caso de uso si se prefiere, pero deben exportarse desde un único lugar)
- [X] T004 Actualizar `src/core/domain/repositories/IRepositories.ts` según `contracts/repositories.md`: agregar `IReminderSkipRepository`/`IRegistrationRepository` (`getInputs(userId, today)`, `skip(userId, itemKey)`, `unskip(userId, itemKey)`); extender `IInstallmentLoanRepository` (`create(data, alreadyPaid = 0)`, `recordInstallmentPayment(loanId, n, date, accountId)`, `recordPrincipalPayment(loanId, cents, date, adjustment, accountId)`); extender `IProfileRepository` con `ensureBalanceSince(userId, now)`; `IIncomeSourceRepository.save` y `IPaymentAccountRepository.save` aceptan los campos nuevos; `IMovementRecurrenceRepository` reemplaza `generate` por `adoptLegacySources(userId)` (T019). Depende de T003

### Dexie v19, sync y migración

- [X] T005 En `src/infrastructure/db/db.ts` agregar `this.version(19).stores({ reminder_skips: 'id, user_id, month' })` después de la versión 18, la propiedad tipada `reminder_skips!: Table<ReminderSkip, string>`, y `'reminder_skips'` en `SYNCED_TABLES` (leer primero el comentario de `SYNCED_TABLES` sobre por qué omitirla falla en silencio); verificar que la tabla recibe los hooks `creating`/`updating` que escriben en `sync_queue`. Los campos opcionales nuevos de las demás tablas **no** llevan índice. Depende de T003
- [X] T006 [P] En `src/infrastructure/sync/CustomSyncLayer.ts` agregar `'reminder_skips'` a `tables` **después** de `profiles` (no depende de otras tablas) y, en `src/infrastructure/sync/CustomSyncLayer.test.ts`, añadir un test que haga push de un `ReminderSkip` encolado y pull de uno remoto
- [X] T007 [P] En `src/infrastructure/sync/recordAdapter.ts` agregar `'opening_date'` a `dateFields` (timestamp nuevo; los demás campos nuevos son números, texto o booleanos) y cubrirlo en `src/infrastructure/sync/recordAdapter.test.ts` (ida y vuelta Date ↔ ISO, y `undefined` → `null`)
- [X] T008 Escribir (sin aplicar) `supabase/migrations/20261110120000_balance_onboarding_reminders.sql` siguiendo **al pie de la letra** `contracts/supabase-migration.md`: (1) columnas nuevas con `add column if not exists` y sus `check` (`credit_limit bigint check (credit_limit is null or credit_limit > 0)`, `closing_day`/`payment_day`/`pay_day` `smallint` 1–31, `opening_date timestamptz`, `received_month`/`balance_since` con regex `'^\d{4}-(0[1-9]|1[0-2])$'`, `payment_day` en `installment_loans`, `profiles.onboarding_version smallint`, `checklist_dismissed boolean`, `checklist_not_applicable jsonb`, `tour_seen boolean`); (2) reemplazar `profiles_onboarding_step_check` por `check (onboarding_step between 0 and 6)` con `drop constraint if exists` (leer `20261009014333_audit_sync_safety.sql` para confirmar el nombre del constraint); (3) tabla `ez_life.reminder_skips` con RLS "own rows only" que exige perfil propio, índice `(user_id, month)`, `revoke all ... from public, anon, authenticated` y luego `grant select, insert, update` (sin `delete`/`truncate`), sin trigger sobre `auth.users` ni auto-inserción (Principio IX); (4) reemplazar el `CHECK` de `notifications.type` copiando la lista **completa** de `20261009195513_personal_achievements.sql` más `'register_due'` (copiar, no reescribir de memoria); (5) `create or replace function ez_life.sync_record(...)` con el cuerpo **literal** de la última definición en `20261016120000_payment_accounts_time_priority.sql` cambiando solo la lista blanca para añadir `'reminder_skips'`. Cabecera con el mismo estilo que `20261016120000_...sql`. **No ejecutar `supabase db push`, MCP ni `execute_sql`**

### Utilidades puras compartidas (cada una con su test colocado)

- [X] T009 [P] Crear `src/core/use-cases/registrationItemKey.ts` con `registrationItemKey(kind, refId, month): string` (formato `<kind>:<refId>:<YYYY-MM>`) y `parseItemKey(key)`, y `src/core/use-cases/registrationItemKey.test.ts` (ida y vuelta, `refId` con `:` rechazado o soportado de forma documentada, kind inválido lanza)
- [X] T010 [P] Crear `src/core/use-cases/clampDayToMonth.ts` con `clampDayToMonth(year, monthIndex, day): number` (día 29/30/31 en meses cortos → último día del mes, incluyendo febrero bisiesto) y `src/core/use-cases/clampDayToMonth.test.ts`
- [X] T011 [P] Crear `src/core/use-cases/parseDayOfMonth.ts` con `parseDayOfMonth(text): number | undefined` (vacío → `undefined`; fuera de 1–31 o no entero → `DomainError('Ingresa un día entre 1 y 31.')`) y `src/core/use-cases/parseDayOfMonth.test.ts`
- [X] T012 [P] Crear `src/core/use-cases/pickPrimaryAccount.ts` con `pickPrimaryAccount(accounts, userId): PaymentAccount | undefined` (cuenta `debit` activa —no archivada ni eliminada— más antigua, ordenada por `created_at` y luego `id` para que sea determinista; si no hay, la cuenta "Efectivo" `kind = 'cash'`; `undefined` si no hay ninguna. Es solo el valor por defecto del selector de cuenta de origen; **no** hay campo para marcarla) y `src/core/use-cases/pickPrimaryAccount.test.ts` (incluye un caso de desempate por `created_at`/`id` y uno con cuentas archivadas)
- [X] T013 [P] Modificar `src/core/use-cases/calculateAccountBalances.ts` para que ignore los movimientos de una cuenta con fecha **anterior** a su `opening_date` (día local; R2); cuentas sin `opening_date` deben dar exactamente el mismo resultado de siempre. Ampliar `src/core/use-cases/calculateAccountBalances.test.ts` con: movimiento previo ignorado, movimiento el mismo día contado, y test de regresión sin `opening_date`
- [X] T014 [P] Modificar `src/core/use-cases/validatePaymentAccount.ts`: `credit_limit`, `closing_day`, `payment_day` solo válidos con `kind = 'credit'`; días enteros en 1–31; añadir `validateNewCreditCard` (tarjeta **nueva**: `credit_limit` obligatoria, y consumo inicial `-opening_balance` ≤ `credit_limit`); mensajes en tuteo (`La línea de crédito es obligatoria.`, `El consumo no puede superar la línea de crédito.`, `Ingresa un día entre 1 y 31.`). Mantener la regla actual de `opening_balance` en Ajustes. Ampliar `src/core/use-cases/validatePaymentAccount.test.ts` si existe o crearlo

### Repositorios base

- [X] T015 Actualizar `src/infrastructure/repositories/local/LocalPaymentAccountRepository.ts` para guardar `credit_limit`, `closing_day`, `payment_day`, `opening_date`; crear una tarjeta nueva llama a `validateNewCreditCard` (T014); editar una tarjeta existente **sin** línea de crédito sigue permitido (FR-035); `ensureDefault` sin cambios. Ampliar `src/infrastructure/repositories/local/LocalPaymentAccountRepository.test.ts`. Depende de T003, T014
- [X] T016 [P] Actualizar `src/infrastructure/repositories/local/LocalIncomeSourceRepository.ts` para guardar `pay_day` (1–31, validado con `parseDayOfMonth`) y `received_month` (`'YYYY-MM'`), sin romper filas existentes. Ampliar el test del repositorio (en `src/infrastructure/repositories/local/LocalRepositories.test.ts` o un `LocalIncomeSourceRepository.test.ts` nuevo). Depende de T003, T011
- [X] T017 [P] Agregar `ensureBalanceSince(userId, now)` a `src/infrastructure/repositories/local/LocalProfileRepository.ts`: si **no existe** perfil local no hace nada (nunca crea un perfil stub: en un dispositivo nuevo, antes del primer pull, ganaría LWW sobre el perfil remoto); si existe y falta `balance_since`, lo fija **una vez** a `'YYYY-MM'` del mes en curso vía el `save` existente (merge); idempotente (segunda llamada no cambia nada ni encola otro push). Tests en `src/infrastructure/repositories/local/LocalRepositories.test.ts` (o `LocalProfileRepository.test.ts` nuevo): sin perfil no escribe; con perfil sin el campo lo fija; segunda llamada no encola otro push. Depende de T003
- [X] T018 [P] Actualizar `src/infrastructure/repositories/local/LocalNotificationRepository.ts` (y sus tipos) para aceptar y listar el tipo `'register_due'` sin cambios de comportamiento para los demás tipos; verificar con un test en `src/infrastructure/repositories/local/LocalRepositories.test.ts`. Depende de T003

### Retirar la generación automática (FR-014, R6)

- [X] T019 Reemplazar `LocalMovementRecurrenceRepository.generate` por `adoptLegacySources(userId)` en `src/infrastructure/repositories/local/LocalMovementRecurrenceRepository.ts`: conservar **solo** el primer bucle (convertir movimientos antiguos con `is_recurring` sin regla en reglas) y **no** crear ocurrencias; las ocurrencias ya generadas no se tocan (FR-018). Esta tarea y T021 pueden fusionarse en un solo commit
- [X] T020 Crear `src/infrastructure/repositories/local/LocalMovementRecurrenceRepository.test.ts` (**no existe hoy**; la cobertura previa de la generación era `evaluateMonthlyRecurrences.test.ts` y `useRecurrenceEvaluator.test.tsx`, que se eliminan en T021/T022): "no genera" — tres meses simulados con una regla activa dejan **0** movimientos nuevos (SC-004), las ocurrencias preexistentes quedan intactas, y `adoptLegacySources` convierte un movimiento legado en regla una sola vez (idempotente). Depende de T019
- [X] T021 Eliminar `src/presentation/hooks/useRecurrenceEvaluator.ts` y `src/presentation/hooks/useRecurrenceEvaluator.test.tsx`; en `src/presentation/components/MainFlow.tsx` quitar su uso y llamar a `adoptLegacySources(userId)` una sola vez al entrar a la app autenticada (no es un evaluador periódico); actualizar `src/presentation/components/MainFlow.test.tsx` (mocks/aserciones que mencionaban `useRecurrenceEvaluator`) y `src/presentation/components/dashboard/*` **solo** si importan lo eliminado (el resto se retira en T071). No tocar `useTaskRecurrenceEvaluator`. Depende de T019
- [X] T022 Eliminar `src/core/use-cases/evaluateMonthlyRecurrences.ts` y `src/core/use-cases/evaluateMonthlyRecurrences.test.ts`; revisar `src/core/use-cases/evaluateTaskRecurrence.ts` (aparece en el grep de referencias) y quitar solo referencias muertas, **sin** tocar la lógica de recurrencia de tareas. Depende de T019, T021
- [X] T023 Ejecutar `pnpm test` y `pnpm lint`; corregir referencias rotas por T019–T022. Anotar el resultado en `specs/013-balance-mes-resumen-minimalista/verification.md`. Depende de T019–T022

**Checkpoint**: tipos, Dexie v19, sync, migración escrita, utilidades puras y retiro de la generación automática listos; `pnpm test` en verde. Las historias pueden empezar.

---

## Phase 3: User Story 1 — Ver cuánto dinero tengo este mes (Priority: P1) 🎯 MVP

**Goal**: El Resumen muestra el **Balance del mes** (`opening + entró − salió − ahorraste + sacaste + ajuste`) con "Entró S/ X · Salió S/ Y", sin "Capital disponible".

**Independent Test** (`spec.md` US1): usuario con arranque S/ 1,000 (débito + efectivo), ingreso S/ 500 y gasto S/ 300 en efectivo → Resumen muestra "Balance del mes S/ 1,200" y "Entró S/ 500 · Salió S/ 300"; compra con tarjeta S/ 100 → S/ 1,100; pagar la tarjeta con débito → sigue S/ 1,100.

### Tests (escribir primero; deben fallar)

- [X] T024 [US1] Crear `src/core/use-cases/calculateMonthBalance.test.ts` con un test de tabla que cubra **fila por fila** `contracts/balance-rules.md`: las 18 filas de la tabla de clasificación, la tabla de ajustes manuales, y los 24 "Casos de referencia mínimos" (SC-001 exige ≥ 12; los casos 21 y 22 cubren cuentas creadas después del primer mes y los 23 y 24 los meses anteriores a `balance_since`), cada uno afirmando `entro`, `salio`, `ahorraste`, `sacaste`, `ajuste`, `balance`, `savingsNet`, `opening` y, en **todos**, el invariante `balance === opening + entro − salio − ahorraste + sacaste + ajuste` y `savingsNet === ahorraste − sacaste`. Añadir un test **por propiedad**: generador pseudoaleatorio con semilla (sin dependencia nueva, p. ej. mulberry32) que produzca ≥ 200 secuencias de movimientos válidos sobre cuentas `debit`/`cash`/`savings`/`credit` (ingresos, gastos normales y de categoría Ahorro, transferencias entre todos los pares, ajustes) y compruebe el invariante en cada una. Casos a incluir explícitamente: archivada excluida, movimiento anterior a `opening_date` ignorado, mes anterior a `balance_since`, pago mixto previa 400 + compra 100 (pago 300 luego 200), transferencia C→S neto 0

### Implementación

- [X] T025 [US1] Crear `src/core/use-cases/calculateMonthBalance.ts` con `calculateMonthBalance(input: { month: Date; accounts: PaymentAccount[]; movements: Movement[]; distributionCategories: DistributionCategory[]; balanceSince?: string }): MonthBalance` — pura, determinista, céntimos enteros. Dos caminos independientes que deben coincidir: (a) **forma cerrada** `Balance(M) = efectivoGastable(M) − deudaCorriente(M)`, `Arranque(M) = Balance(M − 1)`, con `efectivoGastable` = saldo de cuentas `debit`+`cash` no archivadas hasta el cierre de M (respetando `opening_date`, usando/alineado con `calculateAccountBalances`; el `opening_balance` de una cuenta cuya apertura es posterior al mes de `balance_since` **no** entra en el Arranque sino como `ajuste` en su mes de apertura —R2, casos 21 y 22—) + neto de movimientos sin cuenta (como `calculateUnassignedBalance`), y `deudaCorriente` por tarjeta = compras − pagos que exceden la deuda previa (puede quedar < 0, no se recorta); `deudaPrevia inicial = max(0, −(opening_balance + movimientos de esa tarjeta anteriores al inicio de balance_since))`, los pagos consumen primero la deuda previa (R3); (b) **flujos** clasificando cada movimiento del mes según la tabla de `balance-rules.md` (filas 1–18, `t = min(a, deudaPrevia restante)`, ajustes aparte). Mes calculado con `calculateMonthlyCycle`; `movements` es el **historial completo**; `deleted_at` se ignora; cuentas archivadas no cuentan como `S`/`V`. Devolver `cards: CardDebtSummary[]` (`accountId`, `name`, `owed` ≥ 0, `previousDebt`, `creditLimit?`, `paymentDay?`). Para un mes M anterior al mes de `balance_since`, una cuenta aporta al Balance solo si no tiene `opening_date` o su mes de apertura es ≤ M (casos 23 y 24); `Arranque(M0)` (M0 = mes de `balance_since`) usa la fórmula especial de `contracts/balance-rules.md` y puede diferir de Balance(M0−1) por diseño. Hacer pasar T024 completo. Depende de T003, T013, T024
- [X] T026 [US1] Crear `src/presentation/hooks/useSummaryData.ts` (hook nuevo que reemplazará a `useDashboardData`) con `useSummaryData(userId, refDate)`: lee con `useLocalQuery` (mismo patrón que `useDashboardData`) cuentas, movimientos completos, categorías de distribución y perfil (`balance_since`), compone `calculateMonthBalance` y expone `{ view: { balance: MonthBalance, ... } }`; observa `profiles`. En esta historia solo expone el slice de balance y tarjetas (el resto se añade en US3/US4/US5). Test en `src/presentation/hooks/useSummaryData.test.tsx`: reactivo a un movimiento nuevo, mes seleccionado distinto del actual, usuario sin datos. Depende de T025
- [X] T027 [P] [US1] Crear `src/presentation/components/summary/BalanceHero.tsx` + `BalanceHero.test.tsx`: cifra grande del balance con `formatMoney` (fuente Fredoka llegará en US6; usar las clases existentes) y debajo `Entró S/ 500 · Salió S/ 300`; **línea aparte solo si existen**: `Ahorraste S/ 200`, `Sacaste S/ 300 de tus ahorros`, `Ajuste de saldo S/ 40`; balance negativo → signo + frase `Gastaste más de lo que tenías este mes` en tono neutro-informativo (sin color de error); atributo `data-tour="balance"`; conserva el control de ocultar importes (`useHideAmounts`); el balance se recibe por props (sin lógica de negocio). Test: positivo, negativo, líneas aparte presentes/ausentes, importes ocultos, mes sin movimientos (`Entró S/ 0 · Salió S/ 0`)
- [X] T028 [US1] En `src/presentation/components/Dashboard.tsx` reemplazar el hero actual ("Capital disponible" / "Balance del ciclo") por `BalanceHero` alimentado por `useSummaryData`, de modo que el Resumen **ya no muestre "Capital disponible"** (FR-011); el resto del Dashboard sigue con `useDashboardData` hasta US4. No tocar `calculateAvailableCapital` (se mantiene para Finanzas). Actualizar `src/presentation/components/Dashboard.test.tsx` y `src/presentation/components/dashboard/dashboardParts.test.tsx` en lo afectado. Depende de T026, T027
- [X] T029 [US1] En `src/presentation/components/MainFlow.tsx` llamar a `LocalProfileRepository.ensureBalanceSince(userId, new Date())` una sola vez y **solo cuando `MainFlow` ya está en el paso `app`** (onboarding completo ⇒ el perfil existe; usuarios existentes: fija `balance_since` sin pedirles nada, R4; usuarios nuevos lo fija el onboarding en US2). Verificar en `src/infrastructure/auth/observeAccountSession.ts` que `completed` se resuelve después del primer pull; si no es así, condicionar la llamada al primer `onSyncCompleted`. Cubrirlo en `src/presentation/components/MainFlow.test.tsx` (se llama una vez; segunda carga no reescribe; un dispositivo sin perfil local no escribe). Depende de T017
- [X] T030 [US1] Verificar el Independent Test de US1 con un test de integración ligero en `src/presentation/components/Dashboard.test.tsx` (fake-indexeddb): arranque 1,000 + ingreso 500 + gasto 300 → "1,200" y "Entró S/ 500 · Salió S/ 300"; compra con tarjeta 100 → 1,100; pago débito→tarjeta 100 → 1,100. Depende de T028

**Checkpoint**: el Resumen muestra el Balance del mes correcto; US1 es demostrable por sí sola.

---

## Phase 4: User Story 2 — Contar mi situación real al empezar (Priority: P1)

**Goal**: Onboarding de 6 pasos (Ingresos → Dinero → Tarjetas → Préstamos → Distribución → Categorías), pasos atómicos e idempotentes, compatible con la numeración anterior; cuenta de origen en cuotas/abonos.

**Independent Test** (`spec.md` US2): usuario nuevo con sueldo S/ 3,000, banco S/ 1,500, efectivo S/ 100, tarjeta (línea S/ 5,000, consumido S/ 800, paga el 15) y préstamo en cuotas (6 de 12 pagadas) → Resumen con Balance S/ 1,600, tarjeta "Usaste S/ 800 de S/ 5,000 · Pagas el 15" y préstamo con saldo y próxima cuota.

### Casos de uso puros (tests primero; todos [P])

- [X] T031 [P] [US2] Crear `src/core/use-cases/resolveOnboardingProgress.ts` + `resolveOnboardingProgress.test.ts`: `(profile) => { step: 0..6; completed: boolean }` con `onboarding_version = 2` → paso tal cual (`completed` = `step === 6`), y la tabla fija de compatibilidad **un test por fila** para perfiles sin versión: `0 → 0`, `1 → 1` (retoma en "¿Dónde tienes tu dinero?"), `2 → 5`, `3 → 6` y completo (R10)
- [X] T032 [P] [US2] Crear `src/core/use-cases/validateOnboardingCard.ts` + `validateOnboardingCard.test.ts`: `(draft) => void`, lanza `DomainError` en tuteo: nombre obligatorio; línea de crédito > 0 (`La línea de crédito es obligatoria.`); consumo ≥ 0 y ≤ línea (`El consumo no puede superar la línea de crédito.`); `closing_day`/`payment_day` opcionales enteros 1–31 (`Ingresa un día entre 1 y 31.`)
- [X] T033 [P] [US2] Crear `src/core/use-cases/validateOnboardingLoan.ts` + `validateOnboardingLoan.test.ts`: `(draft) => void`; **con cuotas**: monto, cuota y cuotas totales ≥ 1, cuotas pagadas ∈ [0, total] (`Las cuotas pagadas no pueden superar las cuotas totales.`), día de pago 1–31 opcional; **informal**: saldo pendiente > 0; entidad/persona obligatoria

### Repositorios

- [X] T034 [US2] En `src/infrastructure/repositories/local/LocalInstallmentLoanRepository.ts`: `create(data, alreadyPaid = 0)` fija `remaining_installments = installment_count − alreadyPaid` y `status` (`'settled'` si `alreadyPaid === installment_count`) **sin crear** `InstallmentPayment` ni `Movement`; `recordInstallmentPayment(loanId, n, date, accountId)` y `recordPrincipalPayment(loanId, cents, date, adjustment, accountId)` guardan `account_id` en el egreso que ya crean (Principio X, FR-020, R13); `payment_day` se guarda. Ampliar `src/infrastructure/repositories/local/LocalInstallmentLoanRepository.test.ts`: `alreadyPaid` sin movimientos, préstamo saldado, egreso con `account_id` para cuota y para abono a capital (la pregunta cuotas/monto se conserva). Depende de T003, T004
- [X] T035 [US2] En `src/infrastructure/repositories/local/LocalOnboardingRepository.ts` implementar, cada método en **una** transacción Dexie que guarda datos **y** `onboarding_step` (+ `onboarding_version: 2`) y es idempotente por id de borrador generado en el cliente al crear cada fila: `progress(userId)` usando `resolveOnboardingProgress` (devuelve `0..6`), `completeStep(userId, step: 2..6)`, `skipStep(userId, step)` (pasos 3 y 4: avanza sin datos), `declareNotApplicable(userId, key: 'cards' | 'loans')` (agrega la clave a `checklist_not_applicable` sin duplicar y avanza; la clave `'accounts'` se declara dentro de `saveAccounts`, T037). Nunca toca una cuenta existente salvo por id estable. Depende de T031
- [X] T036 [US2] En `LocalOnboardingRepository.ts` agregar `saveIncome(userId, { income, payDay?, receivedThisMonth })` (reemplaza el ingreso de `saveStartingPoint`): crea/actualiza la `IncomeSource` con `pay_day` y, si `receivedThisMonth`, `received_month = 'YYYY-MM'` del mes actual; fija `onboarding_step = 1`, `onboarding_version = 2` y `balance_since` del mes actual (R4) en la misma transacción. Depende de T016, T035
- [X] T037 [US2] En `LocalOnboardingRepository.ts` agregar `saveAccounts(userId, { cash: number; banks: { id, name, kind: 'debit' | 'savings', balance }[]; declareNoBanks?: boolean })`: **siempre** asegura la cuenta "Efectivo" (aunque quede en S/ 0, sin duplicarla si ya existe) y crea las cuentas de banco con `opening_balance` y `opening_date` = hoy (R2); saldos negativos → `DomainError('El saldo no puede ser negativo.')`; con `declareNoBanks: true` (botón «Solo uso efectivo» de T044; solo válido con `banks` vacío, si no lanza `DomainError`) agrega `'accounts'` a `checklist_not_applicable` sin duplicar, **en la misma transacción** que guarda Efectivo con su monto; sin ese flag, aunque no haya bancos, Cuentas queda pendiente en el checklist; avanza a `onboarding_step = 2`. Depende de T035
- [X] T038 [US2] En `LocalOnboardingRepository.ts` agregar `saveCards(userId, cards[])`: valida cada tarjeta con `validateOnboardingCard`; crea `PaymentAccount` `kind = 'credit'` con `credit_limit`, `closing_day`, `payment_day`, `opening_balance = −consumido` y `opening_date` = hoy, ids estables por borrador; avanza a `onboarding_step = 3`. Depende de T032, T035
- [X] T039 [US2] En `LocalOnboardingRepository.ts` agregar `saveLoans(userId, loans[])`: valida con `validateOnboardingLoan`; con cuotas crea `InstallmentLoan` vía `create(data, alreadyPaid)` con `payment_day` (sin movimientos); sin cuotas crea un `Debt` con `direction: 'borrowed'`, `origin: 'manual'`, `amount` = saldo pendiente, `settled_amount: 0` (sin movimientos, Principio X); avanza a `onboarding_step = 4`. Depende de T033, T034, T035
- [X] T040 [US2] Ampliar `src/infrastructure/repositories/local/LocalOnboardingRepository.test.ts` (y `onboardingStartingBalance.test.ts` si se rompe) cubriendo: cada paso atómico e idempotente (reenviar no duplica cuentas/tarjetas/préstamos — FR-026), retomar tras interrupción, tabla de compatibilidad v1→v2 end-to-end, "Efectivo" existente intacto, `declareNotApplicable` (tarjetas y préstamos), `skipStep`, `saveAccounts` con `declareNoBanks` (Efectivo S/ 100 queda en 10000 y `'accounts'` queda como "no aplica" sin duplicarse al reenviar; con bancos y el flag → `DomainError`), y que **ningún** paso crea `Movement` salvo lo ya existente. Depende de T036–T039
- [X] T041 [P] [US2] Actualizar `src/infrastructure/auth/observeAccountSession.ts`: `AccountState.startStep` pasa a `1..6` y `completed` sale de `resolveOnboardingProgress`; ampliar `src/infrastructure/auth/observeAccountSession.test.ts` (perfil v1 con `onboarding_step = 3` → completo, no repite onboarding; v1 con `2` → retoma en 5). Depende de T031

### Componentes del onboarding

- [X] T042 [US2] Renombrar los pasos actuales: `src/presentation/components/OnboardingStep3.tsx` → `OnboardingStep6.tsx` (categorías) y su `OnboardingStep3.test.tsx` → `OnboardingStep6.test.tsx`; luego `OnboardingStep2.tsx` → `OnboardingStep5.tsx` (distribución) y `OnboardingStep2.test.tsx` → `OnboardingStep5.test.tsx`; actualizar sus imports en `OnboardingWizard.tsx` y en `MainFlow.tsx` sin cambios funcionales (usar `git mv`). Debe hacerse **antes** de T043–T046
- [X] T043 [P] [US2] Reescribir `src/presentation/components/OnboardingStep1.tsx` como paso "Tus ingresos" + `OnboardingStep1.test.tsx`: `Ingreso mensual` (obligatorio, `parseMoney`), `¿Qué día te pagan?` (opcional, `parseDayOfMonth`), `¿Ya recibiste tu sueldo de este mes?` (Sí / No), botón `Continuar` deshabilitado sin ingreso válido; llama a `saveIncome`; errores junto al campo con `role="alert"`. Depende de T036, T042
- [X] T044 [P] [US2] Crear `src/presentation/components/OnboardingStep2.tsx` + `OnboardingStep2.test.tsx` ("¿Dónde tienes tu dinero?"): campo fijo `Efectivo` (S/ 0 por defecto), lista de cuentas con `Nombre`, `Tipo` (Débito / Ahorros), `Saldo actual`, botón `+ Agregar cuenta`; botón `Solo uso efectivo` (visible solo si no hay filas de banco; llama a `saveAccounts({ cash, banks: [], declareNoBanks: true })`, que guarda Efectivo y marca `'accounts'` como "no aplica" en la misma transacción; Cuentas cuenta como completa en el checklist); `Continuar` **siempre habilitado** (sin bancos y sin pulsar «Solo uso efectivo», Cuentas queda pendiente); `El saldo no puede ser negativo.` como `role="alert"`; llama a `saveAccounts`. Test: el botón solo aparece sin filas de banco y llama a `saveAccounts` con el monto de Efectivo y `declareNoBanks: true`; `Continuar` sin bancos y sin el botón no lo declara. Depende de T037, T042
- [X] T045 [P] [US2] Crear `src/presentation/components/OnboardingStep3.tsx` + `OnboardingStep3.test.tsx` ("¿Tienes tarjetas de crédito?"): por tarjeta `Nombre`, `Línea de crédito` (obligatoria), `Consumido hasta hoy`, `Día de cierre`, `Día de pago`, y resumen `Usaste S/ X de S/ Y · Pagas el 15`; botones `Guardar tarjetas y continuar`, `No tengo tarjetas` (→ `declareNotApplicable('cards')`), `Omitir por ahora` (→ `skipStep`, queda pendiente en el checklist); validaciones `La línea de crédito es obligatoria.` y `El consumo no puede superar la línea de crédito.`. Depende de T038, T042
- [X] T046 [P] [US2] Crear `src/presentation/components/OnboardingStep4.tsx` + `OnboardingStep4.test.tsx` ("¿Tienes préstamos?"): `Entidad o persona`, interruptor `¿Pagas en cuotas?`; con cuotas `Monto`, `Cuota`, `Cuotas totales`, `Cuotas ya pagadas`, `Día de pago`; sin cuotas `Saldo pendiente`; botones `Guardar préstamos y continuar`, `No tengo préstamos`, `Omitir por ahora`; `Las cuotas pagadas no pueden superar las cuotas totales.`. Depende de T039, T042
- [X] T047 [US2] Actualizar `src/presentation/components/OnboardingWizard.tsx` a 6 pasos con indicador de progreso `Ingresos`, `Dinero`, `Tarjetas`, `Préstamos`, `Distribución`, `Categorías`; `startStep: 1..6`; `mode='settings'` abre 5 (distribución), 6 (categorías) o el paso pendiente que reciba. Ampliar `OnboardingWizard.test.tsx`: avance 1→6, "Omitir" en 3 y 4, retomar en un paso intermedio, modo ajustes. Depende de T043–T046
- [X] T048 [US2] Actualizar `src/presentation/components/MainFlow.tsx`: máquina de estados `loading → login → onboarding-wizard → app` con `startStep` de 1..6; `onEditDistribution` → paso 5 y `onEditCategories` → paso 6 (antes 2 y 3); ajustar `src/presentation/components/MainFlow.test.tsx` y `src/presentation/components/SettingsScreen.test.tsx` si fijan los números antiguos. Depende de T041, T047
- [X] T049 [US2] En el formulario de pago de cuota/abono de préstamo (`src/presentation/components/InstallmentLoanList.tsx` y, si corresponde, `InstallmentLoanForm.tsx`) agregar un selector de **cuenta de origen** con `pickPrimaryAccount` por defecto y pasarlo a `recordInstallmentPayment`/`recordPrincipalPayment`; el pago a capital sigue preguntando si reduce cuotas o monto y a cuánto (FR-020). Ampliar `InstallmentLoanList.test.tsx` y `InstallmentLoanForm.test.tsx`: cuenta por defecto, cambio de cuenta, el movimiento queda con esa `account_id`. Depende de T012, T034
- [X] T050 [US2] Verificar el Independent Test de US2 con un test de integración en `src/presentation/components/OnboardingWizard.test.tsx` (fake-indexeddb): recorrer los 6 pasos con los datos del caso y comprobar `calculateMonthBalance` = S/ 1,600, tarjeta con `owed` 80000 y `creditLimit` 500000, préstamo con 6 cuotas restantes y **ningún** `Movement` creado. Depende de T025, T047

**Checkpoint**: un usuario nuevo completa el onboarding ampliado; usuarios v1 no lo repiten; cuota/abono con cuenta de origen.

---

## Phase 5: User Story 3 — La app me recuerda; yo registro (Priority: P2)

**Goal**: Ningún ingreso ni gasto aparece solo; lo que toca aparece en **Por registrar** (Registrar / Omitir este mes) y llega una notificación `register_due` una vez por ítem y mes.

**Independent Test** (`spec.md` US3): recurrencia mensual S/ 80 el día 5; al llegar el día 5 no se crea ningún movimiento; "Por registrar" muestra "Gimnasio · S/ 80 · día 5"; Registrar abre el formulario prellenado y al guardar el ítem desaparece y el Balance baja S/ 80.

### Casos de uso puros (tests primero)

- [X] T051 [US3] Crear `src/core/use-cases/buildPendingRegistrations.test.ts`: ventanas de aparición (`REGISTRATION_LEAD_DAYS = { income: 0, recurrence: 0, installment: 3, card: 3 }`), recorte de día 29–31 en meses cortos, adelanto que cruza al mes anterior se recorta al día 1, cubierto por vínculo estructurado (sueldo = `income_source_id`; recurrencia = `recurrence_rule_id` + `recurrence_month`; cuota = `installment_payment_id` de ese préstamo; tarjeta = `TRANSFER` con `to_account_id`), un movimiento **sin** vínculo (misma descripción/monto) **no** cubre (FR-019), omitido por `ReminderSkip`, préstamo saldado excluido, sueldo con `received_month` = mes actual excluido, sin día de pago → sin ítem, solo mes en curso real, orden por día, `overdue` cuando día efectivo < hoy, tarjeta con consumo 0 excluida, el mes siguiente reaparece lo omitido
- [X] T052 [US3] Crear `src/core/use-cases/buildPendingRegistrations.ts` con la firma `(input: { today: Date; rules: MovementRecurrence[]; incomeSources: IncomeSource[]; loans: InstallmentLoan[]; loanIdByPaymentId: Record<string,string>; accounts: PaymentAccount[]; cardOwed: Record<string,number>; monthMovements: Movement[]; skips: ReminderSkip[] }) => PendingRegistration[]` y la constante exportada `REGISTRATION_LEAD_DAYS`; usa `registrationItemKey` y `clampDayToMonth`; hace pasar T051. Depende de T009, T010, T051
- [X] T053 [P] [US3] Crear `src/core/use-cases/buildRegistrationPrefill.ts` + `buildRegistrationPrefill.test.ts` (la lógica de "qué formulario y con qué valores" no puede vivir en el componente — Principio III): `(item: PendingRegistration, ctx: { accounts; primaryAccountId? }) => RegistrationPrefill` con `{ tab, amountCents, accountId?, toAccountId?, incomeSourceId?, recurrenceRuleId?, recurrenceMonth?, loanId?, description? }`: sueldo → pestaña ingreso con `incomeSourceId`; recurrencia → gasto/ingreso con `recurrenceRuleId` + `recurrenceMonth`; cuota → pago de cuota del préstamo con cuenta principal; tarjeta → transferencia `accountId` = cuenta principal, `toAccountId` = tarjeta, monto sugerido = consumo. Depende de T012
- [X] T054 [US3] Modificar `src/core/use-cases/evaluateNotifications.ts` agregando el parámetro `pendingRegistrations: PendingRegistration[]`: emite una notificación `register_due` por ítem visible (ni omitido ni cubierto) con `related_id = key`, `cycle_key = 'YYYY-MM'`, título `Toca registrar: <nombre>` y cuerpo `<nombre> · S/ <monto> · día <día>`, sin duplicar vía `hasEquivalent` (una vez por ítem y mes); las demás reglas no cambian. Ampliar `src/core/use-cases/evaluateNotifications.test.ts`: una `register_due` por ítem, refrescar/evaluar varias veces no duplica, el mes siguiente genera otra, y **simulación de 3 meses sin acciones del usuario = 0 movimientos creados y exactamente 1 notificación por ítem y mes** (SC-004). Depende de T052

### Datos

- [X] T055 [US3] Crear `src/infrastructure/repositories/local/LocalRegistrationRepository.ts` + `LocalRegistrationRepository.test.ts` implementando `getInputs(userId, today)` (**un solo punto de lectura**: reglas, fuentes de ingreso, préstamos, pagos de cuota con su `loanIdByPaymentId`, cuentas, movimientos del mes, omisiones del mes), `skip(userId, itemKey)` (crea/actualiza `ReminderSkip` con id `stableId('skip:<userId>:<itemKey>')`, idempotente entre dispositivos) y `unskip(userId, itemKey)` (borrado lógico con `deleted_at`). Test: omitir dos veces no duplica, `unskip` revive el ítem, omisión de un mes no afecta al siguiente. `getInputs` devuelve solo insumos del mes: el consumo de tarjeta **no** sale de aquí (ver T057/T058). Depende de T005, T009
- [X] T056 [P] [US3] Ampliar `src/infrastructure/repositories/local/LocalMovementRepository.test.ts` (y ajustar `LocalMovementRepository.ts` solo si el test lo exige): guardar un movimiento con `recurrence_rule_id` + `recurrence_month` **no desactiva la regla** ni crea duplicado del mismo mes (el índice único `[recurrence_rule_id+recurrence_month]` de Dexie lo impide). Depende de T003

### Hooks

- [X] T057 [US3] Extender `src/presentation/hooks/useSummaryData.ts`: carga `LocalRegistrationRepository.getInputs`, calcula `cardOwed` con el helper puro `selectCardOwed(balance: MonthBalance): Record<string, number>` (nuevo: `src/core/use-cases/selectCardOwed.ts` + `selectCardOwed.test.ts`; una entrada por tarjeta con su `owed`, incluida la de `owed` 0) y compone `buildPendingRegistrations`; expone `pending: PendingRegistration[]`, `register(item)` (devuelve `RegistrationPrefill` vía `buildRegistrationPrefill`) y `skip(item)`; observa también `reminder_skips`, `installment_payments` y `movements` para que registrar haga desaparecer el ítem de forma reactiva; solo el mes en curso real (otro mes → lista vacía). Ampliar `useSummaryData.test.tsx`. Depende de T026, T052, T053, T055
- [X] T058 [US3] Modificar `src/presentation/hooks/useNotificationEvaluator.ts` para cargar `LocalRegistrationRepository.getInputs`, derivar los pendientes con `buildPendingRegistrations` y pasarlos a `evaluateNotifications`, respetando `inapp_enabled` / `push_enabled` / permiso del navegador como hoy (Principio XI: un solo sistema). El evaluador ya carga `allMovements` y `distributionCategories`; además carga las cuentas, llama a `calculateMonthBalance({ month: now, accounts, movements: allMovements, distributionCategories, balanceSince: profile?.balance_since })` y pasa `selectCardOwed(...)` (T057) como `cardOwed` de `buildPendingRegistrations`. Actualizar el comentario del hook, que aún menciona `useRecurrenceEvaluator`. Ampliar `src/presentation/hooks/useNotificationEvaluator.test.tsx`: una tarjeta con `owed` 80000 y `payment_day` dentro de la ventana emite `register_due` con cuerpo `… · S/ 800 · día N`; una tarjeta sin consumo no emite nada. Depende de T054, T055, T057

### Componentes

- [X] T059 [P] [US3] Extender los formularios para aceptar valores iniciales y vínculos: `src/presentation/components/QuickRecordSheet.tsx` gana el prop opcional `prefill?: RegistrationPrefill` (sin `prefill` el comportamiento es exactamente el actual); `MovementForm.tsx` acepta `initialValues` y `links` (`recurrence_rule_id`, `recurrence_month`, `income_source_id`) y los guarda en el movimiento; `TransferForm.tsx` acepta `initialValues` (origen, destino, monto sugerido); el pago de cuota usa el formulario de préstamo con su cuenta de origen (T049). Tests en `QuickRecordSheet.test.tsx`, `MovementForm.test.tsx`, `TransferForm.test.tsx`, `InstallmentLoanList.test.tsx`: prellenado correcto, los vínculos viajan al movimiento guardado, sin `prefill` nada cambia. Depende de T049, T053
- [X] T060 [P] [US3] Crear `src/presentation/components/summary/PendingRegistrations.tsx` + `PendingRegistrations.test.tsx`: filas `Gimnasio · S/ 80 · día 5` con botones **Registrar** y **Omitir este mes**; vencidas destacadas (énfasis neutro, no alarma); se muestran los **3 primeros** (por día, vencidos primero) y, con N > 3, `Ver todos (N)` expande la lista **en el mismo lugar** (sin ruta nueva); vacío `No tienes nada pendiente este mes.`; `data-testid="pending-registrations"`; recibe lista y callbacks por props (sin lógica). Test: orden, destacado de vencidas, Registrar/Omitir llaman al callback correcto, estado vacío, 3 ítems sin botón, 4 ítems con `Ver todos (4)` que al pulsarlo muestra los 4
- [X] T061 [US3] Montar `PendingRegistrations` en `src/presentation/components/Dashboard.tsx` **inmediatamente debajo de `BalanceHero`** (sección 2) y conectar `register(item)` → abrir `QuickRecordSheet` con el `prefill` resultante desde `src/presentation/components/MainFlow.tsx` (el sheet ya vive allí) y `skip(item)` → `LocalRegistrationRepository.skip`; al guardar el movimiento el ítem sale de la lista y el Balance baja. Test de integración en `Dashboard.test.tsx`/`MainFlow.test.tsx` con el Independent Test de US3: regla S/ 80 día 5 → 0 movimientos creados, ítem listado, Registrar → formulario prellenado → guardar → ítem desaparece y Balance −80; Omitir este mes → desaparece y reaparece el mes siguiente. Depende de T057, T059, T060

**Checkpoint**: nada se registra solo; "Por registrar" y notificaciones funcionan.

---

## Phase 6: User Story 4 — Un Resumen minimalista (Priority: P2)

**Goal**: El Resumen deja de ser un tablero: seis secciones en orden (Balance, Por registrar, Cuentas y Deudas, 50/30/20 compacto, Meta de ahorro principal, Checklist si aplica), mobile-first, sin los contenidos retirados.

**Independent Test** (`spec.md` US4): a 390 px sin scroll se ven balance, "Entró · Salió" y el primer ítem de "Por registrar"; el orden coincide; no aparecen "Terminal de control", "Resumen Ejecutivo", "Rendimiento conductual" ni "Foco de Hoy".

- [X] T062 [US4] Crear `src/core/use-cases/buildCompactRule.test.ts`: base = ingreso declarado (suma de `income_sources`) × porcentaje del bucket y **no** suma a "Entró" (FR-010); Necesidades/Deseos `spent` = `EXPENSE` sin ajustes ni transferencias, incluida la compra con tarjeta el día de la compra y los gastos desde ahorros; una cuota de préstamo cuenta en el bucket de su préstamo (Principio X); Ahorro `spent` = `savingsNet` (puede ser negativo, con barra de piso 0 y frase `Este mes sacaste más de lo que ahorraste` sin tono de error); frases `Te quedan S/ 885 para necesidades` y, si se excede, `Te pasaste S/ 120 en deseos` (tono neutro); el pago de tarjeta (transferencia) **no** cuenta como gasto
- [X] T063 [US4] Crear `src/core/use-cases/buildCompactRule.ts` con `buildCompactRule(movements, buckets, expectedIncome, savingsNet) => CompactRule` (puro; no modificar `buildRuleView`, cuyo ajuste es de la spec 014) y hacer pasar T062. Depende de T062
- [X] T064 [US4] Extender `src/presentation/hooks/useSummaryData.ts` con: `accounts` (débito, efectivo y ahorros no archivados con saldo vía `calculateAccountBalances`), `debts` (tarjetas desde `MonthBalance.cards` con `owed`, `creditLimit?`, `paymentDay?`; préstamos en cuotas con saldo por la lógica existente y próxima cuota vía `nextInstallment`; saldados excluidos), `rule: CompactRule` (con `savingsNet`), y `primaryGoal` vía `pickPrimarySavingsGoal`; expone también `progress.visible` para `MobileRouteLinks`. Ampliar `useSummaryData.test.tsx` (tarjeta sin línea → `creditLimit` indefinido; préstamo con `alreadyPaid = total` no aparece). Depende de T057, T063
- [X] T065 [P] [US4] Crear `src/presentation/components/summary/AccountsAndDebts.tsx` + `AccountsAndDebts.test.tsx` (`data-tour="accounts"`): **Cuentas** lista débito/efectivo/ahorros con saldo (sin archivadas); **Deudas**: tarjeta `Usaste S/ 800 de S/ 5,000 · Pagas el 15`, tarjeta sin línea `Debes S/ 800` con la acción `Agregar línea de crédito` (callback por props, no se pide nada al actualizar), préstamo con saldo y `Próxima cuota S/ 250`; vacío de deudas `No tienes tarjetas ni préstamos. Si los tienes, agrégalos para ver cuánto debes.`; en escritorio Cuentas y Deudas lado a lado. Test: cada variante de tarjeta, vacío, archivada oculta, importes ocultos
- [X] T066 [P] [US4] Crear `src/presentation/components/summary/CompactRule.tsx` + `CompactRule.test.tsx`: barra compacta 50/30/20 con las frases de `CompactRule`; ahorro negativo como información (sin color de error); barra con piso en 0. Presentación pura
- [X] T067 [P] [US4] Crear `src/presentation/components/summary/PrimaryGoal.tsx` + `PrimaryGoal.test.tsx` reutilizando/adaptando `dashboard/PrimaryGoalCard.tsx` y `pickPrimarySavingsGoal`; sin meta → estado vacío amable
- [X] T068 [P] [US4] Agregar los campos de tarjeta a `src/presentation/components/PaymentAccountForm.tsx` (o el archivo que renderice el formulario de cuentas en `PaymentAccountSettings.tsx`) y a `PaymentAccountSettings.tsx`: `Línea de crédito` (obligatoria al **crear** una tarjeta; opcional al editar una existente), `Día de cierre`, `Día de pago`, solo cuando `kind = 'credit'`; el flujo `Agregar línea de crédito` del Resumen abre este formulario sobre esa tarjeta. Ampliar `PaymentAccountSettings.test.tsx`: crear tarjeta sin línea → error en tuteo; editar tarjeta antigua agregándole línea; campos ocultos para débito/efectivo/ahorros. Depende de T015
- [X] T069 [US4] Reescribir `src/presentation/components/Dashboard.tsx` con las **seis secciones en este orden**: (1) `BalanceHero`, (2) `PendingRegistrations`, (3) `AccountsAndDebts`, (4) `CompactRule`, (5) `PrimaryGoal`, (6) reservado para `SetupChecklistCard` (se monta en US5); alimentado **solo** por `useSummaryData`; móvil una columna; escritorio con barra lateral conservada, columna centrada de ~720 px y Cuentas/Deudas lado a lado, **sin** cuadrícula de indicadores; el botón "+" central como única acción primaria destacada (los "Registrar" de la lista son secundarios, FR-038); `MobileRouteLinks` pasa a `showProgress={progress.visible}` (el bloque "Mi progreso" sale del Resumen pero sigue en su ruta); se conserva **solo en móvil, después de la sección 6**, como acceso de navegación y no como sección (FR-034). Conectar `Agregar línea de crédito` con T068 desde `MainFlow.tsx`. Depende de T061, T064–T068
- [X] T070 [US4] Reescribir `src/presentation/components/Dashboard.test.tsx`: orden exacto de secciones (SC-009), **ausencia** de `Capital disponible`, `Rendimiento conductual`, `Foco de Hoy`, `Terminal de control`, `Resumen Ejecutivo` y de la cuadrícula de indicadores, estados vacíos, y el Independent Test de US4 (balance, "Entró · Salió" y primer ítem de "Por registrar" presentes en el DOM antes que Cuentas); los accesos de navegación móviles (`MobileRouteLinks`) no cuentan como sección. Actualizar `src/presentation/components/MobileRouteLinks.test.tsx` si cambia `showProgress`. Depende de T069
- [X] T071 [US4] Retirar el código muerto: usando la lista de T002 y un `grep` fresco, borrar `src/presentation/hooks/useDashboardData.ts` y los componentes de `src/presentation/components/dashboard/` (`HeroBalance`, `DesktopKpis`, `FocusPanel`, `BudgetPanel`, `LoansCard`, `RecentTransactions`, `SharedSpaceCard`, `Sparkline`, `PrimaryGoalCard`, `Amount`, `dashboardParts.test.tsx`) que **no** tengan consumidores fuera del Resumen; conservar y mover los que otra pantalla use (p. ej. `Amount`, `Sparkline`) a su lugar correcto. `pnpm test` y `pnpm lint` en verde. Depende de T069, T070

**Checkpoint**: el Resumen es minimalista y completo salvo el checklist (US5) y el estilo (US6).

---

## Phase 7: User Story 5 — Completar mi configuración y conocer la app (Priority: P3)

**Goal**: Tarjeta "Completa tu configuración · N de 4" y tour guiado de 4 pasos, ambos repetibles desde Ajustes; usuarios existentes ven el tour una vez y el checklist sin repetir el onboarding.

**Independent Test** (`spec.md` US5): usuario que omitió tarjetas y préstamos → "Completa tu configuración · 2 de 4"; abrir Tarjetas abre el paso 3; completarlo → "3 de 4"; terminar el onboarding lanza el tour de 4 pasos; "Omitir" lo cierra en cualquier paso.

- [X] T072 [US5] Crear `src/core/use-cases/buildSetupChecklist.test.ts`: 4 ítems (`income`, `accounts`, `cards`, `loans`); *Ingresos* completo con ≥ 1 fuente con monto > 0; *Cuentas* completo con ≥ 1 cuenta `debit`/`savings` **o** `'accounts'` en `checklist_not_applicable`; *Tarjetas*/*Préstamos* completos con datos (tarjeta `credit`; `InstallmentLoan` o `Debt` informal) **o** declarados `'cards'`/`'loans'`; "Omitir" **no** completa; `visible = !checklist_dismissed && doneCount < 4`; `nextPending` = primer pendiente en el orden ingresos → cuentas → tarjetas → préstamos; "No tengo tarjetas" + "No tengo préstamos" permite llegar a 4 de 4
- [X] T073 [US5] Crear `src/core/use-cases/buildSetupChecklist.ts` con `buildSetupChecklist(input: { incomeSources; accounts; loans; debts; profile }) => SetupChecklist` (puro) y hacer pasar T072. Depende de T072
- [X] T074 [P] [US5] Crear `src/presentation/hooks/useGuidedTour.ts` + `useGuidedTour.test.tsx`: estado del tour con `step` (1..4), `next`, `skip`, `finish` (persiste `tour_seen = true` vía `LocalProfileRepository.save`), `replay` (reinicia **sin** cambiar `tour_seen`); activo mientras `tour_seen` sea falso/ausente y el onboarding esté completo (cubre usuarios nuevos y existentes, FR-030/FR-032); sin lógica de negocio fuera de la transición de pasos. Test: transiciones, `skip` en cualquier paso marca visto, `replay` no altera `tour_seen`, perfil v1 completo → tour activo una sola vez
- [X] T075 [P] [US5] Crear `src/presentation/components/summary/GuidedTour.tsx` + `GuidedTour.test.tsx` (≈ 100 líneas, **sin librería**, Principios I y VII): 4 pasos que apuntan a `data-tour="balance|accounts|add|setup|settings"` (`add` y `settings` los pone T075a) con `getBoundingClientRect`, usando el **primer elemento visible** (`width > 0`) de `querySelectorAll`; el paso 3 apunta al botón "+" (`add`); el paso 4 apunta a la tarjeta de checklist (`setup`) si existe y, si no, a la entrada de nav Ajustes (`settings`); copy literal: (1) `Tu balance del mes` — "Aquí ves cuánto dinero tienes este mes.", (2) `Tus cuentas y deudas` — "Revisa dónde está tu dinero y cuánto debes.", (3) `Registrar` — "Toca el botón + para anotar un gasto o un ingreso.", (4) `Completa tu configuración` — "Desde aquí (o en Ajustes) agregas lo que te falta."; botones `Siguiente`, `Listo`, `Omitir` (en cada paso); respeta `prefers-reduced-motion`; foco gestionado y cierre con Escape. Test: recorre 4 pasos, `Omitir` en cualquier paso, objetivo ausente no rompe
- [X] T075a [P] [US5] En `src/presentation/components/BottomNav.tsx` agregar `data-tour="add"` a los dos botones "+" (móvil y barra lateral) y `data-tour="settings"` a la entrada Ajustes de ambas navegaciones; `GuidedTour` (T075) usa el primer elemento visible de cada selector. Test en `src/presentation/components/BottomNav.test.tsx` (crearlo si no existe): los atributos existen y solo un objetivo de cada tipo es visible a la vez
- [X] T076 [US5] Extender `src/presentation/hooks/useSummaryData.ts` con `checklist: SetupChecklist` (observa `profiles`, cuentas, fuentes de ingreso, préstamos y deudas) y ampliar `useSummaryData.test.tsx`. Depende de T064, T073
- [X] T077 [P] [US5] Crear `src/presentation/components/summary/SetupChecklistCard.tsx` + `SetupChecklistCard.test.tsx` (`data-tour="setup"`): `Completa tu configuración · N de 4`, ítems Ingresos / Cuentas / Tarjetas / Préstamos con estado, cada uno abre su paso (callback con la clave), botón descartar → `checklist_dismissed = true` en el perfil; oculta si `visible = false`. Test: contador, abrir ítem, descartar
- [X] T078 [US5] Montar `SetupChecklistCard` como sección 6 en `src/presentation/components/Dashboard.tsx` y el `GuidedTour` en `src/presentation/components/MainFlow.tsx` (visible al entrar al Resumen con `tour_seen` falso, incluido el usuario con onboarding v1 ya completo: tour **una sola vez** + checklist con lo pendiente, sin repetir el onboarding); agregar `onCompleteSetup(key)` (abre `OnboardingWizard` en `mode='settings'` en el paso 1 ingresos / 2 dinero / 3 tarjetas / 4 préstamos según la clave) y `onReplayTour`. Ampliar `MainFlow.test.tsx` y `Dashboard.test.tsx`: tour tras terminar el onboarding, usuario v1 completo ve tour una vez y no repite onboarding (SC-005), completar Tarjetas lleva el contador de 2 a 3. Depende de T047, T074, T075, T075a, T076, T077
- [X] T079 [US5] En `src/presentation/components/SettingsScreen.tsx` agregar las filas `Completar configuración` (abre el paso pendiente aunque la tarjeta se haya descartado, FR-029) y `Ver tutorial` (repite el tour, FR-031), conectadas a `onCompleteSetup`/`onReplayTour` de `MainFlow`. Ampliar `SettingsScreen.test.tsx`: ambas filas presentes, la tarjeta descartada no oculta `Completar configuración`, `Ver tutorial` dispara el replay. El paso 4 del tour sin tarjeta apunta a la entrada de nav `settings` (T075a); no requiere atributos en la fila de Ajustes. Depende de T078

**Checkpoint**: checklist y tour funcionando; usuarios existentes migran sin fricción.

---

## Phase 8: User Story 6 — Un lenguaje visual cálido y propio (Priority: P3)

**Goal**: Tokens crema/ciruela/verde pastel, Fredoka + Figtree locales, radios 28 px, píldoras, tema por defecto del sistema con selector, sin tipografía monoespaciada ni etiquetas `uppercase`, y guardias automáticas.

**Independent Test** (`spec.md` US6): con el SO en claro y en oscuro sin haber elegido tema, cada modo muestra su paleta; cambiar el tema en Ajustes se respeta tras recargar; ninguna pantalla conserva etiquetas en mayúsculas monoespaciadas.

> Orden: fuentes → tokens → tema → primitivas → barrido → corrección de copy → **activar guardias al final** (activadas antes fallan hasta terminar el barrido). Todo texto nuevo de las historias anteriores ya debe estar en tuteo y sin estilos "terminal".

- [X] T080 [US6] Obtener Fredoka y Figtree (licencia OFL) como archivos variables latinos y agregarlos a `src/app/fonts/Fredoka-Variable.woff2` y `src/app/fonts/Figtree-Variable.woff2` junto a sus licencias (`src/app/fonts/OFL-Fredoka.txt`, `src/app/fonts/OFL-Figtree.txt`); descargar desde el repositorio oficial `google/fonts` en GitHub (rutas `ofl/fredoka` y `ofl/figtree`) y, si no hay red, detenerse y pedir los archivos al usuario. **Sin dependencia npm nueva**
- [X] T081 [US6] En `src/app/layout.tsx` cargar ambas fuentes con `next/font/local` (`display: 'swap'`, variables `--font-fredoka` y `--font-figtree`, mismo patrón que `GeistVF.woff`), **retirar** `JetBrains_Mono` de `next/font/google`, aplicar las variables al `<body>`, y pasar `ThemeProvider` a `defaultTheme="system"` con `enableSystem`. Depende de T080
- [X] T082 [US6] Actualizar `src/app/globals.css` y `tailwind.config.ts` con los tokens de `data-model.md` ("Tokens visuales"): `--background` crema `#FBF5EA` / ciruela oscuro `#241A2B`; `--foreground` ciruela `#3A2745` / crema `#F6EEE3`; `--card` `#FFFFFF` / `#2F2338`; `--primary` verde pastel `#8ED1A4` con texto `#2A1B33` (claro) y `#9ADBB0` con texto `#241A2B` (oscuro); píldoras Necesidades `#DDEBFA`/`#1F3B57`, Deseos `#F8E0EC`/`#5A2142`, Ahorro `#DCF2E3`/`#1E4A32` (con par propio en oscuro); radio de tarjetas 28 px, controles `rounded-full`, sombras cálidas `0 6px 24px -8px` con tinte ciruela, sin líneas divisorias duras; familias `font-fredoka` (cifras y títulos) y `font-figtree` (texto) como `sans` por defecto. Valores definitivos se ajustan contra T092 (contraste AA). Verde pastel como acento propio de ez-life (sin copiar el coral ni la identidad de huecazo.com). Depende de T081
- [X] T083 [US6] En `src/components/theme-provider.tsx` eliminar `SystemThemeReset` (hoy reescribe "system" como "dark") y ajustar `src/components/theme-provider.test.tsx`: sin elección previa se sigue al sistema y la clave `theme` **no** se escribe en `localStorage` hasta que se llame a `setTheme`; quien ya tenía `theme` guardado lo conserva. Depende de T081
- [X] T084 [US6] Crear `src/presentation/hooks/useThemePreference.ts` (envuelve `useTheme` sin desajuste de hidratación) y convertir `src/presentation/components/ThemeToggle.tsx` en selector de tres opciones `Claro` / `Oscuro` / `Sistema` mostrado en Ajustes → Apariencia (`SettingsScreen.tsx`); cambia al instante y persiste tras recargar. Test en `SettingsScreen.test.tsx` (o `ThemeToggle.test.tsx` nuevo): las tres opciones, selección activa, llama a `setTheme`. Depende de T083
- [X] T085 [P] [US6] Actualizar las primitivas `src/components/ui/button.tsx` (forma píldora `rounded-full`, objetivo táctil ≥ 44 px), `card.tsx`, `panel.tsx`, `badge.tsx` (píldoras Necesidades/Deseos/Ahorro con pares fondo pálido / texto oscuro), `input.tsx`, `select.tsx`, `segmented.tsx`, `progress.tsx`, `sheet.tsx`, `dialog.tsx` y `menu.tsx` a los nuevos tokens: radios, sombras cálidas, sin bordes duros, foco visible en ambos temas (FR-041, FR-044); microanimaciones cortas con `framer-motion`/CSS que respeten `prefers-reduced-motion`. Actualizar los tests de `src/components/ui/*.test.tsx` que fijen clases antiguas. Depende de T082
- [X] T086 [US6] Barrido 1/3: eliminar `font-mono`, `label-mono`, `JetBrains` y etiquetas con `uppercase` como estilo en `src/app/` y `src/components/` (ejecutar `grep -rln "font-mono\|label-mono\|JetBrains\|uppercase" src/app src/components` para la lista exacta); cifras y títulos pasan a `font-fredoka`, texto a `font-figtree`; revisar el diff archivo por archivo; actualizar los tests que aserten texto en mayúsculas junto a su componente. Depende de T085
- [X] T087 [US6] Barrido 2/3: lo mismo en los componentes **de nivel superior** de `src/presentation/components/*.tsx` (excluye las subcarpetas; lista con `grep -ln "font-mono\|label-mono\|JetBrains\|uppercase" src/presentation/components/*.tsx`), incluyendo `Layout.tsx`, `AppTopbar.tsx`, `BottomNav.tsx`, `MobileHeader.tsx`, `SettingsScreen.tsx`, `OnboardingWizard.tsx` y los pasos; los textos nuevos de las specs deben quedar sin estilos "terminal". Actualizar tests afectados. Depende de T086
- [X] T088 [US6] Barrido 3/3: lo mismo en `src/presentation/components/summary/`, `control/`, `finances/` y cualquier otra subcarpeta de `src/presentation/` (lista con `grep -rln "font-mono\|label-mono\|JetBrains\|uppercase" src/presentation`), más `src/infrastructure` y `src/core` si aparecen cadenas de estilo. Las demás pantallas **solo heredan tokens**: no reestructurarlas (FR-043, spec 014). Actualizar tests afectados. Depende de T087
- [X] T089 [US6] Corregir el copy de Ajustes en `src/presentation/components/SettingsScreen.tsx`: `Recibí alertas cuando superes…` → `Recibe alertas cuando superes el 80% de un presupuesto, cumplas una meta de ahorro, o un recordatorio diario para registrar tus movimientos.` (FR-045); actualizar la aserción correspondiente en `SettingsScreen.test.tsx`. Depende de T084
- [X] T090 [P] [US6] Crear `src/typographyGuard.test.ts` (mismo patrón que `src/voseoGuard.test.ts`): recorre `src/` excluyendo archivos de test y la propia guardia, y falla si encuentra `font-mono`, `label-mono`, `JetBrains` o una etiqueta estilizada con `uppercase`; el mensaje de fallo lista archivo y línea. **Activar solo cuando T086–T088 terminen** (SC-006). Depende de T088
- [X] T091 [US6] Confirmar que `src/voseoGuard.test.ts` sigue verde tras todo el texto nuevo (Resumen, onboarding, checklist, tour, errores de dominio, notificación `register_due`); corregir cualquier voseo introducido. Depende de T089
- [X] T092 [P] [US6] Crear `src/tokens.contrast.test.ts`: lee los pares de color de `src/app/globals.css` (claro y oscuro) y verifica contraste AA — texto normal ≥ 4.5:1, texto grande ≥ 3:1 — para `foreground/background`, `card-foreground/card`, `primary-foreground/primary`, `muted-foreground/background` y los tres pares de píldoras en ambos temas (SC-007); ajustar los valores de T082 hasta que pase. Depende de T082
- [X] T093 [US6] Verificación visual del Independent Test de US6 con el navegador (skill `run` / chrome-devtools): SO en claro y oscuro sin tema elegido → cada paleta; Ajustes → Apariencia persiste tras recargar; Resumen, onboarding, checklist y tour con calidad equivalente en ambos temas; fuentes Fredoka/Figtree servidas desde el mismo origen (pestaña Network); foco visible, controles ≥ 44 px y `prefers-reduced-motion` respetado. Comprobar también: en un viewport de 390 px, sin scroll, se ven el Balance, "Entró · Salió" y el primer ítem de "Por registrar" (SC-003), y que el botón "+" central es la única acción primaria destacada en el Resumen (FR-038), y que cada paso del tour resalta un elemento visible tanto en 390 px como en escritorio. Anotar resultado y capturas relevantes en `specs/013-balance-mes-resumen-minimalista/verification.md`. Depende de T088, T090, T092

**Checkpoint**: la app tiene su nuevo lenguaje visual con guardias automáticas en verde.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verificación de punta a punta, documentación y despliegue seguro.

- [X] T094 [P] Actualizar `CLAUDE.md` (raíz de `ez-life`): quitar `useRecurrenceEvaluator` de la lista de hooks de fondo en "Architecture" (ahora solo `useSyncManager`, `useNotificationEvaluator`; `adoptLegacySources` corre una vez en `MainFlow`), mencionar `useSummaryData` y la carpeta `presentation/components/summary/`, el onboarding de 6 pasos y que `Dashboard` ya no usa `useDashboardData`; mantenerlo consistente con la constitución
- [X] T095 Ejecutar `pnpm test` completo (incluye `voseoGuard`, `typographyGuard`, `tokens.contrast` y el invariante por propiedad); corregir cualquier fallo y anotar el resultado en `specs/013-balance-mes-resumen-minimalista/verification.md`
- [X] T096 [P] Ejecutar `pnpm lint` y `pnpm build`; corregir errores y advertencias nuevas respecto a la línea base de T001 y anotar el resultado en `verification.md`
- [X] T097 Recorrer `quickstart.md` §2 a §7 en el navegador (usuario nuevo, tabla de reglas del Balance paso por paso con la comprobación 1,600 + 500 − 1,200 − 200 + 300 = 1,000, "Por registrar" y notificación única, usuario existente con `onboarding_step = 3` y tarjeta sin línea, modo **Offline** de DevTools, visual) y registrar cada sección como "sin diferencias" o con el hallazgo en `verification.md`; cronometrar además el onboarding completo (banco + tarjeta + préstamo < 5 min; omitiendo los opcionales < 2 min, SC-002) y anotar los tiempos. Depende de T093, T095, T096
- [X] T098 Revisión de seguridad/offline: confirmar que ninguna ruta nueva crea movimientos sin acción explícita (FR-014), que `reminder_skips` usa política por propietario sin auto-inserción (`supabase/migrations/20261110120000_balance_onboarding_reminders.sql`), que no se tocó `app_metadata`, y que onboarding, "Por registrar", checklist y tour funcionan sin red y sincronizan al reconectar (SC-008). Registrar en `verification.md`
- [ ] T099 **BLOQUEADA — requiere confirmación explícita del dueño; el agente de implementación NO debe ejecutarla por su cuenta.** Antes de publicar el cliente: (1) pedir confirmación al dueño del proyecto; (2) correr `D:\Programming\Frontend\mvp-lab-infra\audit\fleet-auth-audit.sql` y comprobar que no hay hallazgos nuevos; (3) `supabase db push --dry-run` y verificar que lista **solo** `20261110120000_balance_onboarding_reminders.sql` (si reporta versiones ajenas, agregar stubs de línea base según `mvp-lab-infra/OPERATIONS.md` §4; **nunca** `migration repair --reverted`, nunca `db pull`); (4) tras la confirmación, `supabase db push`; (5) verificar que `authenticated` solo tiene `select, insert, update` sobre `ez_life.reminder_skips` y que un `sync_record` de prueba con cada campo nuevo no falla. Nunca por MCP ni `execute_sql`. Sin esto el push de campos nuevos y de pasos 4–6 falla y queda en cola (R14)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea todas las historias**.
- **User Stories (Phase 3–8)**: todas dependen de Foundational.
- **Polish (Phase 9)**: depende de las historias deseadas; T099 además depende de la confirmación del dueño y debe ocurrir **antes de publicar** el cliente.

### User Story Dependencies

- **US1 (P1)**: solo Foundational. Es el MVP.
- **US2 (P1)**: Foundational; usa `calculateMonthBalance` (US1) únicamente en su test de integración final (T050). El resto es independiente de US1.
- **US3 (P2)**: Foundational + US1 (`useSummaryData`, `BalanceHero` como punto de montaje) y T049 (cuenta de origen de cuotas, de US2) para el prefill de cuota.
- **US4 (P2)**: US1 y US3 (reescribe `Dashboard.tsx` conservando `PendingRegistrations`); su valor visible requiere las cifras de US1.
- **US5 (P3)**: US2 (wizard 1..6 para `onCompleteSetup`) y US4 (`Dashboard.tsx`, `useSummaryData`).
- **US6 (P3)**: independiente a nivel de comportamiento; se hace **después** de la estructura (US1–US5) porque cambia estilos globales y su barrido toca archivos que las demás historias crean. Las guardias (T090, T092) se activan al final.

### Within Each User Story

- El test de un caso de uso se escribe **antes** y debe fallar (T024→T025, T051→T052, T062→T063, T072→T073).
- Tipos y repositorios → hooks → componentes → montaje en `Dashboard`/`MainFlow` → test de integración del criterio independiente.
- `useSummaryData.ts` y `Dashboard.tsx` los edita una historia tras otra (US1 → US3 → US4 → US5): **no** paralelizar esas tareas entre historias.

### Parallel Opportunities

- Foundational: T006, T007 en paralelo tras T005; T009–T014 en paralelo entre sí (archivos distintos); T016–T018 en paralelo tras T003.
- US1: T027 (`BalanceHero`) en paralelo con T024/T025/T026.
- US2: T031–T033 en paralelo; T043–T046 en paralelo una vez hecho T042; T041 en paralelo con los componentes.
- US3: T053 y T056 en paralelo; T059 y T060 en paralelo.
- US4: T065–T068 en paralelo.
- US5: T074, T075, T075a y T077 en paralelo.
- US6: T085 en paralelo con T083/T084; T090 y T092 en paralelo.
- Polish: T094 y T096 en paralelo.

---

## Parallel Example: User Story 2

```bash
# Casos de uso puros del onboarding (archivos distintos):
Task: "T031 Crear src/core/use-cases/resolveOnboardingProgress.ts + test"
Task: "T032 Crear src/core/use-cases/validateOnboardingCard.ts + test"
Task: "T033 Crear src/core/use-cases/validateOnboardingLoan.ts + test"

# Pasos del wizard, una vez renombrados Step2→Step5 y Step3→Step6 (T042):
Task: "T043 Reescribir src/presentation/components/OnboardingStep1.tsx (Ingresos)"
Task: "T044 Crear src/presentation/components/OnboardingStep2.tsx (Dinero)"
Task: "T045 Crear src/presentation/components/OnboardingStep3.tsx (Tarjetas)"
Task: "T046 Crear src/presentation/components/OnboardingStep4.tsx (Préstamos)"
```

---

## Implementation Strategy

### MVP First (solo User Story 1)

1. Phase 1 (Setup) → Phase 2 (Foundational, incluido el retiro de la generación automática).
2. Phase 3 (US1): `calculateMonthBalance` + `BalanceHero` en el Resumen.
3. **PARAR y VALIDAR**: Independent Test de US1 (T030) y el invariante por propiedad.
4. Demo local; no publicar sin T099.

### Entrega incremental

1. Setup + Foundational → base lista.
2. US1 → Balance correcto (MVP).
3. US2 → onboarding con la foto completa (alimenta Cuentas y Deudas).
4. US3 → "nada se registra solo" + recordatorios.
5. US4 → Resumen minimalista completo (seis secciones).
6. US5 → checklist y tour (cierra el ciclo para usuarios existentes).
7. US6 → lenguaje visual + guardias.
8. Polish → verificación, `CLAUDE.md` y despliegue seguro de la migración (T099).

### Estrategia de pistas paralelas (si hay más de una persona)

Tras Foundational: **pista de datos/lógica** (US1 → US3 → US4 → US5) y **pista de onboarding** (US2) pueden avanzar en paralelo, con puntos de unión en T049→T059 y T047→T078. La **pista visual** (US6) sólo puede empezar los pasos de fuentes y tokens (T080–T085) en paralelo; el barrido (T086–T088) y las guardias esperan a que el resto de las historias termine.

---

## Notes

- `[P]` = archivos distintos y sin dependencias incompletas. Las tareas que editan el mismo archivo (`useSummaryData.ts`, `Dashboard.tsx`, `MainFlow.tsx`, `LocalOnboardingRepository.ts`, `SettingsScreen.tsx`) son secuenciales.
- Confirmar los tests en rojo antes de implementar cada caso de uso; hacer commit tras cada tarea o grupo lógico (mensajes en inglés).
- **Decisiones de producto confirmadas** (spec, *Clarifications* 2026-11-11; cada una aislada en una función y un test): (a) el tramo de deuda previa pagado cuenta en "Salió" y no en el 50/30/20 (`research.md` R5); (b) un gasto de la categoría Ahorro cuenta como "Ahorraste", no como "Salió" (R5); (c) cuotas y tarjetas aparecen y notifican 3 días antes de su día de pago (R7); (d) la cuenta principal no tiene campo (T012); (e) el saldo inicial de una cuenta creada tras el primer mes entra como ajuste de su mes (R2, T025).
- Riesgo aceptado (R4): dos dispositivos pueden fijar `balance_since` distinto; gana el último (LWW).
- Evitar: tareas vagas, conflictos de archivo entre historias, y cualquier lógica de negocio dentro de componentes.
