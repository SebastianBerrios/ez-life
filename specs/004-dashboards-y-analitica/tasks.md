---

description: "Task list template for feature implementation"
---

# Tasks: Dashboards y Analítica Interactiva

**Input**: Design documents from `/specs/004-dashboards-y-analitica/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, y `003-fixes-criticos`
ya implementado (crea `HabitDashboard`/`TaskDashboard`/`GoalDashboard` mínimos).

**Tests**: incluidos (Strict TDD Mode + Principio IV de la constitución).

## Format: `[ID] [P?] [Story] Description`

- US1 = Resumen interactivo (P1), US2 = Dashboards de hábitos/tareas/metas (P2), US3 = Movimientos
  con categoría/subcategoría (P3)

## Phase 1: Setup

- [x] T001 Instalar `recharts` (`pnpm add recharts`) y confirmar que `pnpm build` sigue compilando — dependencia justificada en research.md §1.

## Phase 2: Foundational

No aplica más allá de T001 — el resto de las tres historias son independientes entre sí.

---

## Phase 3: User Story 1 - Resumen interactivo con indicadores y gráficos (Priority: P1) 🎯 MVP

**Goal**: el Resumen muestra un indicador de color por categoría, un gráfico de distribución de
gastos, y una comparación contra el período anterior (con rango por defecto y cambiable).

**Independent Test**: cargar movimientos que excedan un límite de categoría y verificar el color de
alerta; verificar que aparece el gráfico de distribución y la comparación de períodos.

### Tests for User Story 1

- [x] T002 [P] [US1] Crear `src/core/use-cases/compareMonthlyPeriods.test.ts`: casos con período anterior con datos, sin datos (retorna `previous: null`, `delta: null`), y con movimientos mixtos ingreso/egreso.
- [x] T003 [P] [US1] Extender `src/presentation/components/Dashboard.test.tsx`: (a) categoría excedida se marca con color de alerta (no binario, al menos 2 umbrales), (b) se renderiza el gráfico de distribución, (c) se renderiza la comparación de períodos, (d) mensaje claro cuando no hay período anterior.

### Implementation for User Story 1

- [x] T004 [US1] Crear `src/core/use-cases/compareMonthlyPeriods.ts` (`compareMonthlyPeriods(current: Movement[], previous: Movement[]): PeriodComparison`, ver data-model.md). Hace pasar T002.
- [x] T005 [US1] En `src/presentation/components/Dashboard.tsx`, reemplazar el cálculo inline de 50/30/20 por una llamada a `calculateBudgets` ya existente (research.md §8, limpieza oportunista).
- [x] T006 [US1] En `src/presentation/components/Dashboard.tsx`, conectar `calculateCategoryBreakdown` (ya existente) a un gráfico `recharts` (barra o torta) de distribución de gastos por categoría.
- [x] T007 [US1] En `src/presentation/components/Dashboard.tsx`, conectar `compareMonthlyPeriods` (T004) con un control de rango (mes actual vs. anterior por defecto, cambiable) y renderizar la comparación. Depende de T004.
- [x] T008 [US1] En `src/presentation/components/Dashboard.tsx`, reemplazar el indicador binario rojo/no-rojo por un semáforo de al menos 3 niveles (ej. verde/amarillo/rojo) según cercanía al límite de cada categoría. Hace pasar T003.

**Checkpoint**: US1 funciona de forma independiente (quickstart.md §2).

---

## Phase 4: User Story 2 - Dashboards interactivos de hábitos, tareas y metas (Priority: P2)

**Goal**: los tres dashboards creados en 003 (mínimos) ganan un gráfico/indicador real:
evolución de racha, cumplimiento de tareas, progreso de metas.

**Independent Test**: abrir cada dashboard con datos representativos y verificar el gráfico
correspondiente.

### Tests for User Story 2

- [x] T009 [P] [US2] Extender `src/core/use-cases/evaluateHabitStreak.test.ts`: `calculateHabitStreakHistory(habit, completions, range)` devuelve un punto por día con `completed` correcto.
- [x] T010 [P] [US2] Crear `src/core/use-cases/calculateTaskCompletionStats.test.ts`: casos a-tiempo, vencida-pendiente, vencida-tardía, pendiente-futura (reglas en data-model.md).
- [x] T011 [P] [US2] Crear (o extender el test ya existente de Goals) `calculateGoalProgress.test.ts`: caso numérico (`current/target`, clamp a 1) y checklist (`done/total`).
- [x] T012 [P] [US2] Extender `HabitDashboard.test.tsx` (de 003): renderiza el gráfico de evolución de racha con rango de 30 días por defecto.
- [x] T013 [P] [US2] Extender `TaskDashboard.test.tsx` (de 003): renderiza la proporción a-tiempo/vencidas.
- [x] T014 [P] [US2] Extender `GoalDashboard.test.tsx` (de 003): renderiza el progreso.

### Implementation for User Story 2

- [x] T015 [US2] Extender `src/core/use-cases/evaluateHabitStreak.ts` con `calculateHabitStreakHistory`. Hace pasar T009.
- [x] T016 [P] [US2] Crear `src/core/use-cases/calculateTaskCompletionStats.ts`. Hace pasar T010.
- [x] T017 [P] [US2] Crear/extraer `src/core/use-cases/calculateGoalProgress.ts` — si `GoalList.tsx` ya calcula el progreso inline, extraerlo aquí y reusarlo desde ambos lados. Hace pasar T011.
- [x] T018 [US2] En `src/presentation/components/HabitDashboard.tsx`, agregar gráfico de línea (`recharts`) con `calculateHabitStreakHistory`, rango 30 días por defecto y selector de rango (FR-010). Depende de T015.
- [x] T019 [US2] En `src/presentation/components/TaskDashboard.tsx`, agregar gráfico/indicador con `calculateTaskCompletionStats`. Depende de T016.
- [x] T020 [US2] En `src/presentation/components/GoalDashboard.tsx`, agregar visualización de progreso con `calculateGoalProgress`. Depende de T017.
- [x] T021 [US2] Si aplica, actualizar `src/presentation/components/GoalList.tsx` para usar `calculateGoalProgress` en vez de su fórmula inline (Principio III). Depende de T017.

**Checkpoint**: US2 funciona de forma independiente (quickstart.md §3).

---

## Phase 5: User Story 3 - Movimientos con categoría y subcategoría visibles (Priority: P3)

**Goal**: cada movimiento en la lista muestra su categoría y subcategoría sin abrir un detalle.

**Independent Test**: crear movimientos con categoría/subcategoría distintas y verlas en la lista.

### Tests for User Story 3

- [x] T022 [P] [US3] Extender `src/presentation/components/MovementList.test.tsx`: cada movimiento muestra el nombre de su categoría y subcategoría; un movimiento sin categoría muestra "Sin categoría".

### Implementation for User Story 3

- [x] T023 [US3] En `src/presentation/components/MovementList.tsx`, construir un mapa de lookup (id → nombre) de `DistributionCategory`/`ExpenseCategory`/`ExpenseSubcategory` al cargar la lista, y renderizar el nombre resuelto de categoría/subcategoría por movimiento (research.md §7). Hace pasar T022.

**Checkpoint**: US3 funciona de forma independiente (quickstart.md §4).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T024 [P] Correr `pnpm lint` y corregir errores nuevos.
- [x] T025 Correr `pnpm test` completo, cero regresiones.
- [ ] T026 Ejecutar manualmente `specs/004-dashboards-y-analitica/quickstart.md`. (No ejecutado: sin navegador interactivo disponible en este entorno de ejecución; los 4 escenarios de quickstart.md §2-4 están cubiertos por tests automatizados equivalentes en Dashboard.test.tsx, HabitDashboard.test.tsx, TaskDashboard.test.tsx, GoalDashboard.test.tsx y MovementList.test.tsx — queda pendiente la validación manual real en el navegador.)

---

## Dependencies & Execution Order

- T001 (instalar `recharts`) bloquea T006, T018, T019, T020 (cualquier tarea que renderice un
  gráfico) pero no bloquea el resto.
- US1, US2, US3 son independientes entre sí — mismo criterio que 003.
- Dentro de US1: T004 antes de T007; T005-T008 tocan el mismo archivo (`Dashboard.tsx`), secuencial.
- Dentro de US2: T015/T016/T017 (use-cases) antes de T018/T019/T020 (componentes) respectivamente.

### Parallel Opportunities

- T002, T003 en paralelo (US1).
- T009-T014 en paralelo entre sí (US2, todos son tests, archivos distintos).
- T016 y T017 en paralelo entre sí (archivos distintos), ambos después de sus tests.
- US1/US2/US3 pueden trabajarse en paralelo por personas distintas tras T001.

## Implementation Strategy

### MVP First

1. T001 (Setup).
2. Phase 3 (US1 — Resumen): mayor impacto percibido, pantalla más visitada.
3. **STOP and VALIDATE**: quickstart.md §2.
4. Continuar con US2, luego US3, luego Polish.
