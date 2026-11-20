# Implementation Plan: Balance del mes, cuentas y deudas, tutorial y Resumen minimalista

**Branch**: `013-balance-mes-resumen-minimalista` (la rama no se creó: no hay hook `before_specify` registrado;
el trabajo parte de `main`) | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-balance-mes-resumen-minimalista/spec.md`

## Summary

Seis cambios sobre el Resumen, el onboarding y el modelo de cuentas, con una migración aditiva en el esquema
`ez_life` y **ninguna dependencia nueva**:

1. **Balance del mes** (US1): función pura `calculateMonthBalance` con *forma cerrada*
   (`efectivo gastable − deuda corriente de tarjetas`) más flujos clasificados (Entró, Salió, Ahorraste,
   Sacaste, Ajuste); un test de invariante obliga a que ambos caminos coincidan.
2. **Onboarding de 6 pasos** (US2): Ingresos → Dinero (Efectivo + bancos) → Tarjetas → Préstamos →
   Distribución → Categorías, con pasos atómicos e idempotentes y compatibilidad con la numeración anterior.
3. **"Nada se registra solo"** (US3): se retira la generación automática de recurrencias; la lista
   **Por registrar** se *deriva* (función pura) y solo las omisiones se guardan (`reminder_skips`); los
   avisos usan el sistema `Notification` existente (`register_due`).
4. **Resumen minimalista** (US4): nuevo `useSummaryData` + componentes de seis secciones que reemplazan a
   `Dashboard`/`useDashboardData`.
5. **Checklist y tour** (US5): `buildSetupChecklist` puro, `GuidedTour` escrito a mano, estado en el perfil.
6. **Lenguaje visual** (US6): tokens crema/ciruela/verde pastel, Fredoka + Figtree locales, tema por defecto
   del sistema con selector, y una guardia tipográfica automática.

Datos nuevos (todos opcionales): `payment_accounts.{credit_limit, closing_day, payment_day, opening_date}`,
`income_sources.{pay_day, received_month}`, `installment_loans.payment_day`,
`profiles.{onboarding_version, balance_since, checklist_dismissed, checklist_not_applicable, tour_seen}`, tabla
`reminder_skips` y el tipo de notificación `register_due`. La migración se **escribe** pero **no se aplica** sin
confirmación del dueño (reglas de la flota).

## Technical Context

**Language/Version**: TypeScript (strict), React 18, Next.js 14.2 App Router

**Primary Dependencies**: Dexie 4 (IndexedDB), Supabase JS, shadcn/ui, `next-themes` 0.4, `framer-motion`,
`uuidv7`. **Ninguna dependencia nueva**: tour, cálculo de balance y recordatorios a mano; las fuentes (Fredoka,
Figtree) se agregan como archivos locales con `next/font/local`.

**Storage**: IndexedDB local (`EzLifeDB`) como fuente de verdad + sync custom a Supabase (LWW por
`updated_at`). **Dexie v19** (tabla `reminder_skips`; los campos opcionales nuevos no necesitan índice).
**Migración Supabase** aditiva en `ez_life` (ver [contracts/supabase-migration.md](./contracts/supabase-migration.md)).

**Testing**: Vitest + jsdom + `fake-indexeddb/auto` + Testing Library (`pnpm test`); guardias de texto
(`voseoGuard`, nueva `typographyGuard`).

**Target Platform**: PWA móvil-first en navegador (Vercel); escritorio con barra lateral.

**Project Type**: web-app (Next.js, capas `core` / `infrastructure` / `presentation`).

**Performance Goals**: el Balance recorre el historial completo en memoria (O(n log n), n = movimientos del
usuario, del orden de miles); sin requisitos nuevos de latencia. El Resumen debe abrir sin saltos con
`useLocalQuery` (mismo patrón que hoy).

**Constraints**: offline-first (Principios V y XII); dinero en céntimos enteros (VIII); lógica fuera de
componentes (III); copy hardcodeado en español neutro con tuteo (VI); recordatorios solo por `Notification`
(XI); membresía no implícita (IX: `reminder_skips` es por propietario, sin auto-inserción); cambios de esquema
remoto solo por migración + `supabase db push` con confirmación.

**Scale/Scope**: ~16 casos de uso nuevos/modificados (cada uno con test), 3–4 repositorios, 1 migración,
~10 componentes nuevos (Resumen, 4 pasos de onboarding, tour, checklist), reescritura de `Dashboard`,
barrido de estilos en ~53 archivos con `font-mono`/`uppercase`, ajuste de ~12 tests existentes.

## Constitution Check

*GATE: Debe pasar antes de Phase 0. Re-evaluado tras Phase 1.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Stack y Dependencias | ✅ | Sin dependencias runtime nuevas. Fuentes locales con `next/font/local`; tour y cálculos a mano. |
| II. Spec Antes de Código | ✅ | Spec 013 (con 5 clarificaciones) existe antes de tocar código. |
| III. Lógica ≠ UI | ✅ | Balance, "Por registrar", checklist, progreso de onboarding, validadores y `buildCompactRule` viven en `core/use-cases` puros. Los componentes solo renderizan y delegan (incl. `useGuidedTour`, que solo transiciona pasos). |
| IV. Tests | ✅ | Cada caso de uso nuevo/modificado tiene `.test.ts`; cambios de wiring (formularios, omitir/registrar, tour, ajustes) con Testing Library; los cambios de solo estilo/tokens no exigen test, pero se añade una guardia y un test de contraste por la métrica SC-006/SC-007. Sin e2e. |
| V. Offline-First | ✅ | Todo opera sobre IndexedDB y la cola de sync existente. Único punto con red: la migración debe estar viva antes de que se sincronicen los campos nuevos (R14). |
| VI. Idioma | ✅ | Código en inglés; copy en español neutro con tuteo; se corrige "Recibí alertas…". `voseoGuard` sigue verde. |
| VII. Simplicidad | ✅ | Tour ≈ 100 líneas, sin librería. Sin librería de fechas, de estado ni de tours. Una sola función de clasificación en vez de reglas dispersas. |
| VIII. Dinero en enteros | ✅ | Todo en céntimos; nuevos campos (`credit_limit`) enteros; `parseMoney` en formularios. |
| IX. Membership explícita | ✅ | No se tocan espacios compartidos. `reminder_skips`: política por propietario, sin auto-inserción ni trigger sobre `auth.users`. |
| X. Liquidaciones vs pagos de préstamo | ✅ | La cuota sigue siendo egreso real (se le suma cuenta de origen, R13); el saldado informal no genera movimiento (el onboarding crea `Debt` sin movimientos). |
| XI. Un solo sistema de recordatorios | ✅ | `register_due` extiende `evaluateNotifications` y `useNotificationEvaluator`; no hay un segundo mecanismo. "Por registrar" es una vista derivada, no un recordatorio paralelo. |
| XII. Offline-first no negociable | ✅ | Onboarding, Resumen, "Por registrar", checklist y tour funcionan sin red (SC-008, quickstart §6). |
| XIII. Conceptos distintos | ✅ | `Habit`/`Goal`/`Task`/`SavingsGoal` no se tocan; la meta de ahorro principal reutiliza `pickPrimarySavingsGoal`. |

**Reglas de la flota (`D:\Programming\Frontend\CLAUDE.md`)**: ✅ sin proyecto Supabase nuevo; ✅ cambio de esquema
**solo** por migración + `supabase db push` (no MCP, no `execute_sql`); ✅ sin `db pull`; ✅ nombre
con timestamp y RLS en la tabla nueva; ✅ membresía no implícita; ✅ `app_metadata` no se toca. La app sigue en
`mvp-lab` (demo/localhost): la graduación no cambia.

**Decisiones de producto confirmadas** (spec, *Clarifications* 2026-11-11; cada una aislada en una función y un
test): (a) el tramo de deuda previa pagado cuenta en "Salió" y no en el 50/30/20 (R5, FR-005/006); (b) un gasto
de la categoría Ahorro cuenta como "Ahorraste", no como "Salió" (R5, FR-001/008); (c) cuotas de préstamo y
tarjetas aparecen y notifican 3 días antes de su día de pago (R7, FR-015/017); (d) la cuenta principal no tiene
campo: es el valor por defecto del selector de cuenta de origen (la de débito activa más antigua); (e) el saldo
inicial de una cuenta de débito/efectivo creada después del primer mes entra como "Ajuste de saldo" de su mes
(R2).

**Re-evaluación post-diseño**: sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-balance-mes-resumen-minimalista/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones R1–R14 y alternativas
├── data-model.md        # Phase 1: entidades, campos nuevos, derivadas, tokens
├── quickstart.md        # Phase 1: guía de validación (automática + manual)
├── contracts/
│   ├── balance-rules.md      # Tabla de clasificación, forma cerrada, invariante, 24 casos
│   ├── repositories.md       # Firmas de casos de uso, repositorios, hooks y props
│   ├── supabase-migration.md # Migración aditiva (NO se aplica sin confirmación)
│   └── ui-copy.md            # Resumen, onboarding, tour, ajustes, guardia tipográfica
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261110120000_balance_onboarding_reminders.sql   # NUEVO (escrito, no aplicado)

src/
├── core/
│   ├── domain/
│   │   ├── models/types.ts                      # campos nuevos en PaymentAccount/IncomeSource/InstallmentLoan/Profile; ReminderSkip; NotificationType 'register_due'
│   │   └── repositories/IRepositories.ts        # contratos de los repositorios nuevos
│   └── use-cases/                                # NUEVOS (cada uno + .test.ts)
│       ├── calculateMonthBalance.ts             # forma cerrada + flujos + invariante
│       ├── buildCompactRule.ts                  # 50/30/20 del Resumen con frases y ahorro neto
│       ├── buildPendingRegistrations.ts         # "Por registrar" derivado
│       ├── registrationItemKey.ts · clampDayToMonth.ts · parseDayOfMonth.ts
│       ├── buildSetupChecklist.ts · resolveOnboardingProgress.ts
│       ├── pickPrimaryAccount.ts · selectCardOwed.ts
│       ├── validateOnboardingCard.ts · validateOnboardingLoan.ts
│       └── (modificados) calculateAccountBalances · validatePaymentAccount · evaluateNotifications
│           · evaluateMonthlyRecurrences (ELIMINADO con su test)
├── infrastructure/
│   ├── db/db.ts                                 # version(19), reminder_skips en SYNCED_TABLES
│   ├── sync/{CustomSyncLayer,recordAdapter}.ts  # tabla y dateFields
│   ├── auth/observeAccountSession.ts            # progreso 0..6 vía resolveOnboardingProgress
│   └── repositories/local/
│       ├── LocalOnboardingRepository.ts (+test) # saveIncome/Accounts/Cards/Loans, declareNotApplicable, skipStep
│       ├── LocalRegistrationRepository.ts (+test)  # NUEVO: getInputs, skip, unskip
│       ├── LocalInstallmentLoanRepository.ts (+test)  # alreadyPaid, accountId
│       ├── LocalMovementRecurrenceRepository.ts (+test) # adoptLegacySources (sin generar)
│       └── LocalPaymentAccount/IncomeSource/Profile…   # campos nuevos
├── presentation/
│   ├── hooks/
│   │   ├── useSummaryData.ts (+test)            # reemplaza useDashboardData
│   │   ├── useGuidedTour.ts (+test) · useThemePreference.ts
│   │   ├── useNotificationEvaluator.ts          # pasa pendingRegistrations
│   │   └── useRecurrenceEvaluator.ts            # ELIMINADO
│   └── components/
│       ├── Dashboard.tsx                        # reescrito (seis secciones)
│       ├── summary/                             # NUEVO: BalanceHero, PendingRegistrations, AccountsAndDebts,
│       │                                        #   CompactRule, PrimaryGoal, SetupChecklistCard, GuidedTour (+tests)
│       ├── dashboard/*                          # se eliminan los componentes que queden sin uso (grep antes)
│       ├── OnboardingWizard.tsx                 # 6 pasos
│       ├── OnboardingStep1.tsx … OnboardingStep4.tsx (+tests)  # 1 Ingresos, 2 Dinero, 3 Tarjetas, 4 Préstamos
│       ├── OnboardingStep5.tsx · OnboardingStep6.tsx            # renombres de los pasos 2 y 3 actuales
│       ├── QuickRecordSheet / MovementForm / TransferForm       # prefill + vínculos
│       ├── InstallmentLoanList/Form                              # cuenta de origen
│       ├── PaymentAccountForm / PaymentAccountSettings           # línea de crédito, días
│       ├── SettingsScreen / ThemeToggle                          # Completar configuración, Ver tutorial, tema 3 opciones
│       ├── BottomNav.tsx                                         # data-tour="add" y "settings" (anclas del tour)
│       └── MainFlow.tsx                                          # sin useRecurrenceEvaluator; tour; rutas del wizard 5/6
├── app/
│   ├── fonts/{Fredoka,Figtree}-Variable.woff2   # NUEVO (OFL, locales)
│   ├── layout.tsx                               # next/font/local; defaultTheme="system"
│   └── globals.css                              # tokens crema/ciruela/verde pastel, radios 28 px
├── components/{ui/*,theme-provider.tsx}         # píldoras, sombras cálidas; sin SystemThemeReset
├── tailwind.config.ts                           # familias de fuente y radios
├── voseoGuard.test.ts                           # existente: debe seguir verde
└── typographyGuard.test.ts · tokens.contrast.test.ts   # NUEVOS
```

**Structure Decision**: se respeta la arquitectura en capas existente y no se crean capas nuevas. La lógica va en
`core/use-cases` (pura, test colocado); lo que toca Dexie en `infrastructure/repositories/local`; hooks y
componentes en `presentation`. Una carpeta nueva, `presentation/components/summary/`, agrupa las piezas del
Resumen para no mezclarlas con las del `dashboard/` que se retira.

## Orden de implementación sugerido (insumo para /speckit-tasks)

Dos pistas **independientes** hasta el cableado final; la pista visual puede ir en paralelo a la de datos.

1. **Fundaciones puras** (sin UI; todas paralelizables): `calculateMonthBalance` (con los 24 casos y la
   propiedad del invariante), `buildPendingRegistrations` (+`registrationItemKey`, `clampDayToMonth`),
   `buildSetupChecklist`, `resolveOnboardingProgress`, `pickPrimaryAccount`, `buildCompactRule`, validadores,
   cambios en `calculateAccountBalances`/`validatePaymentAccount`/`evaluateNotifications`.
2. **Modelo y datos**: tipos nuevos → Dexie v19 + sync (`SYNCED_TABLES`, `tables`, `dateFields`) → repositorios
   (`LocalOnboardingRepository`, `LocalRegistrationRepository`, préstamos con `alreadyPaid`/`accountId`,
   `adoptLegacySources`) → **migración SQL escrita** (se revisa, no se aplica).
3. **Retirar la generación automática**: quitar `useRecurrenceEvaluator` y `evaluateMonthlyRecurrences`,
   eliminar sus tests y crear el del repositorio (R6). Hacerlo **antes** del Resumen nuevo para que ningún movimiento aparezca solo
   durante el desarrollo.
4. **US1 + US4 (Resumen)**: `useSummaryData`, componentes de `summary/`, `Dashboard` reescrito; retirar
   `dashboard/*` sin uso.
5. **US2 (Onboarding)**: pasos 1–4 nuevos, wizard de 6 pasos, renombrar pasos 2/3 → 5/6, `MainFlow` y
   `observeAccountSession`. Cuenta de origen de cuotas/abonos (FR-020).
6. **US3 (Por registrar)**: `QuickRecordSheet.prefill` + vínculos en formularios, `register`/`skip`, notificación
   `register_due` en `useNotificationEvaluator`.
7. **US5 (Checklist y tour)**: tarjeta, `GuidedTour`, entradas en Ajustes, `ensureBalanceSince` al entrar.
8. **US6 (Visual)**: fuentes locales → tokens → tema/selector → barrido de `font-mono`/`uppercase` → activar
   `typographyGuard` y `tokens.contrast` al final (activadas antes fallan hasta terminar). Todo texto nuevo se
   escribe ya en tuteo y sin estilos "terminal".
9. **Verificación**: `pnpm test`, `pnpm lint`, `pnpm build`, recorrido de `quickstart.md`, `verification.md`.
   **Antes de publicar el cliente**: pedir confirmación al dueño y aplicar la migración con `supabase db push`
   (auditoría de flota primero).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| **Migración tras el cliente**: `sync_record` rechaza campos desconocidos y `profiles.onboarding_step` tiene `CHECK between 0 and 3`; un cliente nuevo empujaría pasos 4–6 y campos nuevos y todo fallaría (el push se reintenta sin confirmar) | La migración reemplaza el `CHECK` y se aplica **antes** de publicar (R14). El quickstart exige confirmarlo. Los datos quedan en cola local, no se pierden. |
| Reescritura del Resumen rompe tests de `Dashboard`/`dashboardParts` | `dashboard/*` se elimina solo tras `grep` de usos; sus tests se reemplazan por los de `summary/` y `useSummaryData`. |
| El Balance por forma cerrada y por flujos divergen en un caso borde | Invariante probado con casos de tabla **y** por propiedad (secuencias generadas). Un fallo señala la fila mal clasificada. |
| `balance_since` distinto entre dos dispositivos de un usuario existente | Riesgo aceptado, documentado (R4): solo cambia qué compras antiguas son deuda previa. |
| Quitar la generación automática deja a usuarios con recurrencias sin registrar sus gastos | Es el comportamiento pedido (FR-014). "Por registrar" + notificación lo compensan; quickstart §4 lo valida. |
| Compatibilidad del onboarding v1→v2: un usuario con `onboarding_step = 2` retomaría en un paso incorrecto | Tabla fija en `resolveOnboardingProgress` con test por fila (R10). |
| El barrido de `font-mono`/`uppercase` (~53 archivos) cambia aspecto y puede romper aserciones de texto en mayúsculas | Barrido por lotes con revisión del diff; la guardia se activa al final; tests que aserten texto en mayúsculas se actualizan junto con su componente. |
| `next-themes` persistió "dark" por defecto en usuarios actuales | Quien tenga `theme` guardado lo conserva (decisión de la spec). El quickstart verifica que una sesión limpia no escribe la clave. |
| Fuentes locales: licencias y tamaño | Fredoka y Figtree son OFL; solo los ejes variables latinos, `display: swap`. Se agregan sus licencias junto a los archivos. |
| Agregar una cuenta con saldo después del primer mes cambiaría el Balance de meses pasados o rompería el invariante | Regla de R2: el saldo inicial entra como ajuste en su mes de apertura; casos 21 y 22 de `balance-rules.md` y un caso por propiedad lo cubren. |
| Doble registro de un aporte (gasto Ahorro + transferencia a ahorros) | No hay vínculo entre ambos; documentado como responsabilidad del usuario (R5). |
| `INGRESO`/`TRANSFERENCIA` sobre tarjeta (casos límite) | Cubiertos por filas 3, 16–18 de `balance-rules.md` con tests; fuera de alcance mejorar su UX. |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
