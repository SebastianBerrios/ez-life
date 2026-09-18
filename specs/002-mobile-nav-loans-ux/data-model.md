# Data Model: Navegación mobile, metas/tareas/hábitos, préstamos con cuotas y dropdowns

Convenciones heredadas del modelo existente (`src/core/domain/models/types.ts`): toda entidad tiene
`id: UUID` y `user_id: UUID` (dueño desde la perspectiva de sincronización). Todo monto es un entero
de centavos PEN (Principio VIII).

## InstallmentLoan (Préstamo con cuotas)

Cubre FR-011 a FR-013, FR-018 a FR-022, FR-025.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | dueño del registro |
| `lender_name` | string | nombre libre de la entidad financiera (ej. "BCP") |
| `amount` | integer | monto total prestado, centavos, tal como lo entrega el banco (FR-011, FR-012) |
| `installment_count` | integer | número total de cuotas pactadas originalmente |
| `remaining_installments` | integer | cuotas que faltan pagar; `0 <= remaining_installments <= installment_count` |
| `installment_amount` | integer | monto de cuota vigente, centavos — puede cambiar si un abono a capital lo reduce (FR-016/FR-017) |
| `interest_rate` | decimal? | opcional, puramente informativo, nunca usado para calcular nada (FR-013) |
| `status` | `active` \| `settled` | derivado: `settled` cuando `remaining_installments = 0` (FR-025) |
| `created_at`, `updated_at` | timestamp | |

**Validaciones**: `amount > 0`, `installment_count > 0`, `installment_amount > 0`. Toda operación
que llevaría `remaining_installments` por debajo de 0, o un abono a capital mayor al saldo pendiente
(`installment_amount * remaining_installments`), se **rechaza con un error de validación antes de
aplicarse** — nunca se capea silenciosamente (FR-021, Clarifications de `spec.md`).

**Transiciones de estado**: `active → active` (con cada pago de cuota o abono, mientras
`remaining_installments > 0`) `→ settled` (cuando llega a 0). No hay transición de vuelta a `active`
una vez `settled` — igual que `Debt`. Corregir los términos originales (FR-022) es una operación
distinta de registrar un pago; no cambia el estado por sí sola.

## InstallmentPayment (Pago de cuota o abono a capital)

Cubre FR-014 a FR-017, FR-026, FR-027. Log append-only, análogo a `HabitCompletion` — hace que el
historial de pagos de un préstamo sea revisable, no solo sus contadores actuales (Clarifications de
`spec.md`).

**Garantía contable (Principio X, FR-027)**: registrar un `InstallmentPayment` (de cualquier `kind`)
es contabilidad pura — decrementa `remaining_installments` o ajusta `installment_amount`/`status` en
`InstallmentLoan`, y nada más. NUNCA crea, actualiza ni referencia un `Movement`. Mismo contrato que
`applyDebtSettlement.ts` ya cumple para `Debt` (ver su test: "never returns anything resembling a
Movement").

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `installment_loan_id` | UUID | préstamo al que pertenece |
| `kind` | `installment` \| `principal` | distingue un pago de cuota regular de un abono a capital/adelanto (FR-015) |
| `amount` | integer | monto pagado, centavos |
| `date` | date | fecha del pago |
| `adjustment_type` | `reduce_term` \| `reduce_installment_amount` \| null | solo si `kind = principal` (FR-016); `null` si `kind = installment` |
| `resulting_value` | integer? | el nuevo valor que el usuario ingresó (nuevas cuotas restantes, o nuevo monto de cuota) — solo si `kind = principal` (FR-017); nunca calculado por el sistema |
| `created_at` | timestamp | |

**Validaciones**: `amount > 0`. Si `kind = principal`, `adjustment_type` y `resulting_value` son
obligatorios juntos; si `kind = installment`, ambos deben ser `null`.

## Goal, Task, Habit (sin cambios estructurales)

Cubre FR-005 a FR-009. Estas tres entidades **no ganan ningún campo nuevo, ni ningún método de
repositorio nuevo**: `LocalGoalRepository.save()`, `LocalTaskRepository.save()` y
`LocalHabitRepository.save()` ya hacen upsert por `id` (buscan el existente, mezclan campos si lo
encuentran, crean si no) — confirmado leyendo esos tres archivos. La capacidad de edición (FR-006)
se resuelve pasándole a `save()` el `id` de un ítem existente desde la UI, no agregando un método
`update(...)` nuevo. (Corrección aplicada durante `/speckit-analyze`, hallazgo F1 — este documento y
`contracts/repositories.md` originalmente proponían un método nuevo que no hace falta.) La
separación entre página "Crear" y "Control" (FR-005, FR-007 a FR-009) es puramente de presentación:
ambas páginas leen y escriben las mismas entidades, solo que "Control" nunca invoca las operaciones
de creación.

## SavingsGoal, Debt (sin cambios)

Explícitamente fuera de alcance (FR-010, FR-018) — no se documentan de nuevo acá, ver
`specs/001-family-finance-habits/data-model.md` para su forma actual.

## Relaciones (resumen)

```
User 1---N InstallmentLoan 1---N InstallmentPayment
User 1---N Debt                          (sin cambios — coexiste con InstallmentLoan en "Préstamos")
User 1---N Goal | Task | Habit           (sin cambios de forma — ganan edición vía `save()` upsert)
```
