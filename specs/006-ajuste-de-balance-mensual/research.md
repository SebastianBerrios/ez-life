# Research: 006-ajuste-de-balance-mensual

## 1. Modelo del ajuste: Movement con marca, no entidad nueva

- **Decision**: un ajuste manual de balance es un `Movement` normal (`type: 'INCOME'` o
  `'EXPENSE'` según el signo) con un nuevo campo `is_adjustment: true`, y **sin**
  `distribution_category_id`/`expense_category_id`/`expense_subcategory_id`.
- **Rationale**: confirmado por trace directo — `Dashboard.tsx:75-77` calcula el balance total
  sumando por `m.type`, sin mirar categoría; `calculateCategoryBreakdown.ts:44-78` y
  `calculateSpentByBucket` (mismo archivo, líneas 30-42) filtran por
  `m.distribution_category_id === bucket.id`, así que un movimiento sin esa categoría queda
  naturalmente afuera de la distribución 50/30/20 sin ningún caso especial. Esto satisface FR-003
  (cuenta en el balance) y FR-004 (no cuenta en la distribución) **sin tocar ninguna lógica de
  cálculo existente** — cero riesgo de romper el 50/30/20 ya probado.
- **Alternatives considered**: nueva entidad `BalanceAdjustment` separada (rechazado — reimplementa
  todo lo que `Movement`/`IMovementRepository`/`MovementList` ya resuelven: persistencia, edición,
  borrado, listado; violaría Principio VII).

## 2. Motivo obligatorio (FR-002)

- **Decision**: nuevo use-case puro `src/core/use-cases/validateBalanceAdjustment.ts`, mismo patrón
  que `validateMovementAmount.ts` (ya usado en `MovementForm.tsx:109-117`), que exige
  `description` no vacío cuando `is_adjustment === true`.
- **Rationale**: confirmado que hoy nada valida `description` — es un `Input` opcional sin
  `required` (`MovementForm.tsx:26,318-327`) y `LocalMovementRepository.save` no valida nada
  (`LocalMovementRepository.ts:27-38`). La regla "motivo obligatorio para un ajuste" es una regla
  de negocio (Principio III), no una validación de formulario suelta.
- **Alternatives considered**: validar solo en el formulario con `required` HTML (rechazado —
  Principio III, la regla de negocio no puede vivir solo en la UI, sino ser testeable de forma
  aislada).

## 3. Distinción visual en Movimientos (FR-005)

- **Decision**: en `MovementList.tsx`, si `movement.is_adjustment`, mostrar un badge "Ajuste" junto
  al monto (mismo lugar donde hoy solo se muestra el signo +/- coloreado, líneas 82-84).
- **Rationale**: confirmado que hoy no hay ningún mecanismo de badge/etiqueta en la lista — se
  agrega uno nuevo, mínimo, solo para este caso.

## 4. Edición y borrado (FR-006)

- **Decision**: ningún cambio — un ajuste sigue el mismo camino de edición/borrado sin restricción
  que cualquier `Movement` personal.
- **Rationale**: confirmado que `is_linked`/`canEditLinkedMovement` (`guardMovementEdit.ts:8-10`)
  ni siquiera está conectado al botón de borrar de `MovementList.tsx` hoy — y un ajuste nunca lleva
  `is_linked`/`shared_movement_id`, así que no hay ninguna restricción aplicable.

## 5. Formulario

- **Decision**: extender `MovementForm.tsx` con un modo/checkbox "Es un ajuste de balance" que,
  al activarse, oculta los selectores de categoría/subcategoría (no aplican) y vuelve obligatorio
  el campo de motivo — reusando el mismo formulario en vez de crear uno nuevo.
- **Rationale**: Principio VII — un formulario nuevo dedicado duplicaría todo el manejo de
  monto/fecha/tipo que `MovementForm` ya resuelve.
- **Alternatives considered**: formulario separado `BalanceAdjustmentForm.tsx` (rechazado, misma
  razón que en §1 — duplicación innecesaria).
