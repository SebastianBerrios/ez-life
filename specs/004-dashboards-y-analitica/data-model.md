# Data Model: 004-dashboards-y-analitica

Ninguna entidad persistida cambia. Este spec agrega tipos derivados (calculados en memoria por
use-cases puros, nunca guardados en Dexie) que consumen los componentes de gráfico.

## `PeriodComparison` (salida de `compareMonthlyPeriods`)

```ts
interface PeriodComparison {
  current: { income: number; expense: number; balance: number };  // centavos
  previous: { income: number; expense: number; balance: number } | null; // null si no hay datos previos
  delta: { income: number; expense: number; balance: number } | null;    // current - previous
}
```

- **Validación**: `previous`/`delta` son `null` cuando no hay movimientos del período anterior
  (spec.md Edge Cases — "no muestra una comparación period-over-period rota").

## `HabitStreakHistoryPoint[]` (salida de `calculateHabitStreakHistory`)

```ts
interface HabitStreakHistoryPoint {
  date: Date;
  completed: boolean; // true si hubo HabitCompletion real o token_used ese día
}
```

- **Rango**: por defecto últimos 30 días (spec FR-010), parametrizable si el usuario cambia el
  rango desde la UI.

## `TaskCompletionStats` (salida de `calculateTaskCompletionStats`)

```ts
interface TaskCompletionStats {
  onTime: number;   // status='done' && done_at <= due_date
  overdue: number;  // status='pending' && due_date < hoy, O status='done' && done_at > due_date
  pending: number;  // status='pending' && due_date >= hoy
}
```

## `number` (salida de `calculateGoalProgress`)

- Rango `[0, 1]`. Numérico: `current_value / target_value` (clamp a 1 si excede). Checklist:
  `milestones.filter(done).length / milestones.length`.

## Sin cambios de modelo

- `Movement`, `DistributionCategory`, `ExpenseCategory`, `ExpenseSubcategory`: se leen tal cual
  existen; FR-007/008 solo cambian qué se muestra en `MovementList`, no el shape de `Movement`.
- `Habit`, `HabitCompletion`, `Task`, `Goal`: sin cambios de campos.
