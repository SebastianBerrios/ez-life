# Data Model: 003-fixes-criticos

Ningún cambio de este spec introduce una entidad nueva. Dos entidades existentes ganan un campo
opcional; el resto de los fixes son de comportamiento (lógica de filtrado, wiring de refresh,
posicionamiento de UI), sin tocar el modelo de datos.

## `InstallmentLoan` — nuevo campo `distribution_category_id`

```ts
export interface InstallmentLoan extends BaseEntity {
  // ...campos existentes sin cambios...
  distribution_category_id?: UUID; // NUEVO — categoría de distribución (50/30/20) que usarán
                                    // los Movements que este préstamo genere a partir de ahora
}
```

- **Por qué**: FR-010/FR-011 exigen que el `Movement` generado por un pago de préstamo cuente en
  la distribución 50/30/20 del usuario (Principio X amendado, v2.0.0) — para eso necesita una
  categoría real, y `InstallmentLoan` hoy no tiene ninguna.
- **Validación**: opcional a nivel de tipo (para no romper préstamos ya existentes sin este campo,
  consistente con FR-013 — sin backfill retroactivo), pero **obligatorio en la práctica** antes de
  poder registrar un nuevo pago que genere Movement: si un préstamo no tiene
  `distribution_category_id`, el flujo de pago debe pedirlo una vez (ej. al momento de pagar, o
  como parte de "Corregir términos") antes de continuar.
- **Migración**: alta de campo opcional en Dexie (bump de versión de schema en `db.ts`, sin
  necesidad de poblar datos existentes — Dexie permite campos ausentes en filas viejas).

## `Movement` — nuevo campo `installment_payment_id`

```ts
export interface Movement extends BaseEntity {
  // ...campos existentes sin cambios...
  installment_payment_id?: UUID; // NUEVO — presente solo si el movimiento fue generado
                                  // automáticamente por un InstallmentPayment (FR-010)
}
```

- **Por qué**: análogo a `shared_movement_id` (ya existente, mismo propósito de trazabilidad para
  movimientos generados automáticamente por otro flujo). Permite:
  - Idempotencia: si `recordInstallmentPayment`/`recordPrincipalPayment` se reintenta (ej. error de
    red a mitad de transacción), el repositorio puede verificar si ya existe un `Movement` con ese
    `installment_payment_id` antes de crear uno duplicado.
  - Distinguir en Movimientos (Historial) un egreso "automático" de préstamo de uno manual, sin
    depender solo de heurísticas de descripción/categoría.
- **Validación**: opcional; solo presente en movimientos generados por esta feature. Un `Movement`
  con `installment_payment_id` sigue las mismas reglas de edición que cualquier otro (no se marca
  `is_linked` como los de `SharedMovement`, ya que el usuario sí debe poder corregirlo si se
  equivocó de monto).
- **Migración**: alta de campo opcional en Dexie, mismo tratamiento que el anterior.

## Relación

```
InstallmentLoan (1) ──has-many──> InstallmentPayment (bookkeeping, sin cambios de forma)
InstallmentPayment (1) ──generates──> Movement (0..1, nuevo desde este spec, vía installment_payment_id)
InstallmentLoan.distribution_category_id ──used-by──> Movement.distribution_category_id
                                                         (copiado al momento de generar el Movement)
```

## Sin cambios de modelo

- `Habit`/`HabitCompletion`: el fix de FR-004 es un cambio de condición en `HabitList.tsx`
  (dejar de retornar `null` para hábitos no programados hoy), no un cambio de esquema.
- `Task`, `Goal`: sin cambios de modelo en este spec (la UI de creación más rica es 005; el
  dashboard es 004).
- `SharedInvite`, `SharedSpace`, `Debt`, `SavingsGoal`: no afectados por este spec.
