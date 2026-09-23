# Data Model: 005-habitos-tareas-metas-ux

## `Task` — campos nuevos

```ts
export type TaskScheduleMode = 'fixed_days' | 'frequency'; // mismo vocabulario que Habit, campo propio

export interface Task extends BaseEntity {
  // ...campos existentes (id, user_id, title, due_date, status, done_at) sin cambios...
  description?: string;                    // NUEVO — nota opcional (FR-007)
  schedule_mode?: TaskScheduleMode;         // NUEVO — presente solo si la tarea es recurrente
  fixed_days?: DayOfWeek[];                 // NUEVO — requerido si schedule_mode = 'fixed_days'
  frequency_target?: number;                // NUEVO — requerido si schedule_mode = 'frequency', >= 1
  recurrence_series_id?: UUID;              // NUEVO — agrupa todas las ocurrencias de una misma serie
  recurrence_active?: boolean;              // NUEVO — false = no generar más ocurrencias (FR-004)
}
```

- **Validación**:
  - Una `Task` es recurrente si y solo si tiene `schedule_mode` (y por lo tanto
    `recurrence_series_id`). Una tarea puntual (no recurrente) no tiene ninguno de estos campos.
  - `recurrence_active` solo es relevante en la ocurrencia más reciente de una serie — el
    evaluador (`evaluateTaskRecurrence`) siempre la busca por `recurrence_series_id` +
    `due_date` máxima antes de decidir si genera la siguiente.
  - Cada ocurrencia generada es una fila `Task` independiente y completa (con su propio `id`,
    `due_date`, `status: 'pending'`), NUNCA una racha ni un contador — Principio XIII.
- **Migración**: alta de 5 campos opcionales en Dexie (bump de versión), sin backfill — tareas
  existentes quedan como no recurrentes.

## `Habit` — campo nuevo

```ts
export interface Habit extends BaseEntity {
  // ...campos existentes sin cambios...
  icon?: string; // NUEVO — emoji/ícono identificador opcional (FR-006)
}
```

## `Goal` — campo nuevo

```ts
export interface Goal extends BaseEntity {
  // ...campos existentes sin cambios...
  description?: string; // NUEVO — nota opcional (FR-008)
}
```

## Salida de `evaluateTaskRecurrence` (no persistida directamente — el caller decide)

```ts
function evaluateTaskRecurrence(tasks: Task[], today: Date): Task[]
// devuelve las NUEVAS ocurrencias a crear (sin id/created_at/updated_at — el repositorio los asigna)
```

- Por cada `recurrence_series_id` distinto con `recurrence_active !== false` en su ocurrencia más
  reciente: calcula si, según `schedule_mode`/`fixed_days`/`frequency_target` de esa ocurrencia,
  ya debería existir una próxima con `due_date <= today` que todavía no fue generada — si es así,
  la devuelve como nueva `Task` a crear (mismos campos de recurrencia, nueva `due_date`,
  `status: 'pending'`).

## Sin cambios

- `Habit.schedule_mode`/`fixed_days`/`frequency_target`: sin cambios — `Task` tiene su PROPIA copia
  de estos campos, nunca una referencia a `Habit` (Principio XIII).
