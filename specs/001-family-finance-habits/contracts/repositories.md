# Contratos: interfaces de repositorio

Esta app no expone una API REST propia — el "contrato" real hacia el resto del sistema (los
`core/use-cases` y `presentation/`) son las interfaces de repositorio en
`src/core/domain/repositories/IRepositories.ts`, igual que para `IMovementRepository`,
`ISavingsGoalRepository`, etc. ya existentes. Cada una tiene una implementación local
(`infrastructure/repositories/local/Local*Repository.ts`, Dexie) que además encola el cambio en
`sync_queue` para la sincronización con Supabase.

Firmas a nivel de contrato (sin implementación) — todas devuelven/reciben los tipos de
`data-model.md`:

## IDebtRepository

- `getAll(userId): Promise<Debt[]>`
- `getById(id): Promise<Debt | undefined>`
- `create(debt): Promise<void>`
- `recordSettlement(debtId, amountCents, date): Promise<void>` — incrementa `settled_amount_cents`; nunca crea un `Movement` (Principio X)
- `delete(id): Promise<void>`

## ISharedSpaceRepository

- `getAllForUser(userId): Promise<SharedSpace[]>` — vía join con `Membership`
- `create(name, ownerUserId): Promise<SharedSpace>`
- `setPermissionMode(spaceId, mode): Promise<void>` — FR-015, cualquier miembro activo puede invocarlo
- `archiveIfEmpty(spaceId): Promise<void>` — edge case: se ejecuta tras cada salida de miembro

## ISharedInviteRepository

- `create(spaceId, createdBy): Promise<SharedInvite>` — genera `code` y `expires_at`
- `redeem(code, userId): Promise<Membership>` — DEBE ejecutarse contra la RPC descrita en `rpc-functions.md`, nunca como insert directo

## IMembershipRepository

- `getMembers(spaceId): Promise<Membership[]>` — solo miembros activos (`left_at IS NULL`)
- `leave(spaceId, userId): Promise<void>` — FR-016; dispara `archiveIfEmpty` si era el último miembro

## ISharedMovementRepository

- `getAllForSpace(spaceId): Promise<SharedMovement[]>`
- `create(movement): Promise<void>` — valida que `splits` sume `total_amount_cents`, aplica el ajuste de redondeo al `created_by` (Clarifications), y genera los `Movement` enlazados por miembro
- `update(id, movement): Promise<void>` — respeta `permission_mode` (validación de UI + RLS del lado servidor)
- `delete(id): Promise<void>` — recalcula el saldo del espacio al eliminar

## IHabitRepository

- `getAll(userId): Promise<Habit[]>`
- `create(habit): Promise<void>` — valida `fixed_days.length >= 1` o `frequency_target >= 1` (edge case)
- `recordCompletion(habitId, date, tokenUsed): Promise<void>` — actualiza `current_streak`, `tokens_available`, `completions_since_last_token` vía el use-case puro de racha (no lógica en el repositorio)
- `delete(id): Promise<void>`

## IGoalRepository

- `getAll(userId): Promise<Goal[]>`
- `create(goal): Promise<void>`
- `updateProgress(goalId, currentValueOrMilestoneId): Promise<void>` — marca `completed` cuando corresponde
- `delete(id): Promise<void>`

## ITaskRepository

- `getAll(userId): Promise<Task[]>` — filtra `pending` por defecto para "próximas a vencer"
- `create(task): Promise<void>`
- `markDone(taskId): Promise<void>`
- `delete(id): Promise<void>`

## INotificationRepository (extensión, sin cambio de forma)

Sin nuevos métodos — se reutiliza tal cual, solo se agregan los nuevos valores de `type` descritos
en `data-model.md`.
