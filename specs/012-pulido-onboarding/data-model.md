# Data Model — Spec 012

**Sin cambios de esquema.** No hay versión nueva de Dexie ni migración de Supabase. Solo cambian
invariantes, valores iniciales y el orden de lectura.

## PaymentAccount (cuenta "Efectivo")

Campos existentes (spec 011): `id, user_id, name, kind, opening_balance (céntimos), archived?, sort_order?,
created_at, updated_at, deleted_at?`.

| Aspecto | Antes | Después |
|---------|-------|---------|
| Quién crea la cuenta por defecto | `MainFlow` → `ensureDefault` al entrar a la app | El wizard (`saveStartingPoint`, paso 1); `ensureDefault` queda como respaldo para usuarios que ya existían |
| `opening_balance` inicial | Siempre `0` | `parseCurrentBalance(saldo del paso 1)` (≥ 0, entero en céntimos) |
| Id | `stableId('seed-account:<user>:efectivo')` | Igual (sin cambios) |

**Invariantes**
- `opening_balance >= 0` al crearse desde el onboarding.
- Una fila con el id estable existente **nunca** se modifica desde el onboarding ni desde `ensureDefault`.
- El saldo mostrado en "Capital disponible" = saldo inicial de las cuentas + movimientos (cálculo existente).

## DistributionCategory

| Aspecto | Antes | Después |
|---------|-------|---------|
| `percentage` | entero `1..100` | entero `0..100`; `0` solo si `is_savings` |
| `is_savings` (UI) | editable con radio | **no editable**; categorías nuevas siempre `false` |
| `is_savings` (datos) | exactamente una por usuario | igual; se conserva la que cada usuario ya tenga |
| Eliminación | bloqueada en repo; UI mostraba botón | bloqueada en repo **y** sin botón en UI (no hay acción que avisar) |

**Reglas de `validateDistribution`** (resultado): ids únicos; nombres no vacíos; porcentajes enteros;
`>=1` salvo la de ahorro (`>=0`); suma exacta 100; exactamente una `is_savings`.

## ExpenseCategory / ExpenseSubcategory

| Aspecto | Antes | Después |
|---------|-------|---------|
| Orden de lectura | clave primaria (arbitrario) | `created_at` ascendente, desempate `id` |
| `created_at` de filas nuevas | `new Date()` (puede empatar) | `nextCreatedAt()` (estrictamente creciente en la sesión) |
| Subcategorías al crear categoría | ≥ 1 obligatoria (UI mandaba `General`) | opcional; la categoría puede nacer vacía |
| Eliminar última subcategoría | bloqueado | bloqueado (sin cambio) |

**Estados de una categoría de gasto durante el onboarding**: `vacía` (0 subcategorías) → `completa`
(≥ 1). Mientras exista una `vacía`, "Finalizar" está deshabilitado y el selector de movimientos no la
ofrece. Las semillas (`defaultCategorySeeds`) siguen naciendo completas. Las categorías con "General" ya
creadas no se tocan.

## Aviso transitorio (solo estado de UI, no persiste)

| Campo | Descripción |
|-------|-------------|
| `key` | Identifica el elemento que lo causó (id de categoría/subcategoría/bucket) |
| `text` | Mensaje en tuteo neutro |
| `ttl` | 4000 ms por defecto |

**Transiciones**: `show(key, text)` → visible → (4 s | `clear(key)` | `clearAll()` | desmontaje) → oculto.
Un `show` repetido con la misma clave reinicia el temporizador.

## Sincronización

Sin cambios de tablas ni de lista blanca de `sync_record`. La cuenta creada en el wizard entra por el hook
`creating` de Dexie a `sync_queue`, igual que cualquier alta. `payment_accounts` ya se sincroniza antes de
`movements` (spec 011).
