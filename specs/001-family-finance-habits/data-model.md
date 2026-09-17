# Data Model: Finanzas familiares, préstamos y hábitos motivacionales

Convenciones heredadas del modelo existente (`src/core/domain/models/types.ts`): toda entidad tiene
`id: UUID` y, salvo que se indique lo contrario, `user_id: UUID` (dueño desde la perspectiva de
sincronización). Todo monto es un entero de centavos PEN (Principio VIII). Los campos marcados
"enlazado" no se editan directamente por el usuario.

## Debt (Deuda/Préstamo)

Cubre FR-001 a FR-005, FR-010.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | dueño del registro (quien lo ve en su lista personal) |
| `counterparty_name` | string | nombre libre de la otra persona (no requiere que tenga cuenta en ez-life) |
| `direction` | `lent` \| `borrowed` | FR-001 |
| `origin` | `manual` \| `shared_expense` | FR-010; `shared_expense` referencia un `SharedMovement` |
| `shared_movement_id` | UUID? | solo si `origin = shared_expense` |
| `amount_cents` | integer | monto original de la deuda |
| `settled_amount_cents` | integer | acumulado de devoluciones parciales; `0 <= settled_amount_cents <= amount_cents` |
| `due_date` | date? | opcional, FR-002 |
| `interest_rate` | decimal? | opcional, puramente informativo (no se recalcula), FR-002 |
| `status` | `open` \| `settled` | derivado: `settled` cuando `settled_amount_cents = amount_cents` |
| `created_at`, `updated_at` | timestamp | |

**Validaciones**: `amount_cents > 0`. Una entrada de liquidación (parcial o total) es un evento que
incrementa `settled_amount_cents`; nunca genera un `Movement` (Principio X, FR-004).

**Transiciones de estado**: `open → open` (con cada devolución parcial) `→ settled` (cuando el saldo
llega a cero). No hay transición de vuelta a `open` una vez `settled`.

## SharedSpace (Espacio financiero compartido)

Cubre FR-006, FR-008, FR-015, FR-016.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `name` | string | |
| `permission_mode` | `strict` \| `open` | FR-015; default `strict` |
| `status` | `active` \| `archived` | `archived` cuando el último miembro se va (edge case) |
| `created_by` | UUID | solo referencia informativa; NO implica rol admin |
| `created_at` | timestamp | |

## SharedInvite (Invitación)

Cubre FR-006, FR-007. Entidad de corta vida, separada de `Membership`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `shared_space_id` | UUID | |
| `code` | string | corto, único, generado server-side |
| `created_by` | UUID | |
| `expires_at` | timestamp | `created_at + 24..48h` (Clarifications) |
| `redeemed_by` | UUID? | se completa al canjear |
| `redeemed_at` | timestamp? | |

**Validación de canje** (ver `research.md` #2): solo válido si `now() < expires_at` y
`redeemed_by IS NULL`. El canje y la creación de `Membership` ocurren atómicamente vía RPC.

## Membership (Membresía)

Cubre FR-007, FR-008, Principio IX.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `shared_space_id` | UUID | |
| `user_id` | UUID | |
| `joined_at` | timestamp | |
| `left_at` | timestamp? | presente si el miembro abandonó el espacio (FR-016) |

**Regla**: se crea únicamente como efecto del canje de un `SharedInvite` válido (nunca por inserción
directa del cliente). Un registro con `left_at` no vuelve a activarse — un reingreso requiere una
nueva invitación y una nueva fila.

## SharedMovement (Movimiento compartido)

Cubre FR-009, FR-010, FR-011, FR-012.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `shared_space_id` | UUID | |
| `created_by` | UUID | miembro que lo registró; recibe el resto del redondeo (Clarifications) |
| `type` | `income` \| `expense` | |
| `total_amount_cents` | integer | |
| `split_mode` | `percentage` \| `fixed_amount` | FR-009 |
| `splits` | `{ user_id, share_cents }[]` | suma de `share_cents` == `total_amount_cents`; el resto de redondeo se ajusta en la fila de `created_by` |
| `linked_movement_ids` | `{ user_id, movement_id }[]` | enlazado, uno por miembro (FR-011) |
| `date` | date | |
| `created_at` | timestamp | |

**Validaciones**: la suma de `splits[].share_cents` DEBE ser exactamente `total_amount_cents` (edge
case: rechazar si no cuadra antes del ajuste de redondeo). Editar/borrar solo permitido según
`SharedSpace.permission_mode` (FR-015) — mismo dueño o cualquiera en modo `open`.

**Efecto derivado**: crear/editar/borrar un `SharedMovement` recalcula el saldo entre cada par de
miembros (ver `research.md` #3) y mantiene sincronizados los `linked_movement_ids` (FR-011, FR-012).

## Habit (Hábito)

Cubre FR-017, FR-018, FR-019, FR-019a.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | |
| `name` | string | |
| `schedule_mode` | `fixed_days` \| `frequency` | FR-017 |
| `fixed_days` | `DayOfWeek[]`? | requerido si `schedule_mode = fixed_days`; al menos 1 día |
| `frequency_target` | integer? | requerido si `schedule_mode = frequency`; `>= 1` (edge case) |
| `current_streak` | integer | días (modo fijo) o semanas (modo frecuencia) consecutivos |
| `tokens_available` | integer | `0..3`, comodines acumulados (FR-019/FR-019a) |
| `completions_since_last_token` | integer | contador auxiliar para el modo frecuencia (cada 7 cumplimientos individuales, FR-019a) |
| `created_at` | timestamp | |

## HabitCompletion (Registro de cumplimiento)

Log append-only usado para calcular racha y comodines; no es visible como entidad de negocio
independiente en la UI, pero es necesaria para que el cálculo sea determinístico y testeable.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `habit_id` | UUID | |
| `date` | date | día en que se marcó cumplido |
| `token_used` | boolean | si ese día/semana se cubrió con un comodín en vez de un cumplimiento real |

## Goal (Meta)

Cubre FR-020. Independiente de `SavingsGoal` (Principio XIII).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | |
| `name` | string | |
| `kind` | `numeric` \| `checklist` | FR-020 |
| `target_value` | integer? | requerido si `kind = numeric` |
| `current_value` | integer? | solo si `kind = numeric` |
| `milestones` | `{ id, label, done }[]`? | requerido si `kind = checklist` |
| `status` | `active` \| `completed` | `completed` cuando `current_value >= target_value` o todos los `milestones[].done` |
| `created_at`, `completed_at` | timestamp | |

## Task (Tarea)

Cubre FR-021.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | |
| `title` | string | |
| `due_date` | date | |
| `status` | `pending` \| `done` | sin repetición; una tarea `done` se archiva (se excluye de listados activos) |
| `created_at`, `done_at` | timestamp | |

## Movement (extensión)

Se agregan dos campos opcionales al `Movement` existente para soportar el enlace de FR-011:

| Campo nuevo | Tipo | Notas |
|---|---|---|
| `shared_movement_id` | UUID? | presente solo si este movimiento fue generado por un `SharedMovement` |
| `is_linked` | boolean | `true` si es enlazado — bloquea edición/borrado directo fuera del `SharedMovement` de origen |

## Notification (extensión)

Se agregan cinco valores al enum de tipo existente (`budget_over_80`, `goal_completed`,
`daily_reminder`, …): `loan_due_soon`, `shared_movement_added`, `habit_reminder`, `task_due`,
`streak_at_risk` (FR-005, FR-014, FR-022). Sin cambios estructurales a la entidad `Notification`
en sí — mismos campos, nuevos valores posibles de `type`.

## Relaciones (resumen)

```
User 1---N Debt
User 1---N Habit 1---N HabitCompletion
User 1---N Goal
User 1---N Task
User N---N SharedSpace  (a través de Membership)
SharedSpace 1---N SharedInvite
SharedSpace 1---N SharedMovement 1---N Movement (enlazados, uno por miembro)
SharedMovement 0..1---0..1 Debt (origin = shared_expense)
```
