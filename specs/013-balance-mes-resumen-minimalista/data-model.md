# Data Model: Balance del mes, cuentas y deudas, tutorial y Resumen minimalista

**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Todo el dinero es **entero en céntimos**, solo PEN (Principio VIII). Los campos nuevos son opcionales: un
registro anterior a esta spec sigue siendo válido sin migración de datos.

## Entidades persistidas (cambios)

### `PaymentAccount` (existente, ampliada) — `core/domain/models/types.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `credit_limit?` | `number` (céntimos, > 0) | Solo `kind = 'credit'`. Obligatoria al **crear** una tarjeta desde esta versión (FR-024); las existentes quedan `undefined` y muestran "Debes S/ X" + "Agregar línea de crédito" (FR-035). |
| `closing_day?` | `number` (1–31) | Solo crédito. Informativo. |
| `payment_day?` | `number` (1–31) | Solo crédito. Alimenta "Pagar tarjeta" en "Por registrar". |
| `opening_date?` | `Date` | Día local en que se declaró `opening_balance`. Si existe, los movimientos de la cuenta con fecha anterior se ignoran al calcular saldos (R2). `undefined` = historial completo (cuentas existentes). |

Invariantes (validador puro `validatePaymentAccount`, ampliado):
- `credit_limit`, `closing_day`, `payment_day` solo válidos con `kind = 'credit'`.
- Tarjeta **nueva**: `credit_limit` obligatoria; consumo inicial (`-opening_balance`) ≤ `credit_limit`.
- `opening_balance` de cuentas `debit`/`cash`/`savings` ≥ 0 en el onboarding (en Ajustes se mantiene la regla actual).
- Días enteros en 1–31.

### `IncomeSource` (existente, ampliada)

| Campo | Tipo | Notas |
|---|---|---|
| `pay_day?` | `number` (1–31) | "¿Qué día te pagan?". Sin valor → no hay ítem "Sueldo" en "Por registrar". |
| `received_month?` | `string` `'YYYY-MM'` | "Ya recibí mi sueldo de este mes". Si es igual al mes consultado, no se espera el ingreso ese mes (US2-S2). |

### `InstallmentLoan` (existente, ampliada)

| Campo | Tipo | Notas |
|---|---|---|
| `payment_day?` | `number` (1–31) | Día de pago de la cuota. Sin valor → no hay "Cuota de …". |

El onboarding crea el préstamo con `remaining_installments = installment_count − cuotas ya pagadas`
(`create` gana un parámetro `alreadyPaid = 0`); **no** crea `InstallmentPayment` ni `Movement` (FR-025). Con
`alreadyPaid = installment_count` el préstamo nace `settled` (edge case de la spec).

### `Debt` (existente, sin cambios de forma)

La "deuda informal que debes" del paso 4 sin cuotas es un `Debt` con `direction: 'borrowed'`,
`origin: 'manual'`, `amount` = saldo pendiente, `settled_amount: 0`.

### `Movement` / `MovementRecurrence` (sin cambios de forma)

Los vínculos para "cubierto por vínculo estructurado" ya existen: `income_source_id`, `recurrence_rule_id` +
`recurrence_month`, `installment_payment_id`, `to_account_id`. El egreso de una cuota/abono pasa a llevar
`account_id` (R13).

### `Profile` (existente, ampliado)

| Campo | Tipo | Notas |
|---|---|---|
| `onboarding_step?` | `0..6` (antes `0..3`) | Pasos nuevos: 1 Ingresos, 2 Dinero, 3 Tarjetas, 4 Préstamos, 5 Distribución, 6 Categorías. Interpretación de perfiles sin `onboarding_version` en R10. |
| `onboarding_version?` | `2` | Marca la numeración nueva. |
| `balance_since?` | `string` `'YYYY-MM'` | Mes desde el que rigen las reglas de tarjeta (R4). |
| `checklist_dismissed?` | `boolean` | Tarjeta "Completa tu configuración" descartada. |
| `checklist_not_applicable?` | `ChecklistKey[]` | `'accounts' \| 'cards' \| 'loans'` declarados "no aplica". |
| `tour_seen?` | `boolean` | El tour ya se vio (cualquier dispositivo). |

### `ReminderSkip` (**tabla nueva** `reminder_skips`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `UUID` | `stableId('skip:<userId>:<itemKey>')` → idempotente entre dispositivos. |
| `user_id` | `UUID` | Propietario (RLS). |
| `item_key` | `string` | `<kind>:<refId>:<YYYY-MM>`; `kind ∈ income \| recurrence \| installment \| card`. |
| `month` | `string` `'YYYY-MM'` | Redundante con la clave para consultar por mes. |
| `created_at`, `updated_at`, `deleted_at?` | `Date` | `BaseEntity`. Omitir se deshace con borrado lógico. |

Dexie v19: `reminder_skips: 'id, user_id, month'`; se agrega a `SYNCED_TABLES` (`db.ts`) y a `tables`
(`CustomSyncLayer.ts`, **después** de `profiles`; no depende de otras). Sin índice en los campos opcionales
nuevos de las demás tablas.

### `Notification` (existente)

`NotificationType` gana `'register_due'`. `related_id` = `itemKey`, `cycle_key` = `'YYYY-MM'`.

## Entidades derivadas (no persistidas)

### `MonthBalance` — `core/use-cases/calculateMonthBalance.ts`

```ts
interface MonthBalance {
  opening: number;      // Arranque(M) = Balance(M − 1)
  entro: number;        // ingresos reales + aporte implícito a ahorros
  salio: number;        // gastos reales (+ tarjetas, cuotas) + tramo de deuda previa pagado
  ahorraste: number;    // a ahorros: transferencias, gastos de la categoría de ahorro, ingresos depositados en ahorros
  sacaste: number;      // de ahorros: retiros, gastos pagados desde ahorros, pagos de tarjeta desde ahorros
  ajuste: number;       // ajustes manuales con signo (0 si no hay)
  balance: number;      // forma cerrada (R1); puede ser negativo
  savingsNet: number;   // ahorraste − sacaste (puede ser negativo)
  cards: CardDebtSummary[];
}
interface CardDebtSummary {
  accountId: string; name: string;
  owed: number;          // total adeudado hoy (≥ 0)
  previousDebt: number;  // parte que es deuda previa
  creditLimit?: number;  // undefined → "Debes S/ X"
  paymentDay?: number;
}
```

`balance === opening + entro − salio − ahorraste + sacaste + ajuste` es un **invariante** probado.

### `PendingRegistration` — `core/use-cases/buildPendingRegistrations.ts`

```ts
type RegistrationKind = 'income' | 'recurrence' | 'installment' | 'card';
interface PendingRegistration {
  key: string;            // `${kind}:${refId}:${YYYY-MM}`
  kind: RegistrationKind;
  refId: string;          // fuente, regla, préstamo o tarjeta
  title: string;          // "Sueldo", nombre de la regla, "Cuota de BCP", "Pagar tarjeta BBVA"
  amount: number;         // céntimos (sugerido para tarjeta)
  day: number;            // día efectivo del mes (con recorte a fin de mes)
  overdue: boolean;       // día efectivo < hoy
}
```

Estados (calculados, no guardados): *pendiente* (visible), *registrado* (existe vínculo estructurado en el mes)
y *omitido* (hay `ReminderSkip`). Un ítem solo se lista si está pendiente y `hoy ≥ día − adelanto`.

### `SetupChecklist` — `core/use-cases/buildSetupChecklist.ts`

```ts
interface SetupChecklist {
  items: { key: 'income' | 'accounts' | 'cards' | 'loans'; done: boolean }[];
  doneCount: number;   // N de 4
  visible: boolean;    // !checklist_dismissed && doneCount < 4
  nextPending?: 'income' | 'accounts' | 'cards' | 'loans'; // lo que abre "Completar configuración"
}
```

## Transiciones y reglas de estado

- **Onboarding**: `0 → 1 → … → 6`. Cada paso guarda datos + `onboarding_step` en una transacción. "Omitir"
  (pasos 3 y 4) avanza sin datos y deja el ítem pendiente; "No tengo tarjetas/préstamos" avanza y agrega la
  clave a `checklist_not_applicable`. Pulsar "Solo uso efectivo" en el paso 2 agrega `'accounts'`; continuar sin bancos y sin pulsarlo deja Cuentas pendiente.
- **Tour**: `tour_seen` pasa a `true` al terminar u omitir; "Ver tutorial" lo repite sin cambiar el campo.
- **Omitir este mes**: crea un `ReminderSkip` del mes; el mes siguiente genera otra clave, por lo que el ítem
  reaparece (US3-S3).
- **Registrar**: abre el formulario correspondiente prellenado; al guardar el movimiento (con su vínculo), el
  ítem pasa a *registrado* y desaparece de forma reactiva (se observa `movements`).

## Tokens visuales

Propuesta inicial (se afina contra el test de contraste AA; los pares texto/fondo deben ≥ 4.5:1, texto
grande ≥ 3:1):

| Token | Claro | Oscuro |
|---|---|---|
| `--background` | crema `#FBF5EA` | ciruela oscuro `#241A2B` |
| `--foreground` | ciruela `#3A2745` | crema `#F6EEE3` |
| `--card` | `#FFFFFF` con sombra cálida | `#2F2338` |
| `--primary` (acento) | verde pastel `#8ED1A4` con texto ciruela `#2A1B33` | verde pastel `#9ADBB0` con texto `#241A2B` |
| Píldora Necesidades | fondo `#DDEBFA` / texto `#1F3B57` | par propio, mismo criterio |
| Píldora Deseos | fondo `#F8E0EC` / texto `#5A2142` | par propio |
| Píldora Ahorro | fondo `#DCF2E3` / texto `#1E4A32` | par propio |

Radios: tarjetas 28 px, controles pastilla (`rounded-full`), sombras `0 6px 24px -8px` con tinte ciruela.
Tipografías: `--font-fredoka` (cifras y títulos), `--font-figtree` (texto). Valores definitivos: los fija la
implementación; lo normativo es FR-039–FR-042 y SC-007.
