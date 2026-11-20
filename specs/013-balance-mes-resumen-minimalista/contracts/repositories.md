# Contrato: casos de uso, repositorios y hooks que cambian

Firmas objetivo. Capas respetadas: `core/use-cases` puro y sin imports de UI (Principio III); solo
`infrastructure/repositories/local` toca `db`; `presentation` solo renderiza y delega.

## `core/use-cases` — NUEVOS (cada uno con `.test.ts` colocado, Principio IV)

| Archivo | Firma | Resumen |
|---|---|---|
| `calculateMonthBalance.ts` | `(input) => MonthBalance` | Ver [balance-rules.md](./balance-rules.md). |
| `buildCompactRule.ts` | `(movements, buckets, expectedIncome, savingsNet) => CompactRule` | 50/30/20 del Resumen con frases y ahorro neto. |
| `buildPendingRegistrations.ts` | `(input: { today: Date; rules: MovementRecurrence[]; incomeSources: IncomeSource[]; loans: InstallmentLoan[]; loanIdByPaymentId: Record<string,string>; accounts: PaymentAccount[]; cardOwed: Record<string,number>; monthMovements: Movement[]; skips: ReminderSkip[] }) => PendingRegistration[]` | Lista ordenada por día; excluye omitidos, cubiertos, saldados y sin día; solo mes en curso. Constante `REGISTRATION_LEAD_DAYS = { income: 0, recurrence: 0, installment: 3, card: 3 }`. |
| `registrationItemKey.ts` | `(kind, refId, month) => string` y `parseItemKey` | Clave única de ítem/omisión/notificación. |
| `clampDayToMonth.ts` | `(year, monthIndex, day) => number` | Día 29/30/31 en meses cortos → último día. |
| `buildSetupChecklist.ts` | `(input: { incomeSources; accounts; loans; debts; profile }) => SetupChecklist` | N de 4 + siguiente pendiente. |
| `resolveOnboardingProgress.ts` | `(profile) => { step: 0..6; completed: boolean }` | Tabla de compatibilidad R10. |
| `pickPrimaryAccount.ts` | `(accounts, userId) => PaymentAccount \| undefined` | Primera `debit` activa; si no hay, "Efectivo". |
| `selectCardOwed.ts` | `(balance: MonthBalance) => Record<string, number>` | Mapa `accountId → owed` para `buildPendingRegistrations`; lo usan `useSummaryData` y `useNotificationEvaluator`. |
| `validateOnboardingCard.ts` | `(draft) => void` | Línea > 0, consumo ≤ línea, días 1–31. Lanza `DomainError` en tuteo. |
| `validateOnboardingLoan.ts` | `(draft) => void` | Cuotas: monto, cuota, total ≥ 1, pagadas ∈ [0, total], día 1–31; informal: saldo > 0. |
| `parseDayOfMonth.ts` | `(text) => number \| undefined` | Vacío → `undefined`; fuera de 1–31 → `DomainError`. |

## `core/use-cases` — MODIFICADOS

| Archivo | Cambio |
|---|---|
| `calculateAccountBalances.ts` | Ignora movimientos de una cuenta anteriores a su `opening_date`. Test de regresión: cuentas sin `opening_date` dan el mismo resultado de siempre. |
| `validatePaymentAccount.ts` | Valida `credit_limit`/`closing_day`/`payment_day`/`opening_date`; añade `validateNewCreditCard` (línea obligatoria al crear). Tuteo. |
| `evaluateNotifications.ts` | Parámetro `pendingRegistrations: PendingRegistration[]`; emite `register_due` (`related_id = key`, `cycle_key = 'YYYY-MM'`) sin duplicar por `hasEquivalent`. Las demás reglas no cambian. |
| `recordInstallmentPayment.ts` / `recordPrincipalPayment.ts` | Su resultado no cambia; la cuenta se aplica en el repositorio (abajo). |
| `evaluateMonthlyRecurrences.ts` (+ test) | **Se elimina** (R6). |

## `infrastructure/repositories/local`

| Archivo | Cambio |
|---|---|
| `LocalOnboardingRepository` | `progress(userId)` usa `resolveOnboardingProgress` y devuelve `0..6`. Nuevos: `saveIncome(userId, { income, payDay?, receivedThisMonth })` (reemplaza el ingreso de `saveStartingPoint`), `saveAccounts(userId, { cash: number; banks: {id,name,kind:'debit'\|'savings',balance}[]; declareNoBanks?: boolean })`, `saveCards(userId, cards[])`, `saveLoans(userId, loans[])`, `declareNotApplicable(userId, key)`, `skipStep(userId, step)`, `completeStep(userId, step: 2..6)`. Cada uno guarda datos + `onboarding_step` (+ `onboarding_version: 2`, `balance_since` en el primer paso) en **una** transacción y es idempotente por id de borrador. Nunca toca una cuenta existente salvo por id estable. |
| `LocalPaymentAccountRepository` | `save` acepta los campos nuevos. Crear una tarjeta valida línea de crédito. `ensureDefault` sin cambios. |
| `LocalIncomeSourceRepository` | `save` acepta `pay_day` y `received_month`. |
| `LocalInstallmentLoanRepository` | `create(data, alreadyPaid = 0)` fija `remaining_installments` y `status` sin crear pagos ni movimientos. `recordInstallmentPayment(loanId, n, date, accountId)` y `recordPrincipalPayment(loanId, cents, date, adjustment, accountId)` guardan `account_id` en el egreso. |
| `LocalMovementRecurrenceRepository` | `generate` → `adoptLegacySources(userId)` (sin crear ocurrencias, R6). |
| `LocalRegistrationRepository` (NUEVO) | `getInputs(userId, today)` (lee reglas, fuentes, préstamos, pagos, cuentas, movimientos del mes, omisiones — **un** punto de lectura para la lista y las notificaciones); `skip(userId, itemKey)`; `unskip(userId, itemKey)`. |
| `LocalProfileRepository` | Sin cambios de forma (ya hace merge); `ensureBalanceSince(userId, now)` fija `balance_since` una vez. |
| `LocalMovementRepository` | `save` ya acepta `recurrence_rule_id`/`recurrence_month` en `data`; test que fija que registrar desde "Por registrar" no desactiva la regla ni duplica el mes. |
| `observeAccountSession.ts` | `AccountState.startStep` pasa a `1..6`, `completed` sale de `resolveOnboardingProgress`. |

## `infrastructure/db` y sync

| Archivo | Cambio |
|---|---|
| `db.ts` | `this.version(19).stores({ reminder_skips: 'id, user_id, month' })`; `'reminder_skips'` en `SYNCED_TABLES`; tabla tipada `reminder_skips!: Table<ReminderSkip, string>`. |
| `sync/CustomSyncLayer.ts` | `'reminder_skips'` en `tables`. |
| `sync/recordAdapter.ts` | `'opening_date'` en `dateFields` (timestamp nuevo). Los demás campos nuevos son números, texto o booleanos. |

## `presentation/hooks`

| Hook | Cambio |
|---|---|
| `useSummaryData(userId, refDate)` (NUEVO, reemplaza `useDashboardData`) | Lee con `useLocalQuery` los repositorios y compone `calculateMonthBalance`, `buildCompactRule`, `buildPendingRegistrations`, `buildSetupChecklist`, meta principal. Observa también `reminder_skips`, `installment_payments` y `profiles`. Expone `view` + `register(item)` / `skip(item)`. |
| `useNotificationEvaluator` | Carga `LocalRegistrationRepository.getInputs`, calcula `cardOwed` con `calculateMonthBalance` + `selectCardOwed` (historial completo) y lo pasa a `evaluateNotifications`. |
| `useRecurrenceEvaluator` | **Se elimina**; `MainFlow` llama a `adoptLegacySources` una vez al entrar a la app. |
| `useGuidedTour(profile)` (NUEVO) | Estado del tour: paso actual, `next`, `skip`, `finish` (persiste `tour_seen`), `replay`. Sin lógica de negocio fuera de la transición de pasos. |
| `useThemePreference` (NUEVO, opcional) | Envuelve `useTheme` para el selector Claro/Oscuro/Sistema montado sin desajuste de hidratación. |

## Contratos de props de presentación (nuevos/cambian)

| Componente | Contrato |
|---|---|
| `QuickRecordSheet` | Nuevo prop `prefill?: RegistrationPrefill` (`{ tab, amountCents, accountId?, toAccountId?, incomeSourceId?, recurrenceRuleId?, recurrenceMonth?, loanId?, description? }`). Sin `prefill` el comportamiento es el actual. |
| `MovementForm` | Acepta `initialValues` y `links` (`recurrence_rule_id`, `recurrence_month`, `income_source_id`) y los guarda en el movimiento. |
| `TransferForm` | Acepta `initialValues` (origen, destino, monto sugerido). |
| Formulario de cuota/abono de préstamo | Selector de cuenta de origen con `pickPrimaryAccount` por defecto. |
| `OnboardingWizard` | 6 pasos: `startStep: 1..6`; `mode='settings'` abre 5 (distribución) o 6 (categorías), o un paso pendiente del checklist. |
| `MainFlow` | `onEditDistribution` → paso 5; `onEditCategories` → paso 6; nueva entrada `onCompleteSetup(key)` y `onReplayTour`. |
| `SettingsScreen` | Agrega "Completar configuración", "Ver tutorial" y el selector de tema; corrige "Recibe alertas…". |
