# Data Model: 006-ajuste-de-balance-mensual

## `Movement` — nuevo campo `is_adjustment`

```ts
export interface Movement extends BaseEntity {
  // ...campos existentes sin cambios...
  is_adjustment?: boolean; // NUEVO — true si este movimiento es un ajuste manual de balance
}
```

- **Por qué**: distingue un ajuste de un ingreso/egreso regular para (a) exigir `description`
  obligatoria al crearlo, (b) mostrarlo con un badge distinto en Movimientos.
- **Validación** (`validateBalanceAdjustment`, nuevo use-case puro):
  - Si `is_adjustment === true`: `description` DEBE ser no vacía (FR-002).
  - Si `is_adjustment === true`: `distribution_category_id`, `expense_category_id`,
    `expense_subcategory_id` DEBEN quedar `undefined` — un ajuste nunca pertenece a una categoría
    de distribución (FR-004, garantiza la exclusión automática del research.md §1).
  - Si `is_adjustment` es `false`/`undefined`: sin cambios respecto al comportamiento actual.
- **Migración**: alta de campo opcional en Dexie (bump de versión de schema), sin backfill —
  todo `Movement` existente se interpreta como `is_adjustment: false` por ausencia del campo.

## Sin cambios

- Balance total (`Dashboard.tsx`) y distribución 50/30/20 (`calculateCategoryBreakdown.ts`,
  `calculateSpentByBucket`): cero cambios de código — ya producen el comportamiento correcto para
  un `Movement` con `is_adjustment: true` sin categoría (research.md §1).
- `IMovementRepository`, `LocalMovementRepository`: sin cambios de forma — `save()` ya acepta el
  shape completo de `Movement`, incluyendo el campo nuevo.
