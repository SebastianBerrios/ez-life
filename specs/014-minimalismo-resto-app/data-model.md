# Data Model: Minimalismo en el resto de la app

**Feature**: `014-minimalismo-resto-app` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

> **Sin cambios al modelo persistido.** Esta spec es estrictamente de presentación (FR-024): **0 cambios** a tablas
> Dexie, **0 migraciones** Supabase, **0 cambios** en la capa de sync y **0 cambios** a entidades de dominio
> persistidas en `src/core/domain/models/types.ts`.

Este documento describe únicamente los **modelos derivados de vista (in-memory)** que construyen las funciones puras
en `src/core/use-cases/` para alimentar las pantallas rediseñadas.

---

## 1. Finanzas: Modelos derivados de protagonista y frases

### `FinancesHeroSummary` (producido por `buildFinancesHero`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `movementsNetCents` | `number` (entero, céntimos) | Balance neto del periodo filtrado: `ingresos − egresos` (excluyendo `TRANSFER`). |
| `movementsIncomeCents` | `number` (entero, céntimos) | Total de ingresos del conjunto filtrado. |
| `movementsExpenseCents` | `number` (entero, céntimos) | Total de egresos del conjunto filtrado. |
| `ruleSpentPercent` | `number \| null` | Porcentaje gastado del ingreso mensual esperado (`Math.round(totalSpent * 100 / base)`); `null` si `base <= 0`. |
| `ruleTotalSpentCents` | `number` (entero, céntimos) | Total gastado en el ciclo para la regla 50/30/20. |
| `ruleExpectedIncomeCents` | `number` (entero, céntimos) | Base de ingreso mensual esperado. |
| `totalOwedCents` | `number` (entero, céntimos) | Total que el usuario debe: suma de préstamos en cuotas activos restantes + deuda corriente de tarjetas (`selectCardOwed`) + deudas informales `borrowed` pendientes. |
| `totalOwedToMeCents` | `number` (entero, céntimos) | Total que le deben al usuario: suma de deudas informales `lent` pendientes (mostrado en bloque secundario aparte). |
| `creditCards` | `FinancesCreditCardItem[]` | Tarjetas activas con `accountId`, `name`, `owedCents`, `creditLimitCents?`, `paymentDay?`. |

**Reglas de validación / invariantes**:
- Todos los valores monetarios son enteros en céntimos (PEN, Principio VIII).
- Las transferencias (`type === 'TRANSFER'`) nunca entran en `movementsNetCents`, `movementsIncomeCents` ni `movementsExpenseCents`.
- Las deudas `lent` nunca se restan de `totalOwedCents`; se reportan exclusivamente en `totalOwedToMeCents`.
- Préstamos con `status === 'settled'` o `deleted_at` definido no suman a `totalOwedCents`.

---

## 2. Espacio Compartido: Modelos derivados de saldos y movimientos

### `SharedSpaceNetSummary` (producido por `formatSharedSpacePhrases`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `netCents` | `number` (entero, céntimos) | Saldo neto del usuario actual en el espacio (`> 0` le deben, `< 0` debe, `0` al día). |
| `tone` | `'positive' \| 'negative' \| 'settled'` | Tono semántico para el hero del espacio. |
| `heroPhrase` | `string` | Frase protagonista (ej. `"Te deben S/ 40"`, `"Debes S/ 40"`, `"Están al día"`). |
| `pairPhrases` | `SharedPairPhrase[]` | Lista de saldos por par con frase natural (`"Ana te debe S/ 40"`, `"Le debes S/ 40 a Ana"`), monto en céntimos y tono. |

### `SharedMovementDisplay` (derivado de `SharedMovement`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID del movimiento compartido. |
| `title` | `string` | Descripción o concepto breve. |
| `amountCents` | `number` | Monto total en céntimos. |
| `date` | `Date` | Fecha del movimiento. |
| `splitPhrase` | `string` | Frase legible (ej. `"Pagó Ana · dividido en partes iguales"`, `"Pagaste tú · división personalizada"`). |

---

## 3. Control y Hábitos: Vista "Foco de Hoy"

Reutiliza `ControlView` existente (`src/core/use-cases/buildControlView.ts`) sin fusionar entidades (Principio XIII):
- **Puntaje de hoy**: `view.score` (`pct`, `done`, `scheduled`, `hasData`), `view.activeStreak`, `view.scoreState`.
- **Foco de Hoy**: subconjunto derivado de:
  - Hábitos programados para hoy (`view.habits.filter(h => h.scheduledToday)`).
  - Tareas urgentes o para hoy (`view.tasks.overdue` + `view.tasks.today`).
- **Selector segmentado**: `'habits' | 'tasks' | 'goals'` — renderiza `HabitsPanel`, `TasksPanel` o `GoalsPanel` de forma exclusiva, conservando el ciclo de vida propio de cada entidad.

---

## 4. Formularios: Estado de bloque "Más opciones"

### `AdvancedDisclosureState` (producido por `formAdvancedFields`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `activeCount` | `number` | Cantidad de campos avanzados con valor no por defecto (entero `>= 0`). |
| `label` | `string` | `"Más opciones"` si `activeCount === 0`; `"Más opciones · 1 activa"` si `1`; `"Más opciones · N activas"` si `> 1`. |
| `hasError` | `boolean` | `true` si existe un error de validación perteneciente a un campo avanzado (dispara `open = true`). |

**Transiciones de estado**:
1. **Crear**: `open = false`, `activeCount = 0`, etiqueta `"Más opciones"`.
2. **Editar (con valores avanzados)**: `open = false`, `activeCount = N > 0`, etiqueta `"Más opciones · N activas"`.
3. **Toggle manual**: el usuario alterna `open` libremente.
4. **Submit con error en campo avanzado**: `open` pasa automáticamente a `true` (FR-023) y el error se renderiza junto al campo afectado.

---

## 5. Ajustes: Estado de secciones colapsables

### `SettingsSectionId`

```ts
export type SettingsSectionId =
  | 'profile'
  | 'accounts'
  | 'notifications'
  | 'appearance'
  | 'data';
```

- Estado inicial: `Set<SettingsSectionId>` vacío (todas plegadas por defecto, FR-021).
- Excepción de navegación directa: si `focus` (`AccountFocus`) o `editAccountId` está presente, `'accounts'` se añade automáticamente al `Set` de secciones abiertas.
- Interacción: abrir una sección añade su ID al `Set` sin cerrar las demás (múltiples secciones abiertas simultáneamente).
