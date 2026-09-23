---

description: "Task list template for feature implementation"
---

# Tasks: UX de Creación y Tareas Recurrentes

**Input**: Design documents from `/specs/005-habitos-tareas-metas-ux/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: incluidos (Strict TDD Mode + Principio IV).

## Format: `[ID] [P?] [Story] Description`

US1 = Tareas recurrentes (P1), US2 = UI de creación más detallada (P2), US3 = Renombrar sidebar (P3)

## Phase 1: Setup

No aplica.

## Phase 2: Foundational

No aplica — las tres historias son independientes entre sí (US2 y US3 no dependen de la
recurrencia de US1).

---

## Phase 3: User Story 1 - Tareas recurrentes (Priority: P1) 🎯 MVP

**Goal**: una tarea marcada como recurrente genera automáticamente su próxima ocurrencia según el
calendario, sin racha ni tokens, cancelable y editable hacia adelante.

**Independent Test**: crear una tarea recurrente, verificar que se genera la siguiente ocurrencia
en su fecha, que cancelar detiene la generación, y que ninguna ocurrencia acumula racha.

### Tests for User Story 1

- [x] T001 [P] [US1] Crear `src/core/use-cases/evaluateTaskRecurrence.test.ts`: primera generación para `fixed_days`; primera generación para `frequency`; no duplica si la ocurrencia del período ya existe; `recurrence_active: false` no genera nada; el patrón editado en la ocurrencia más reciente afecta solo generación futura.
- [x] T002 [P] [US1] Crear `src/presentation/hooks/useTaskRecurrenceEvaluator.test.tsx`: al montar, invoca `evaluateTaskRecurrence` y persiste las ocurrencias nuevas vía el repositorio.
- [x] T003 [P] [US1] Extender `src/presentation/components/TaskForm.test.tsx`: los controles de recurrencia (días fijos / frecuencia) crean una `Task` con `schedule_mode` y `recurrence_series_id` seteados.
- [x] T004 [P] [US1] Extender `src/presentation/components/TaskList.test.tsx`: la acción "cancelar recurrencia" setea `recurrence_active: false`; ninguna tarea recurrente muestra ni acumula racha/tokens.

### Implementation for User Story 1

- [x] T005 [US1] En `src/core/domain/models/types.ts`, agregar a `Task`: `schedule_mode?`, `fixed_days?`, `frequency_target?`, `recurrence_series_id?`, `recurrence_active?` (data-model.md).
- [x] T006 [US1] En `src/infrastructure/db/db.ts`, dar de alta esos campos en el schema Dexie (bump de versión). Depende de T005.
- [x] T007 [US1] Crear `src/core/use-cases/evaluateTaskRecurrence.ts` (data-model.md). Depende de T005. Hace pasar T001.
- [x] T008 [US1] Crear `src/presentation/hooks/useTaskRecurrenceEvaluator.ts` (on-mount + periódico, mismo patrón de intervalo que `useNotificationEvaluator`), persistiendo vía `ITaskRepository`; wire en `src/presentation/components/MainFlow.tsx`. Depende de T006, T007. Hace pasar T002.
- [x] T009 [US1] En `src/presentation/components/TaskForm.tsx`, agregar controles de recurrencia (días fijos / frecuencia semanal), generando `recurrence_series_id` en la primera ocurrencia. Depende de T005. Hace pasar T003.
- [x] T010 [US1] En `src/presentation/components/TaskList.tsx`, agregar la acción "cancelar recurrencia" (`recurrence_active: false` en la ocurrencia vigente). Depende de T005. Hace pasar T004.

**Checkpoint**: US1 funciona de forma independiente (quickstart.md §2).

---

## Phase 4: User Story 2 - UI de creación más detallada (Priority: P2)

**Goal**: Hábito gana ícono opcional; Tarea y Meta ganan descripción opcional.

**Independent Test**: crear un hábito con ícono, una tarea con descripción, una meta con
descripción.

### Tests for User Story 2

- [x] T011 [P] [US2] Extender `src/presentation/components/HabitForm.test.tsx`: campo de ícono opcional se guarda si se completa.
- [x] T012 [P] [US2] Extender `src/presentation/components/TaskForm.test.tsx`: campo de descripción opcional se guarda si se completa.
- [x] T013 [P] [US2] Extender `src/presentation/components/GoalForm.test.tsx`: campo de descripción opcional se guarda si se completa.

### Implementation for User Story 2

- [x] T014 [US2] En `src/core/domain/models/types.ts`, agregar `Task.description?`, `Habit.icon?`, `Goal.description?`.
- [x] T015 [US2] En `src/infrastructure/db/db.ts`, dar de alta esos campos en el schema Dexie (bump de versión). Depende de T014.
- [x] T016 [P] [US2] En `src/presentation/components/HabitForm.tsx`, agregar input opcional de ícono/emoji. Depende de T014. Hace pasar T011.
- [x] T017 [P] [US2] En `src/presentation/components/TaskForm.tsx`, agregar input opcional de descripción (junto a los controles de recurrencia de T009). Depende de T014. Hace pasar T012.
- [x] T018 [P] [US2] En `src/presentation/components/GoalForm.tsx`, agregar input opcional de descripción. Depende de T014. Hace pasar T013.

**Checkpoint**: US2 funciona de forma independiente (quickstart.md §3).

---

## Phase 5: User Story 3 - Renombrar "Metas" a "Metas de Ahorro" (Priority: P3)

**Goal**: el ítem de navegación que lista `SavingsGoal` dice "Metas de Ahorro".

### Tests for User Story 3

- [x] T019 [P] [US3] Test (crear si no existe `BottomNav.test.tsx`) verificando que el ítem `id: 'goals'` tiene `label: 'Metas de Ahorro'`.

### Implementation for User Story 3

- [x] T020 [US3] En `src/presentation/components/BottomNav.tsx:29`, cambiar `label: 'Metas'` a `label: 'Metas de Ahorro'`. Hace pasar T019.

**Checkpoint**: US3 funciona de forma independiente (quickstart.md §4).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T021 [P] Correr `pnpm lint`.
- [x] T022 Correr `pnpm test` completo, cero regresiones.
- [ ] T023 Ejecutar manualmente `specs/005-habitos-tareas-metas-ux/quickstart.md`. (No ejecutado: requiere una sesión de navegador real con login OAuth y avanzar el reloj del sistema para ver la generación de la próxima ocurrencia — el agente solo validó por revisión de código/tests automatizados equivalentes en `evaluateTaskRecurrence.test.ts`/`useTaskRecurrenceEvaluator.test.tsx`. Queda pendiente la validación manual real.)

---

## Dependencies & Execution Order

- US1, US2, US3 son independientes entre sí — se sugiere el orden P1 → P2 → P3 ya reflejado.
- Dentro de US1: T005/T006 bloquean T007-T010.
- Dentro de US2: T014/T015 bloquean T016-T018. T017 toca el mismo archivo que T009 (`TaskForm.tsx`)
  — hacerlo después de T009, no en paralelo con él.

## Implementation Strategy

### MVP First

1. Phase 3 (US1 — recurrencia): el único comportamiento de negocio nuevo de esta spec.
2. **STOP and VALIDATE**: quickstart.md §2.
3. Continuar con US2, luego US3, luego Polish.
