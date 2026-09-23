---

description: "Task list template for feature implementation"
---

# Tasks: Fixes Críticos (dropdowns, reactividad, hábitos, préstamos)

**Input**: Design documents from `/specs/003-fixes-criticos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: incluidos. Strict TDD Mode está habilitado para este proyecto (CLAUDE.md global) y la
constitución (Principio IV) exige test unitario para todo caso de uso y test de Testing Library
para todo wiring de UI — cada bloque de tests de abajo se escribe y se corre (debe fallar) antes de
tocar la implementación correspondiente.

**Organization**: una fase por historia de usuario (spec.md), en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivo distinto, sin dependencia pendiente)
- **[Story]**: US1 (préstamos, P1), US2 (reactividad, P1), US3 (hábitos + dashboards básicos, P2), US4 (dropdowns, P2)

## Phase 1: Setup

No aplica — proyecto existente, sin dependencias nuevas (research.md §1-2), sin scaffolding
pendiente.

## Phase 2: Foundational

No aplica — las cuatro historias son independientes entre sí y no comparten infraestructura nueva;
cada una toca su propio subárbol de archivos (ver plan.md §Project Structure).

---

## Phase 3: User Story 1 - Pagos de préstamo se reflejan como gasto real (Priority: P1) 🎯 MVP

**Goal**: un pago de cuota o abono a capital genera un `Movement` real, nunca corrompe
`remaining_installments` fuera de lo ya validado, no se puede duplicar por doble-clic, y las
tablas de préstamo participan del pull de sync.

**Independent Test**: crear un préstamo, pagar una cuota (baja 1 cuota + aparece en Movimientos),
registrar un abono con "Reducir cuota" (cuotas intactas + aparece en Movimientos), doble-clic en
confirmar no duplica el pago.

### Tests for User Story 1 (escribir primero, deben fallar antes de implementar)

- [x] T001 [P] [US1] Extender `src/core/use-cases/recordInstallmentPayment.test.ts`: el resultado devuelto incluye una descripción del `Movement` a crear (monto en centavos, fecha, referencia al pago) — la función sigue sin tocar ninguna DB.
- [x] T002 [P] [US1] Extender `src/core/use-cases/recordPrincipalPayment.test.ts`: el resultado incluye la misma descripción del `Movement` para ambos `adjustment.type` (`reduce_term` y `reduce_installment_amount`).
- [x] T003 [P] [US1] Agregar en `src/infrastructure/repositories/local/LocalInstallmentLoanRepository.test.ts` un test que, tras `recordInstallmentPayment`, verifique que `db.movements` contiene un registro con `installment_payment_id` apuntando al pago, `amount` igual al pagado, y `distribution_category_id` igual al del préstamo.
- [x] T004 [P] [US1] En el mismo archivo, agregar el test equivalente para `recordPrincipalPayment` cubriendo **ambos** `adjustment.type` — este es el gap de cobertura confirmado en research.md §4 (hoy solo existe test para `reduce_term`); debe además re-verificar que `remaining_installments` queda sin cambios para `reduce_installment_amount`.
- [x] T005 [P] [US1] Crear/extender `src/infrastructure/sync/CustomSyncLayer.test.ts`: `installment_loans` e `installment_payments` deben estar incluidos en la lista de tablas que se traen en el pull (hoy faltan, research.md §4).
- [x] T006 [P] [US1] Agregar en `src/presentation/components/InstallmentLoanList.test.tsx` un test que simule una promesa lenta en `recordPrincipalPayment` y verifique que el botón "Confirmar abono" queda `disabled` mientras está en curso.

### Implementation for User Story 1

- [x] T007 [US1] En `src/core/domain/models/types.ts`, agregar `distribution_category_id?: UUID` a `InstallmentLoan` e `installment_payment_id?: UUID` a `Movement` (data-model.md).
- [x] T008 [US1] En `src/infrastructure/db/db.ts`, dar de alta ambos campos en el schema de Dexie (bump de versión; sin backfill de filas existentes, son opcionales) — depende de T007.
- [x] T009 [P] [US1] Extender `src/core/use-cases/recordInstallmentPayment.ts` para devolver además la descripción del `Movement` (monto, fecha) a partir del `distribution_category_id` del préstamo — depende de T007. Hace pasar T001.
- [x] T010 [P] [US1] Extender `src/core/use-cases/recordPrincipalPayment.ts` igual, para ambos `adjustment.type` — depende de T007. Hace pasar T002.
- [x] T011 [US1] Actualizar `src/infrastructure/repositories/local/LocalInstallmentLoanRepository.ts`: en `recordInstallmentPayment` y `recordPrincipalPayment`, persistir el `InstallmentPayment` (bookkeeping) y el nuevo `Movement` en la misma transacción Dexie, seteando `installment_payment_id` y copiando `distribution_category_id` del préstamo — depende de T008, T009, T010. Hace pasar T003, T004.
- [x] T012 [US1] En `src/presentation/components/InstallmentLoanForm.tsx`, agregar selección de `distribution_category_id` al crear un préstamo; si un préstamo existente no lo tiene, pedirlo antes de aceptar un nuevo pago (`InstallmentLoanList.tsx`).
- [x] T013 [P] [US1] En `src/infrastructure/sync/CustomSyncLayer.ts`, agregar `'installment_loans'` e `'installment_payments'` a la lista de tablas del pull (`tablesToSync`). Hace pasar T005.
- [x] T014 [US1] En `src/presentation/components/InstallmentLoanList.tsx`, deshabilitar el botón "Confirmar abono" mientras `handleConfirmPrincipalPayment` está en curso (estado de loading local). Hace pasar T006.
- [x] T015 [US1] En el mismo archivo, separar visualmente la sección "Pagar cuota(s)" de "Registrar abono a capital" (encabezado/divisor) para reducir la confusión entre ambos controles (FR-016).

**Checkpoint**: US1 funciona y se puede probar de forma independiente (quickstart.md §5).

---

## Phase 4: User Story 2 - Los registros nuevos aparecen sin recargar la página (Priority: P1)

**Goal**: crear un movimiento, hábito o tarea lo refleja de inmediato en su vista, sin recarga
manual.

**Independent Test**: crear un ingreso en Movimientos y verlo aparecer sin recargar; crear un
hábito/tarea desde Crear y verlos en Control sin recargar.

### Tests for User Story 2

- [x] T016 [P] [US2] Agregar/extender `src/presentation/components/MovementList.test.tsx`: al cambiar la prop/`key` de refresco, la lista vuelve a pedir los datos (refetch).
- [x] T017 [P] [US2] Agregar test en `src/presentation/components/MainFlow.test.tsx` (o crear uno si no existe): completar el diálogo de nuevo movimiento incrementa el contador de refresco que recibe `MovementList`.
- [x] T018 [P] [US2] Agregar test equivalente para hábitos/tareas: completar la creación en `CreatePage` incrementa el contador de refresco compartido que reciben `HabitList`/`TaskList` dentro de `ControlPage` (aunque estén en rutas distintas). Implementado como tests dedicados en `CreatePage.test.tsx` (invocación de `onHabitSaved`/`onTaskSaved`) y `ControlPage.test.tsx` (remount de `HabitList`/`TaskList` vía `key`) en vez de un montaje completo de `MainFlow` — ver Deviations.

### Implementation for User Story 2

- [x] T019 [US2] En `src/presentation/components/MainFlow.tsx`, agregar estado `movementsRefreshKey`, incrementarlo en el `onComplete` del diálogo de nuevo movimiento, y pasarlo como `key={movementsRefreshKey}` a `MovementList`. Hace pasar T016, T017.
- [x] T020 [US2] En `src/presentation/components/MainFlow.tsx`, elevar (lift) `habitsRefreshKey`/`tasksRefreshKey` como estado compartido entre la ruta `create` y la ruta `control` (mismo patrón que `goalsRefreshKey`, ya usado y probado para `SavingsGoal`).
- [x] T021 [US2] En `src/presentation/components/CreatePage.tsx`, hacer que los callbacks `onComplete` de Hábito y Tarea también incrementen el contador elevado en T020 (además del `refreshKey` local que ya usa CreatePage para su propia vista previa).
- [x] T022 [US2] En `src/presentation/components/MainFlow.tsx`, pasar `key={habitsRefreshKey}`/`key={tasksRefreshKey}` al montar `HabitList`/`TaskList` dentro de `ControlPage`. Hace pasar T018.

**Checkpoint**: US2 funciona de forma independiente (quickstart.md §3).

---

## Phase 5: User Story 3 - Hábitos visibles y con dashboard básico (Priority: P2)

**Goal**: un hábito no programado para hoy sigue visible en Control; hábitos, tareas y metas
tienen una vista de dashboard mínima (lista + estado actual).

**Independent Test**: crear un hábito con `fixed_days` que no incluya hoy y verlo en Control con
una marca de "no corresponde hoy"; abrir cada dashboard y ver el estado actual de cada entidad.

### Tests for User Story 3

- [x] T023 [P] [US3] Actualizar `src/presentation/components/HabitList.test.tsx`: un hábito no programado para "hoy" ya NO debe estar ausente de la lista — debe renderizarse con una marca visual de "no corresponde hoy".
- [x] T024 [P] [US3] Crear `src/presentation/components/HabitDashboard.test.tsx`: dado un hábito con historial de `HabitCompletion`, el dashboard muestra su racha actual.
- [x] T025 [P] [US3] Crear `src/presentation/components/TaskDashboard.test.tsx`: dado tareas pendientes y hechas, el dashboard muestra el estado de cada una.
- [x] T026 [P] [US3] Crear `src/presentation/components/GoalDashboard.test.tsx`: dada una meta con progreso parcial, el dashboard muestra su progreso actual.

### Implementation for User Story 3

- [x] T027 [US3] En `src/presentation/components/HabitList.tsx`, quitar el `return null` para hábitos no programados hoy (`isHabitScheduledToday`) y en su lugar renderizarlos con un badge "No corresponde hoy". Hace pasar T023.
- [x] T028 [P] [US3] Crear `src/presentation/components/HabitDashboard.tsx`: lista de hábitos con su racha actual (reutiliza el cálculo de racha ya existente en `core/use-cases`). Hace pasar T024.
- [x] T029 [P] [US3] Crear `src/presentation/components/TaskDashboard.tsx`: lista de tareas con su estado pendiente/hecha. Hace pasar T025.
- [x] T030 [P] [US3] Crear `src/presentation/components/GoalDashboard.tsx`: lista de metas con su progreso actual. Hace pasar T026.
- [x] T031 [US3] En `src/presentation/components/ControlPage.tsx`, agregar las tres vistas de dashboard (T028-T030) como secciones adicionales junto a las listas existentes — depende de T028, T029, T030.

**Checkpoint**: US3 funciona de forma independiente (quickstart.md §4).

---

## Phase 6: User Story 4 - Los dropdowns no tapan la opción seleccionable (Priority: P2)

**Goal**: ningún `Select` de la app superpone su menú sobre el valor seleccionado o la primera
opción.

**Independent Test**: abrir cualquier `Select` de la app con un valor preseleccionado y verificar
que el menú se despliega debajo del control.

### Tests for User Story 4

- [x] T032 [P] [US4] Agregar test en `src/components/ui/select.test.tsx` (crear si no existe) verificando que `SelectContent` pasa `alignItemWithTrigger={false}` (o el valor correspondiente) al `Positioner` de `@base-ui/react/select` por defecto.

### Implementation for User Story 4

- [x] T033 [US4] En `src/components/ui/select.tsx`, cambiar el default de `alignItemWithTrigger` en `SelectContent` a `false` (ancla el menú debajo del trigger, `side="bottom"`) en vez de superponer el ítem seleccionado. Hace pasar T032. Al ser el componente compartido, corrige las 9 instancias existentes (`MovementForm`, `SharedMovementForm`, `DebtForm`, `InstallmentLoanList`, `SettingsScreen`) sin tocarlas.

**Checkpoint**: US4 funciona de forma independiente (quickstart.md §2).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T034 [P] Correr `pnpm lint` y corregir cualquier error nuevo introducido por esta feature. Resultado: 0 warnings/errores.
- [x] T035 Correr `pnpm test` (suite completa) y confirmar cero regresiones. Resultado: 67 archivos, 310 tests, todos en verde (partía de 61/279).
- [x] T036 Ejecutar manualmente `specs/003-fixes-criticos/quickstart.md` completo (secciones 2-5) antes de cerrar la feature. No ejecutable por este agente (sin navegador/sesión interactiva) — cada escenario manual de quickstart.md está cubierto por un test automatizado equivalente añadido en esta feature (§2→`select.test.tsx`, §3→`MainFlow.test.tsx`/`ControlPage.test.tsx`, §4→`HabitList.test.tsx`, §5→`LocalInstallmentLoanRepository.test.ts` + `InstallmentLoanList.test.tsx`); recomendado que un humano corra la sesión interactiva antes de cerrar definitivamente la feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup y Foundational: no aplican (ver arriba).
- **US1, US2, US3, US4 son independientes entre sí** — no hay orden obligatorio entre ellas, pero
  se sugiere el orden P1 → P1 → P2 → P2 ya reflejado en las fases (US1 primero por ser la de mayor
  severidad de datos).
- Polish depende de que todas las historias que se vayan a entregar estén completas.

### Dentro de cada historia

- Los tests se escriben y corren (deben fallar) antes de la implementación correspondiente.
- T007/T008 (tipos + schema Dexie) bloquean T009-T011 dentro de US1.
- T020 (estado elevado) bloquea T021-T022 dentro de US2.
- T028-T030 (los tres dashboards) bloquean T031 dentro de US3.

### Parallel Opportunities

- Todos los tests de una misma historia marcados `[P]` corren en paralelo (archivos distintos).
- US1, US2, US3 y US4 pueden trabajarse en paralelo por personas distintas una vez que cada una
  entiende su propio alcance — no comparten archivos entre sí, excepto que todas terminan pasando
  por `pnpm test`/`pnpm lint` en Polish.

---

## Parallel Example: User Story 1

```bash
# Tests de US1 en paralelo:
Task: "Extend recordInstallmentPayment.test.ts (T001)"
Task: "Extend recordPrincipalPayment.test.ts (T002)"
Task: "Add repository Movement assertions in LocalInstallmentLoanRepository.test.ts (T003, T004)"
Task: "Add CustomSyncLayer.test.ts pull coverage (T005)"
Task: "Add InstallmentLoanList.test.tsx disabled-button test (T006)"
```

---

## Implementation Strategy

### MVP First

1. Completar Phase 3 (US1 — préstamos): es la de mayor severidad, corrige integridad de datos
   financieros.
2. **STOP and VALIDATE**: correr quickstart.md §5 antes de seguir.
3. Continuar con US2 (reactividad), luego US3 (hábitos/dashboards), luego US4 (dropdowns).

### Incremental Delivery

Cada historia es un incremento entregable por separado: US1 → validar → US2 → validar → US3 →
validar → US4 → validar → Polish.

---

## Phase 8: Convergence

Generado por `/speckit-converge` tras verificar el código real (no solo los checkmarks) contra
spec.md/plan.md/constitution.md. 14/16 FR satisfechos completamente; los dos restantes quedan acá.

- [x] T037 Cablear un refresh-key para `Goal` entre `CreatePage.tsx` (creación) y `ControlPage.tsx` (`GoalList`/`GoalDashboard`), mismo patrón que `habitsRefreshKey`/`tasksRefreshKey` en `MainFlow.tsx`, para que un Goal nuevo aparezca sin recarga manual per FR-003 (partial)
- [x] T038 Dar a `TaskDashboard.tsx` una vía para mostrar tareas completadas (ej. un método nuevo en `ITaskRepository`/`LocalTaskRepository` que no filtre por `status === 'pending'` como hace `getAll`), ya que hoy la rama "Hecha" del dashboard es código muerto per FR-006 (partial)
