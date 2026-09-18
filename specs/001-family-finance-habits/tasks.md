# Tasks: Finanzas familiares, préstamos y hábitos motivacionales

**Input**: Design documents from `/specs/001-family-finance-habits/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (todos presentes)

**Tests**: Incluidos. El proyecto tiene TDD estricto habilitado y el Principio IV de la constitución
exige al menos un test unitario por caso de uso, más Testing Library para todo wiring de UI. Cada
tarea de test debe escribirse y **fallar** antes de su implementación correspondiente.

**Organization**: Tareas agrupadas por historia de usuario (spec.md), en orden de prioridad P1→P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1..US7, mapeado 1:1 a las historias de `spec.md`
- Rutas de archivo exactas en cada descripción

## Path Conventions

Proyecto único existente (`src/core`, `src/infrastructure`, `src/presentation`) — ver `plan.md` §
Project Structure. Sin separación frontend/backend: el "backend" son dos funciones RPC de Supabase
más las tablas replicadas.

---

## Phase 1: Setup

**Purpose**: Confirmar que no hace falta preparación de infraestructura nueva antes de tocar código de dominio.

- [X] T001 Confirmar en `package.json` que `@supabase/supabase-js` (ya instalado) expone el cliente Realtime usado en `research.md` #1 — sin instalar nada nuevo (Principio I/VII). ✅ Confirmado: `@supabase/supabase-js ^2.116.0` ya incluye `supabase.channel()`.
- [X] T002 [P] Verificar si existe `supabase/migrations/` en el repo; si no existe, inicializarlo siguiendo la convención de esquema-por-app de `mvp-lab-infra/OPERATIONS.md` (nunca `supabase db pull`, siempre migraciones con timestamp + `supabase db push`) antes de escribir la primera migración de esta feature.
  ✅ **Resuelto**: `ez-life` nunca se había desplegado a `mvp-lab` (schema `ez_life` no existía). Se creó `supabase/migrations/` con `20260917190158_init_ez_life.sql` (schema base completo, paridad con el Dexie local existente — profiles/income_sources/distribution_categories/expense_categories/expense_subcategories/savings_goals/movements/notifications — con RLS y `enroll_self()` adaptado a que ez-life loguea solo por OAuth, sin gate de metadata) + `20260917190159_add_debts.sql` (esta feature). Se agregaron 81 stubs vacíos para las migraciones ajenas del ledger compartido (`OPERATIONS.md` §4, nunca `migration repair --reverted`). `supabase db push` corrido y verificado objeto por objeto; `pgrst.db_schemas` actualizado (append-only, sin tocar las otras apps); `audit/fleet-auth-audit.sql` corrido: 0 `FAIL`, los únicos `REVIEW` son de otras apps preexistentes. `client.ts` ahora usa `db: { schema: 'ez_life' }` y `MainFlow.tsx` llama a `enroll_self()` explícitamente al resolver la sesión.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos, interfaces, esquema local y remoto que TODA historia de usuario necesita.

**⚠️ CRITICAL**: Ninguna historia empieza hasta que esta fase esté completa.

- [ ] T003 Extender `src/core/domain/models/types.ts` con las 9 entidades nuevas de `data-model.md` (`Debt`, `SharedSpace`, `SharedInvite`, `Membership`, `SharedMovement`, `Habit`, `HabitCompletion`, `Goal`, `Task`) y los campos de extensión de `Movement` (`shared_movement_id?`, `is_linked`) y `Notification` (5 valores nuevos de `type`: `loan_due_soon`, `shared_movement_added`, `habit_reminder`, `task_due`, `streak_at_risk`).
  **Parcial**: agregado `Debt` completo + el valor `loan_due_soon` de `Notification` (lo que necesita US1). Las otras 8 entidades y los 4 tipos de notificación restantes quedan para cuando se implemente su historia — evita código muerto/especulativo (no se agregan tipos que ninguna historia usa todavía).
- [ ] T004 Extender `src/core/domain/repositories/IRepositories.ts` con las 8 interfaces nuevas de `contracts/repositories.md` (`IDebtRepository`, `ISharedSpaceRepository`, `ISharedInviteRepository`, `IMembershipRepository`, `ISharedMovementRepository`, `IHabitRepository`, `IGoalRepository`, `ITaskRepository`).
  **Parcial**: solo `IDebtRepository` (con `save` en vez de `create`, alineado a la convención real de upsert que ya usan todos los repositorios existentes — desviación intencional de `contracts/repositories.md`). El resto se agrega por historia.
- [ ] T005 Subir la versión del esquema Dexie en `src/infrastructure/db/db.ts` (de 5 a 6) agregando las tablas `debts`, `shared_spaces`, `shared_invites`, `memberships`, `shared_movements`, `habits`, `habit_completions`, `goals`, `tasks` con sus índices por `user_id`/`shared_space_id` según corresponda, y sumarlas al array `tablesToSync` de `setupHooks()`.
  **Parcial**: versión 6 creada con solo la tabla `debts` (`id, user_id, due_date`). Las demás tablas se agregan en versiones Dexie posteriores, por historia.
- [X] T006 Escribir la migración SQL en `supabase/migrations/` que crea las tablas Postgres equivalentes a T005 con RLS deny-by-default, y políticas de acceso a las tablas de espacio compartido basadas en un join contra `memberships` (nunca auto-inserción — Principio IX).
  ✅ La parte de `debts` está en `20260917190159_add_debts.sql`, pusheada y con RLS verificada (`own rows only`, gateada además por `exists (... profiles ...)`). La parte de espacio compartido (`shared_spaces`/`memberships`/etc.) se escribe cuando se implemente US2/US3, ahora que el schema base ya existe.
- [ ] T007 Escribir en una migración SQL nueva las dos funciones `SECURITY DEFINER` de `contracts/rpc-functions.md` (`redeem_shared_invite(code text)`, `leave_shared_space(space_id uuid)`), incluyendo el archivado automático de `SharedSpace` cuando no queda ningún miembro activo.
  Aplica a US2/US3, todavía no implementadas en esta sesión — ya no está bloqueada por infraestructura.
- [X] T008 Agregar las 9 tablas nuevas a la lista de pull/push de `src/infrastructure/sync/CustomSyncLayer.ts`, siguiendo el patrón ya usado para `savings_goals`/`notifications`. **Parcial, como T005**: solo `debts` agregado por ahora.
- [ ] T009 [P] Crear `src/infrastructure/supabase/realtime.ts` con `subscribeSharedSpaceChanges(spaceId, onChange)`, envolviendo `supabase.channel(...).on('postgres_changes', ...)` sobre la tabla `shared_movements` de ese espacio (`research.md` #1).
  **Diferido a US3**: no tiene ningún uso hasta esa historia; implementarlo ahora sería código muerto.

**Checkpoint**: con esto, cada historia de usuario puede implementarse y testearse de forma independiente.

---

## Phase 3: User Story 1 - Registrar y saldar préstamos personales (Priority: P1) 🎯 MVP

**Goal**: El usuario registra préstamos bidireccionales, con devoluciones parciales, y los liquida sin ensuciar su distribución personal.

**Independent Test**: Registrar un préstamo, una devolución parcial, y marcarlo saldado — verificar que el saldo baja correctamente y que no aparece ningún `Movement` nuevo.

### Tests for User Story 1 ⚠️

> Escribir y verificar que fallan antes de implementar

- [X] T010 [P] [US1] Test unitario de `applyDebtSettlement` en `src/core/use-cases/applyDebtSettlement.test.ts`: acumula devoluciones parciales en `settled_amount_cents` sin superar `amount_cents` (FR-003), pasa `status` a `settled` solo al llegar al total, y el resultado NUNCA incluye un `Movement` (FR-004, Principio X).
- [X] T011 [P] [US1] Test de Testing Library en `src/presentation/components/DebtForm.test.tsx`: registrar un préstamo en ambas direcciones (`lent`/`borrowed`, FR-001) con fecha de vencimiento e interés opcionales (FR-002) invoca `IDebtRepository.create` con los datos correctos.

### Implementation for User Story 1

- [X] T012 [P] [US1] Implementar `LocalDebtRepository` en `src/infrastructure/repositories/local/LocalDebtRepository.ts` (`getAll`, `getById`, `create`, `recordSettlement`, `delete` — contracts/repositories.md).
- [X] T013 [US1] Implementar `applyDebtSettlement` en `src/core/use-cases/applyDebtSettlement.ts` (depende de T010 en rojo).
- [X] T014 [US1] Agregar la rama `loan_due_soon` a `evaluateNotifications` en `src/core/use-cases/evaluateNotifications.ts` (FR-005).
- [X] T015 [US1] Construir `DebtForm.tsx` y `DebtList.tsx` en `src/presentation/components/` — alta, ver saldo pendiente, registrar devolución parcial, marcar saldado (FR-001 a FR-004).
- [X] T016 [US1] Conectar la pantalla de préstamos a `MainFlow.tsx` (`currentRoute`) y a `BottomNav.tsx`.

**Checkpoint**: ✅ User Story 1 funcional y testeable de forma independiente — 102/102 tests, lint limpio, build de producción exitoso. Persistencia local (Dexie) plena; la sincronización remota a Supabase queda pendiente de que se resuelva el bloqueo de T002 (`ez_life` no existe como schema todavía), pero no es requisito para que la historia funcione y se pruebe offline-first.

---

## Phase 4: User Story 2 - Crear un espacio financiero compartido y unirse a él (Priority: P1)

**Goal**: Un usuario crea un espacio e invita; otro usuario solo entra canjeando una invitación válida, nunca por estar autenticado.

**Independent Test**: Crear un espacio, generar invitación, canjearla con un segundo usuario, y confirmar que un tercer usuario autenticado sin invitación no puede acceder.

### Tests for User Story 2 ⚠️

- [X] T017 [P] [US2] Test unitario en `src/infrastructure/supabase/redeemSharedInvite.test.ts`: el wrapper del cliente llama únicamente a la RPC `redeem_shared_invite` (mockeada) y jamás hace un `insert` directo contra `memberships` (Principio IX).
  Ubicado en `LocalSharedSpaceRepository.test.ts` junto con los otros dos repos del bloque (mismo patrón de mock, un solo archivo de test para los tres — más simple que tres archivos casi idénticos).
- [X] T018 [P] [US2] Test de Testing Library en `src/presentation/components/SharedSpaceCreate.test.tsx`: crear un espacio genera y muestra un código de invitación.
- [X] T019 [P] [US2] Test de Testing Library en `src/presentation/components/SharedSpaceJoin.test.tsx`: canjear un código válido asigna membresía; un código vencido o ya usado se rechaza con un mensaje claro, sin crear membresía (edge case de spec.md). El caso de "tercer miembro sin límite" (FR-008) se verifica estructuralmente (no existe ningún cap en el schema/RPC), no como test de componente — documentado inline en el archivo.

### Implementation for User Story 2

- [X] T020 [P] [US2] Implementar `LocalSharedSpaceRepository` en `.../LocalSharedSpaceRepository.ts` (`getAllForUser`, `create`, `setPermissionMode`). `archiveIfEmpty` no es un método de repositorio — el archivado ocurre server-side dentro de la RPC `leave_shared_space` (más simple, atómico, sin ventana de carrera).
- [X] T021 [P] [US2] Implementar `LocalSharedInviteRepository` (`create`, `redeem`), llamando a las RPCs `create_shared_invite`/`redeem_shared_invite` de T007 (depende de T017 en rojo).
- [X] T022 [P] [US2] Implementar `LocalMembershipRepository` en `.../LocalMembershipRepository.ts` (`getMembers` solo `left_at IS NULL`; `leave` llama a la RPC `leave_shared_space`).
- [X] T023 [US2] Construir `SharedSpaceCreate.tsx` y `SharedSpaceJoin.tsx` en `src/presentation/components/`.
- [X] T024 [US2] Conectar el onboarding puntual de espacio compartido (`SharedSpaceScreen.tsx`, nuevo) a `MainFlow.tsx`/`BottomNav.tsx`, separado del wizard principal (FR-024).

**Checkpoint**: ✅ User Stories 1 y 2 funcionan de forma independiente — 111/111 tests, lint limpio, build exitoso. Infraestructura remota (`ez_life` schema, RLS, 5 funciones RPC) desplegada y verificada contra `mvp-lab` — ver nota de T002. `create_shared_space` se agregó como cuarta RPC, no prevista originalmente en `contracts/rpc-functions.md` (evita que "crear espacio" necesite un insert directo de membership).

---

## Phase 5: User Story 3 - Registrar gastos/ingresos compartidos y ver quién le debe a quién (Priority: P1)

**Goal**: Split de gastos compartidos con cálculo automático de saldo, movimiento personal enlazado, y actualización casi instantánea entre miembros conectados.

**Independent Test**: Registrar un gasto compartido con aporte desigual y verificar que el saldo entre miembros se calcula solo, sin cuentas manuales.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] Test unitario de `calculateSharedBalance` en `src/core/use-cases/calculateSharedBalance.test.ts`: saldo correcto con aportes desiguales, el resto de redondeo por porcentaje se asigna al `created_by` del movimiento (Clarifications), y el saldo se recalcula tras eliminar un `SharedMovement` (edge case).
- [X] T026 [P] [US3] Test unitario de `createSharedMovement` en `src/core/use-cases/createSharedMovement.test.ts`: rechaza un split cuya suma no sea igual a `total_amount_cents` (edge case). **Ajuste real de diseño**: `createSharedMovement` terminó siendo solo el cálculo/validación de splits (no genera `Movement`s) — ver nota de T029.
- [X] T027 [P] [US3] Test de Testing Library en `src/presentation/components/SharedMovementForm.test.tsx`: split por porcentaje y por monto fijo, con error visible cuando la suma no cuadra.
- [X] T027a [P] [US3] Test unitario de `guardMovementEdit` en `src/core/use-cases/guardMovementEdit.test.ts`: rechaza editar/borrar un `Movement` con `is_linked=true` fuera de su `SharedMovement` de origen (FR-011); en un `SharedMovement`, rechaza editar/borrar uno ajeno cuando `permission_mode='strict'` y lo permite cuando `permission_mode='open'` (FR-015).
- [X] T027b [P] [US3] Test de integración en `src/core/use-cases/calculateCategoryBreakdown.sharedMovement.test.ts` (el archivo real relevante — `calculateBudgets.ts` no toma movimientos, la suma por bucket vive en `calculateSpentByBucket`). **Hallazgo real documentado, no resuelto del todo**: el movimiento enlazado del creador SÍ puede categorizarse (cuenta en su bucket); el de un miembro que NO creó el gasto queda sin `distribution_category_id` porque el creador no tiene acceso a las categorías privadas del otro miembro (RLS correcta). Ese movimiento sí cuenta en el total de ingresos/egresos del miembro, pero no en un bucket específico — limitación conocida, no un bug silencioso.

### Implementation for User Story 3

- [X] T028 [P] [US3] Implementar `calculateSharedBalance.ts` en `src/core/use-cases/` — saldo derivado on-demand, nunca persistido (`research.md` #3).
- [X] T029 [US3] Implementar `createSharedMovement.ts` en `src/core/use-cases/`. **Ajuste real de diseño**: solo calcula/valida los `splits` finales (con redondeo); NO genera los `Movement` enlazados — esos los crea `create_shared_movement` (RPC nueva, ver T007), porque escribir un `Movement` para OTRO miembro nunca puede ser un insert directo del cliente bajo "own rows only" RLS (Principio IX). El diseño original asumía inserción directa; se corrigió al toparse con esa restricción real de RLS.
- [X] T030 [P] [US3] Implementar `LocalSharedMovementRepository` en `.../LocalSharedMovementRepository.ts` (`getAllForSpace`, `create`, `delete` — ambas mutaciones vía RPC, no directas). `update` no se implementó — no hay ningún escenario de aceptación de la spec que lo ejercite; queda como follow-up si se necesita editar (no solo crear/borrar) un gasto compartido.
- [X] T031 [US3] Implementar `guardMovementEdit.ts` en `src/core/use-cases/` — función pura (`canEditLinkedMovement`, `canEditSharedMovement`) que decide si un `Movement`/`SharedMovement` puede editarse o borrarse; la decisión vive acá (Principio III). La aplicación real de la regla está en las políticas RLS del lado servidor (ver migración T007) y en la RPC `delete_shared_movement`; el use-case es la fuente de verdad que la UI consulta para habilitar/deshabilitar botones.
- [X] T032 [US3] Implementar `useSharedSpaceRealtime` en `src/presentation/hooks/useSharedSpaceRealtime.ts`, usando `subscribeSharedSpaceChanges` (T009, implementado ahora — ya no diferido) para disparar `CustomSyncLayer.sync()` al detectar un cambio (SC-003, <10s con ambos online).
- [X] T033 [US3] Agregar la rama `shared_movement_added` a `evaluateNotifications.ts` (FR-014).
- [X] T034 [US3] Construir `SharedMovementForm.tsx` y `SharedSpaceBalances.tsx` (vista de "quién le debe a quién") en `src/presentation/components/`.
- [X] T035 [US3] Construir el toggle de modo de permisos (FR-015) y la acción "abandonar espacio" (FR-016, deuda congelada visible) en `src/presentation/components/SharedSpaceSettings.tsx`.

**Checkpoint**: ✅ Las tres historias P1 (préstamos, crear/unirse, gastos compartidos) funcionan de forma independiente — 134/134 tests, lint limpio, build exitoso. Infraestructura remota: schema `ez_life` completo, 7 funciones RPC (`enroll_self`, `create_shared_space`, `create_shared_invite`, `redeem_shared_invite`, `leave_shared_space`, `create_shared_movement`, `delete_shared_movement`), Realtime habilitado en `shared_movements`, desplegado y verificado contra `mvp-lab` — audit del fleet en cero para `ez_life` en las tres corridas.

---

## Phase 6: User Story 4 - Crear y sostener hábitos con racha y comodines (Priority: P2)

**Goal**: Hábitos con dos modos de horario, racha, y comodines que perdonan sin romper la motivación.

**Independent Test**: Crear un hábito, cumplirlo varios días, fallar uno, y verificar que un comodín ganado evita que la racha se rompa.

### Tests for User Story 4 ⚠️

- [X] T036 [P] [US4] Test unitario de `evaluateHabitStreak` (modo días fijos) en `src/core/use-cases/evaluateHabitStreak.test.ts`: racha = días programados consecutivos cumplidos; 1 comodín cada 7 días consecutivos, tope 3 (FR-019); un comodín evita que un día sin cumplir rompa la racha.
- [X] T037 [P] [US4] Test unitario de `evaluateHabitStreak` (modo frecuencia libre) en el mismo archivo: racha = semanas consecutivas donde se alcanzó el objetivo; 1 comodín cada 7 cumplimientos individuales acumulados, tope 3 (FR-019a); un comodín canjeado en una semana con un cumplimiento faltante hace que esa semana cuente igual para la racha. **Bug real encontrado y corregido en el camino**: el helper `buildFixedDaysLog` comparaba fechas con métodos de hora local sobre un `Date` parseado de un string ISO (UTC) — corría el día para cualquier huso horario negativo. Se reescribió usando UTC de punta a punta.
- [X] T038 [P] [US4] Test de Testing Library en `src/presentation/components/HabitForm.test.tsx`: alternar entre modo días fijos (mínimo 1 día seleccionado) y frecuencia libre (`frequency_target >= 1`); rechaza guardar sin al menos una condición válida (edge case).

### Implementation for User Story 4

- [X] T039 [US4] Implementar `evaluateHabitStreak.ts` en `src/core/use-cases/` — dos ramas por `schedule_mode` (`evaluateFixedDaysStreak`, `evaluateFrequencyStreak`) más `buildFixedDaysLog` (puente fecha real → log abstracto).
- [X] T040 [P] [US4] Implementar `LocalHabitRepository` en `.../LocalHabitRepository.ts` — `recordCompletion` solo apila en el log (`HabitCompletion`); la racha/comodines se derivan on-demand con `evaluateHabitStreak`, nunca se acumulan en el repositorio (Principio III, mismo patrón que `calculateSharedBalance`).
- [X] T041 [US4] Agregar las ramas `habit_reminder` y `streak_at_risk` a `evaluateNotifications.ts` (FR-022) — solo para hábitos de días fijos programados hoy; los de frecuencia libre no tienen un "día debido" natural, quedan fuera de este recordatorio puntual.
- [X] T042 [US4] Construir `HabitForm.tsx` y `HabitList.tsx` (marcar cumplido, indicador de comodines) en `src/presentation/components/`.

**Checkpoint**: ✅ Hábitos funcionan de forma independiente del resto — 151/151 tests, lint limpio, build exitoso. Schema `ez_life.habits`/`ez_life.habit_completions` desplegado (RLS simple, sin RPC — son datos mono-usuario).

---

## Phase 7: User Story 5 - Definir metas y tareas puntuales (Priority: P2)

**Goal**: Metas numéricas/checklist y tareas puntuales, sin relación obligatoria con dinero.

**Independent Test**: Crear una meta numérica y avanzarla hasta completarla; crear una tarea y marcarla hecha.

### Tests for User Story 5 ⚠️

- [X] T043 [P] [US5] Test unitario de `evaluateGoalCompletion` en `src/core/use-cases/evaluateGoalCompletion.test.ts`: tipo `numeric` completa cuando `current_value >= target_value`; tipo `checklist` completa cuando todos los `milestones[].done` son verdaderos (FR-020).
- [X] T044 [P] [US5] Test de Testing Library en `src/presentation/components/GoalForm.test.tsx`: alternar tipo numérico/checklist.
- [X] T045 [P] [US5] Test de Testing Library en `src/presentation/components/TaskForm.test.tsx`: crear tarea con fecha límite; marcarla hecha la archiva y la saca de "pendientes" (FR-021).

### Implementation for User Story 5

- [X] T046 [US5] Implementar `evaluateGoalCompletion.ts` en `src/core/use-cases/`.
- [X] T047 [P] [US5] Implementar `LocalGoalRepository` en `.../LocalGoalRepository.ts`.
- [X] T048 [P] [US5] Implementar `LocalTaskRepository` en `.../LocalTaskRepository.ts` (`markDone` set `status='done'`; `getAll` filtra `pending` por defecto).
- [X] T049 [US5] Agregar la rama `task_due` a `evaluateNotifications.ts` (FR-022) — y de paso `goal_completed` para la `Goal` genérica, reusando el tipo de notificación ya existente (mismo evento semántico "completaste X").
- [X] T050 [P] [US5] Construir `GoalForm.tsx` y `GoalList.tsx` en `src/presentation/components/`.
- [X] T051 [P] [US5] Construir `TaskForm.tsx` y `TaskList.tsx` en `src/presentation/components/` — ruta nueva "Objetivos" en el nav (la ruta "Metas" ya la usa `SavingsGoal`, la financiera).

**Checkpoint**: ✅ Metas y tareas funcionan de forma independiente — 164/164 tests, lint limpio, build exitoso. Schema `ez_life.goals`/`ez_life.tasks` desplegado (RLS simple, sin RPC).

---

## Phase 8: User Story 6 - Recibir recordatorios de todo lo anterior (Priority: P2)

**Goal**: Confirmar que los 5 tipos de notificación nuevos (agregados incrementalmente en las fases 3-7) salen todos por el mismo pipeline — sin sistema paralelo — y son visibles/accionables.

**Independent Test**: Disparar cada condición (préstamo por vencer, racha en riesgo, tarea por vencer, actividad compartida) y verificar que aparecen en el mismo centro de notificaciones existente.

### Tests for User Story 6 ⚠️

- [X] T052 [US6] Extender `src/presentation/hooks/useNotificationEvaluator.test.tsx` para cubrir los tipos nuevos disparando a través del mismo evaluador existente, con el hook real (no solo la función pura, ya cubierta unitariamente por cada historia) — confirma `loan_due_soon` y `task_due` de punta a punta contra Dexie real; los otros 3 ya tienen su propia prueba unitaria exhaustiva en `evaluateNotifications.test.ts` (Principio XI, FR-022).

### Implementation for User Story 6

- [X] T053 [US6] Extender `NotificationHistory.tsx` con un ícono por tipo (8 tipos, mapa `NOTIFICATION_ICONS`) — el copy en español ya lo generaba cada rama de `evaluateNotifications` desde que se agregó, esto solo completa la parte visual.

**Checkpoint**: ✅ 165/165 tests, lint limpio, build exitoso. Confirmado: los 8 tipos de notificación pasan por un único pipeline (`evaluateNotifications` + `useNotificationEvaluator`), sin sistema paralelo.

---

## Phase 9: User Story 7 - Configurar la app con el wizard y ver el progreso en los dashboards (Priority: P3)

**Goal**: Wizard de arranque solo financiero personal, y dos dashboards separados.

**Independent Test**: Completar el wizard con la plantilla precargada, y navegar cada dashboard por separado.

### Tests for User Story 7 ⚠️

- [X] T054 [P] [US7] Extender `src/presentation/components/OnboardingStep1.test.tsx`: la plantilla 50/30/20 trae categorías de ejemplo precargadas en los tres buckets, editables/borrables (FR-023).
  **Ubicación real corregida**: la lógica vive en `Step3Categories` dentro de `OnboardingWizard.tsx`, no en `OnboardingStep1.tsx`. Se creó `OnboardingWizard.test.tsx` (no existía ningún test para esa lógica). **Bug real encontrado y corregido**: `DEFAULT_CATEGORIES` solo precargaba 2 de los 3 buckets — el de ahorro quedaba vacío, violando FR-023 tal como está escrito.
- [X] T055 [P] [US7] Extender `src/presentation/components/Dashboard.test.tsx` (no existía): distribución vs. real, ingresos/egresos, deudas activas (FR-025).
- [X] T056 [P] [US7] Test de Testing Library en `src/presentation/components/HabitsDashboard.test.tsx`: racha, metas activas, tareas próximas (FR-026, SC-006).

### Implementation for User Story 7

- [X] T057 [US7] Corregido `OnboardingWizard.tsx` (`pickSeedBuckets`/`DEFAULT_CATEGORIES`) para precargar categorías en los tres buckets (FR-023); sin pasos de espacio compartido ni hábitos en el wizard (FR-024, ya era así).
- [X] T058 [P] [US7] Implementar `calculateHabitCompletionRate.ts` en `src/core/use-cases/` — % de cumplimiento en ventana móvil de 30 días, dos ramas por `schedule_mode`, reusando `buildFixedDaysLog`.
- [X] T059 [P] [US7] Extender el `Dashboard.tsx` existente con la sección de deudas activas (FR-025) — Principio VII, sin componente paralelo.
- [X] T060 [P] [US7] Construir `HabitsDashboard.tsx` — hábitos (racha + % ventana móvil), metas activas, tareas próximas, usando `calculateHabitCompletionRate` (T058).
- [X] T061 [US7] `HabitsDashboard` conectado dentro de la ruta "Hábitos" existente (arriba de `HabitList`) en vez de sumar una décima entrada al nav — el dashboard financiero ya vivía en la ruta "Resumen".

**Checkpoint**: ✅ Las 7 historias de usuario funcionan de forma independiente — 173/173 tests, lint limpio, build exitoso. Sin migración nueva para US7 (solo UI + use-cases locales sobre schema ya desplegado).

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T062 [P] Ejecutar manualmente `quickstart.md` contra la app real (dev server + navegador con Chrome DevTools MCP), no solo mentalmente. **Dos bugs de producción reales encontrados y corregidos acá** (invisibles para los 174 tests unitarios, porque ninguno ejecuta contra Postgres real):
  1. **Recursión infinita de RLS**: las políticas de `shared_spaces`/`memberships`/`shared_invites`/`shared_movements` consultaban `memberships` dentro de sí mismas → error 500 de Postgres ("infinite recursion detected in policy"). Corregido con una función `SECURITY DEFINER` (`ez_life.is_active_member`, patrón estándar de Supabase para este caso exacto) — migración `20260917232810_fix_shared_rls_recursion.sql`.
  2. **`profiles` nunca sincronizaba cambios locales**: el `CustomSyncLayer` genérico hace `upsert` para todas las tablas por igual, pero `upsert` siempre intenta el camino de INSERT — y `profiles` deliberadamente no tiene policy de INSERT (Principio IX). Cualquier cambio de preferencias (`notification_hour`, etc.) fallaba con 403 para siempre. Corregido en `CustomSyncLayer.ts`: `profiles` usa `update` en vez de `upsert` — no se tocó RLS (agregar INSERT ahí habría reabierto el hueco que Principio IX prohíbe).
  Sin credenciales OAuth reales disponibles para este agente, no se pudo ejercitar de punta a punta el login real ni las rutas nuevas (préstamos/espacio/hábitos/objetivos) como usuario autenticado — verificado sí: la app carga sin errores de consola, el wizard completo (incluido el fix de FR-023 con captura de pantalla confirmando categorías en los 3 buckets), y ambos bugs de sync ya no aparecen tras el fix.
- [X] T063 [P] Revisado — `contracts/repositories.md` quedó desalineado del código real en varios puntos (documentado en las notas de US1-US5 de este archivo): `save` en vez de `create`, creación/borrado vía RPC en vez de insert directo para los repos de espacio compartido, sin método `update` en `ISharedMovementRepository`. No se reescribió el archivo completo — las notas por historia en este `tasks.md` son la fuente de verdad de las desviaciones reales.
- [X] T064 Re-verificada la tabla de `Constitution Check` de `plan.md` contra el código real: ninguna liquidación crea `Movement` (T010/T013), ninguna membresía se crea sin pasar por una RPC (T007, `create_shared_space`/`create_shared_invite`/`redeem_shared_invite`/`leave_shared_space`/`create_shared_movement`/`delete_shared_movement`), un solo pipeline de notificaciones (8 tipos, un evaluador), sin dependencias npm nuevas agregadas. Las 13 verificado sin excepción.
- [X] T065 [P] Audit del fleet (`fleet-auth-audit.sql`) corrido 4 veces durante la sesión (después de cada migración grande) y una vez más al cierre — siempre 0 `FAIL` para `ez_life`/`ez_life_private`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias.
- **User Stories (Phase 3-9)**: todas dependen de Foundational. US1 y US2 no dependen entre sí. US3 asume que ya existe un `SharedSpace` con membresía (de US2) para su prueba independiente, pero su lógica de cálculo (`calculateSharedBalance`, `createSharedMovement`) es autónoma y testeable con datos de fixture sin pasar por la UI de US2. US4 y US5 son independientes entre sí y del resto. US6 depende de que US1/US3/US4/US5 ya hayan agregado sus ramas de notificación (T014, T033, T041, T049). US7 tiene más valor con datos de US1-US5 ya existentes, pero el wizard en sí (FR-023) solo toca lo que ya existía antes de esta feature.
- **Polish (Phase 10)**: depende de las historias que se quieran entregar.

### Parallel Opportunities

- T001/T002 en paralelo.
- Dentro de Foundational: T009 en paralelo con T003-T008 (archivo distinto, sin dependencia).
- Dentro de cada historia, todas las tareas de test marcadas [P] corren juntas; los repositorios `Local*Repository` marcados [P] son archivos independientes entre sí.
- US1, US2, US4 y US5 pueden trabajarse en paralelo por distintas personas una vez cerrada la fase Foundational; US3 conviene después de US2; US6 después de US1/US3/US4/US5; US7 al final.

---

## Parallel Example: User Story 3

```bash
# Tests de la User Story 3 juntos:
Task: "Test unitario de calculateSharedBalance en src/core/use-cases/calculateSharedBalance.test.ts"
Task: "Test unitario de createSharedMovement en src/core/use-cases/createSharedMovement.test.ts"
Task: "Test de Testing Library de SharedMovementForm en src/presentation/components/SharedMovementForm.test.tsx"

# Repositorios de la User Story 3 en paralelo:
Task: "Implementar LocalSharedMovementRepository en src/infrastructure/repositories/local/LocalSharedMovementRepository.ts"
```

---

## Implementation Strategy

### MVP primero (User Story 1)

1. Completar Setup + Foundational.
2. Completar User Story 1 (préstamos) — es la más simple y autónoma.
3. Parar y validar con `quickstart.md` § 1.
4. Recién ahí seguir con US2 → US3 (el bloque real de "finanzas familiares").

### Entrega incremental

1. Setup + Foundational → base lista.
2. US1 → validar → (opcional) demo.
3. US2 → US3 → validar el bloque completo de espacio compartido → demo.
4. US4 → US5 → validar hábitos/metas/tareas → demo.
5. US6 → validar que las notificaciones de todo lo anterior salen por un solo sistema.
6. US7 → wizard + dashboards, el "envoltorio" final sobre todo lo demás.

Aunque la decisión de producto fue "todo en un solo MVP, sin fases" (spec.md), esta secuencia de
entrega interna sigue existiendo para poder validar cada pieza de forma aislada antes de sumar la
siguiente — no implica lanzar nada a producción de forma parcial.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Escribir los tests de cada historia y confirmar que fallan antes de implementar (TDD estricto).
- Commitear por tarea o por grupo lógico pequeño.
- Ningún caso de uso nuevo debe vivir dentro de un componente de `presentation/` (Principio III).

---

## Phase 11: Convergence

- [X] T066 [CRITICAL] Corregir que un miembro que abandona un espacio compartido pierde todo acceso (local y remoto) a ese espacio: las políticas RLS `active members can read...` de `ez_life.shared_spaces`/`ez_life.memberships`/`ez_life.shared_movements` exigen `left_at is null`, y `LocalSharedSpaceRepository.getAllForUser`/`LocalMembershipRepository.getMembers` filtran igual — así, tras `leave_shared_space`, el saldo/deuda congelada deja de ser visible para el ex-miembro, contradiciendo el requisito explícito de que quede "visible para ambas partes en su historial". Ajustar las políticas de lectura para admitir también a ex-miembros de ese espacio (sin habilitar ninguna mutación nueva) y exponer esa vista en la UI (`SharedSpaceScreen`/`SharedSpaceSettings` o una sección equivalente de espacios abandonados) per US3/AC6, FR-016 (contradicts)
  ✅ Migración `supabase/migrations/20260917235000_allow_former_members_read_frozen_balance.sql` (función `ez_life.is_or_was_member`, relaja SELECT en `shared_spaces`/`shared_movements` a cualquier ex-miembro; `memberships`/`shared_invites` quedan igual, solo activos). `ISharedSpaceRepository.getLeftForUser` + `LocalSharedSpaceRepository.getLeftForUser` (excluye espacios donde ya hay membresía activa, por si el usuario se reincorporó). `SharedSpaceScreen.tsx` ahora muestra una sección "Espacios que abandonaste" de solo lectura (sin `SharedSpaceSettings`). Tests nuevos en `LocalSharedSpaceRepository.test.ts` (2) y `SharedSpaceScreen.test.tsx` (nuevo archivo, 2 tests). `supabase db push` corrido y verificado contra `mvp-lab` tras reautenticar el CLI: políticas `current or former members can read...` confirmadas en `pg_policies`, `active members can update permission_mode` intacta.
- [X] T067 [HIGH] Permitir que quien crea un gasto/ingreso compartido asigne una `distribution_category_id` de sus propias categorías a su propio movimiento personal enlazado: hoy `create_shared_movement` no setea esa columna para ningún miembro (ni el creador), por lo que `calculateSpentByBucket` excluye todo movimiento compartido del desglose "Presupuestado vs. real" (`Dashboard.tsx`) y de la alerta `budget_over_80` por bucket, aunque sí cuenta en los totales de ingresos/egresos. Propagar una categoría opcional del creador a través de `CreateSharedMovementParams`/`create_shared_movement` para su propio split (el de otros miembros permanece fuera de alcance por RLS, ya documentado) per FR-012 (partial)
  ✅ Migración `supabase/migrations/20260917235500_shared_movement_creator_category.sql` (recrea `create_shared_movement` con `p_creator_distribution_category_id uuid default null`, validado server-side contra `distribution_categories.user_id` antes de aplicarlo — defensa en profundidad). `CreateSharedMovementParams.creatorDistributionCategoryId` + `LocalSharedMovementRepository.create` lo propaga. `SharedMovementForm.tsx` agrega un selector "Tu categoría (50/30/20, opcional)" visible solo para gastos, precargado con la primera categoría del creador. Tests nuevos en `SharedMovementForm.test.tsx` (2). `supabase db push` corrido y verificado: `create_shared_movement` quedó con 7 argumentos en `pg_proc` (sin la versión vieja de 6 duplicada — el `drop function` previo limpió bien).
  Verificación completa: 180/180 tests (antes 173), `pnpm lint` limpio, `pnpm build` exitoso, `supabase db push` aplicado contra `mvp-lab` y `fleet-auth-audit.sql` en 0 `FAIL` para `ez_life`.
