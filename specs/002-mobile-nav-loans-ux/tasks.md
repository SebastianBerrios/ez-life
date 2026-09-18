# Tasks: Navegación mobile, metas/tareas/hábitos, préstamos con cuotas y dropdowns

**Input**: Design documents from `/specs/002-mobile-nav-loans-ux/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/repositories.md, quickstart.md (todos presentes)

**Tests**: Incluidos. El proyecto tiene TDD estricto habilitado y el Principio IV de la constitución exige al menos un test unitario por caso de uso, más Testing Library para todo wiring de UI. La única excepción explícita de la constitución es "cambios puramente de estilo visual o de tokens (spacing, tipografía, colores, tamaños)" — aplicada en la Historia 4 (dropdowns) donde corresponde, no como regla general. Cada tarea de test debe escribirse y **fallar** antes de su implementación correspondiente.

**Organization**: Tareas agrupadas por historia de usuario (spec.md), en orden de prioridad P1→P4.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1..US4, mapeado 1:1 a las historias de `spec.md`
- Rutas de archivo exactas en cada descripción

## Path Conventions

Proyecto único existente (`src/core`, `src/infrastructure`, `src/presentation`) — ver `plan.md` § Project Structure. Sin separación frontend/backend.

---

## Phase 1: Setup

**Purpose**: Confirmar que no hace falta preparación de infraestructura nueva antes de tocar código de dominio o UI.

- [X] T001 Confirmar que `src/components/ui/dialog.tsx` (ya existente, usado hoy por todos los diálogos de `MainFlow.tsx`) alcanza para construir el drawer "Más" de la Historia 1 aplicándole clases Tailwind de bottom-sheet (anclado abajo, `rounded-t-2xl`, sin el `max-w-md` centrado que usan los diálogos actuales) — **no** generar un componente `Sheet` nuevo de shadcn ni instalar ninguna dependencia adicional (Principio I/VII, `research.md` #1).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prerrequisitos que bloquean a TODAS las historias.

**Ninguno.** Las cuatro historias tocan partes del código no solapadas entre sí (navegación, páginas de metas/tareas/hábitos, préstamos con cuotas, y formularios de dropdown, respectivamente) — no hay tipo, tabla ni componente compartido que las cuatro necesiten antes de empezar. Cada historia declara sus propios prerrequisitos internos en su fase. Se puede pasar directo a la Fase 3.

**Checkpoint**: sin bloqueos comunes — cada historia puede empezar de forma independiente.

---

## Phase 3: User Story 1 - Menos destinos de navegación, más claros, en mobile (Priority: P1) 🎯 MVP

**Goal**: La barra de navegación mobile muestra como máximo 5 destinos (4 fijos + "Más"), sin perder acceso a ninguna sección existente.

**Independent Test**: Abrir la app en viewport mobile, contar los destinos visibles, y verificar que los 5 restantes (Análisis, Metas, Espacio, Objetivos/Crear, Ajustes) siguen accesibles desde "Más".

### Tests for User Story 1 ⚠️

> Escribir y verificar que fallan antes de implementar

- [X] T002 [P] [US1] Test de Testing Library en `src/presentation/components/BottomNav.test.tsx` (nuevo): el nav mobile (`nav.md:hidden`) renderiza como máximo 5 botones de destino (FR-001); los 9 ids de destino originales (`dashboard`, `movements`, `analysis`, `goals`, `debts`, `shared-space`, `habits`/`control`, `objectives`/`create`, `settings` — ver T021 para el rename de los dos últimos) siguen presentes entre la barra fija y el contenido de "Más" (FR-003); el sidebar desktop (`aside.hidden.md:flex`) sigue mostrando los 9 sin cambios (FR-004).
- [X] T003 [P] [US1] Test de Testing Library en `src/presentation/components/MoreDrawer.test.tsx` (nuevo): se abre como overlay sobre la pantalla actual (no navega a una URL/página nueva, FR-002), lista los destinos que no están en la barra fija, y seleccionar uno invoca `onNavigate` con el id correcto y cierra el drawer.

### Implementation for User Story 1

- [X] T004 [US1] Reestructurar `src/presentation/components/BottomNav.tsx`: dividir el array `navItems` (línea 17) en `primaryNavItems` (`dashboard`, `movements`, `debts`, y el destino de control de la Historia 2 — ver nota en T021) y `overflowNavItems` (el resto: `analysis`, `goals`, `shared-space`, `settings`, y el destino de creación de la Historia 2). El `<nav className="md:hidden ...">` renderiza `primaryNavItems` + un botón "Más" (icono `MoreHorizontal` de `lucide-react`) que abre `MoreDrawer` (FR-001). El `<aside className="hidden md:flex ...">` sigue renderizando la lista completa de 9 sin cambios (FR-004).
- [X] T005 [US1] Crear `src/presentation/components/MoreDrawer.tsx` (nuevo, depende de T003 en rojo y de T001): reutiliza `Dialog`/`DialogContent` de `src/components/ui/dialog.tsx` con las clases de bottom-sheet confirmadas en T001 (FR-002). Recibe `overflowNavItems`, `currentRoute`, `onNavigate`, `open`, `onOpenChange`.
- [X] T006 [US1] Actualizar `src/presentation/components/MainFlow.tsx`: agregar el estado `showMoreDrawer` y renderizar `MoreDrawer` con los `overflowNavItems` de T004 (los ids de ruta existentes — `analysis`, `goals`, `shared-space`, `settings` — no cambian todavía; los dos ids nuevos de la Historia 2 se conectan en T022).

**Checkpoint**: Historia 1 funcional y testeable de forma independiente — con los ids `habits`/`objectives` todavía vigentes (se renombran en la Historia 2), la navegación ya queda en 5 destinos visibles en mobile.

---

## Phase 4: User Story 2 - Separar "crear/editar" de "hacer seguimiento" para metas, tareas y hábitos (Priority: P2)

**Goal**: Una página "Crear" concentra alta y edición de Goal/Task/Habit; una página "Control" concentra solo seguimiento (agenda de hoy + progreso de metas).

**Independent Test**: Crear un Goal/Task/Habit y editarlo desde "Crear"; marcarlo como hecho/cumplido desde "Control"; confirmar que ninguna acción de creación aparece en "Control".

**Nota de corrección sobre `contracts/repositories.md`**: ese documento proponía agregar un método `update(id, changes)` nuevo a `IGoalRepository`/`ITaskRepository`/`IHabitRepository`. Al revisar el código real, **no hacía falta**: `LocalGoalRepository.save()`, `LocalTaskRepository.save()` y `LocalHabitRepository.save()` ya hacen upsert por `id` (`const existing = await db.<table>.get(id); if (existing) {...merge...} else {...create...}`, confirmado leyendo `src/infrastructure/repositories/local/Local{Goal,Task,Habit}Repository.ts`). FR-006 se resuelve extendiendo la UI para pasar un `id` existente a `save()`, no agregando un método de repositorio nuevo. T007 documenta esta corrección — ya aplicada (ver abajo).

### Correcciones aplicadas durante `/speckit-analyze`

- [x] T007 [US2] Corregido `contracts/repositories.md`, `data-model.md` y `plan.md` (hallazgo F1 del análisis): quitada la mención del método `update(...)` nuevo en `IGoalRepository`/`ITaskRepository`/`IHabitRepository`; documentado en los tres archivos que FR-006 se apoya en el `save()` upsert que ya existe. Corrección de documentación, no de test — se deja fuera de "Tests for User Story 2" para no confundirla con una tarea TDD que deba fallar primero.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Test unitario en `src/infrastructure/repositories/local/LocalGoalRepository.test.ts` (extender el existente si ya hay uno, o crear): `save()` con el `id` de un `Goal` ya guardado actualiza sus campos en vez de crear un registro nuevo, y preserva `status`/`current_value`/`completed_at` cuando esos campos no vienen en la llamada.
- [X] T009 [P] [US2] Igual que T008 para `src/infrastructure/repositories/local/LocalTaskRepository.test.ts` (preserva `status`/`done_at`).
- [X] T010 [P] [US2] Igual que T008 para `src/infrastructure/repositories/local/LocalHabitRepository.test.ts`.
- [X] T011 [P] [US2] Test de Testing Library en `src/presentation/components/GoalForm.test.tsx` (extender): pasar una prop `existing: Goal` precarga `name`/`kind`/`target_value`/`milestones`, cambia el título a "Editar Meta" y el botón a "Guardar cambios", y al enviar llama a `save()` con `id: existing.id` (FR-006).
- [X] T012 [P] [US2] Igual que T011 para `src/presentation/components/TaskForm.test.tsx` (prop `existing: Task`, prefill `title`/`due_date`).
- [X] T013 [P] [US2] Igual que T011 para `src/presentation/components/HabitForm.test.tsx` (prop `existing: Habit`, prefill `schedule_mode`/`fixed_days`/`frequency_target`).
- [X] T014 [P] [US2] Test de Testing Library en `src/presentation/components/ControlPage.test.tsx` (nuevo): con una `Task` de hoy y un `Habit` de hoy pendientes, ambos aparecen arriba (FR-008); el progreso de un `Goal` activo aparece debajo (FR-009); no hay ningún botón "nuevo"/"crear" en la pantalla (FR-007); con cero `Goal`/`Task`/`Habit`, se ve el estado vacío que referencia "Crear" (edge case de `spec.md`).
- [X] T015 [P] [US2] Test de Testing Library en `src/presentation/components/CreatePage.test.tsx` (nuevo): permite crear un `Goal`/`Task`/`Habit` (delegando en los forms de T011-T013) y, dado un ítem existente de cada tipo, abrir su form en modo edición pasando `existing` (FR-005, FR-006).

### Implementation for User Story 2

- [X] T016 [US2] Extender `src/presentation/components/GoalForm.tsx` con prop opcional `existing?: Goal` (depende de T011 en rojo): precarga el estado inicial desde `existing`, ajusta título/botón, y el `save()` final usa `id: existing?.id ?? ''` sin pisar `status`/`current_value`/`completed_at` cuando `existing` está presente.
- [X] T017 [US2] Igual que T016 para `src/presentation/components/TaskForm.tsx` (depende de T012 en rojo, prop `existing?: Task`).
- [X] T018 [US2] Igual que T016 para `src/presentation/components/HabitForm.tsx` (depende de T013 en rojo, prop `existing?: Habit`).
- [X] T019 [US2] Crear `src/presentation/components/CreatePage.tsx` (nuevo, depende de T015 en rojo, T016-T018): tres secciones (Metas/Tareas/Hábitos), cada una con botón "+ Nueva/o" (form en modo creación) y una lista compacta de ítems existentes con acción "Editar" (form con `existing`, T016-T018). Revisar `GoalList.tsx`/`TaskList.tsx`/`HabitList.tsx` antes de decidir si se reutilizan tal cual para la lectura o se extrae una variante sin las acciones de tracking (marcar hecho/cumplido), que no pertenecen a esta página (FR-005).
- [X] T020 [US2] Crear `src/presentation/components/ControlPage.tsx` (nuevo, depende de T014 en rojo). **Desviación de la redacción original de esta tarea**: en vez de evolucionar `HabitsDashboard.tsx` in place, se optó por componer `TaskList.tsx`/`HabitList.tsx`/`GoalList.tsx` directamente (ya traen sus propias acciones de tracking probadas) más una única capa de "¿está todo vacío?" para el estado vacío unificado del edge case — más simple que mezclar streak/dashboard con la lista real (Principio VII). `HabitsDashboard.tsx` quedó sin ningún importador tras este cambio (MainFlow ya no lo usa) y se eliminó junto con su test, en vez de dejarlo como código muerto.
- [X] T021 [US2] Actualizar `src/presentation/components/BottomNav.tsx` (depende de T004 de la Historia 1): reemplazar los ids `objectives`/`habits` por `create`/`control` en `primaryNavItems`/`overflowNavItems` — `control` queda fijo, `create` queda dentro de "Más" (distribución acordada en `spec.md` § Assumptions).
- [X] T022 [US2] Actualizar `src/presentation/components/MainFlow.tsx` (depende de T006 de la Historia 1, T019, T020): reemplazar las ramas `currentRoute === 'objectives'` y `currentRoute === 'habits'` por `currentRoute === 'create'` (renderiza `CreatePage`) y `currentRoute === 'control'` (renderiza `ControlPage`); retirar `showObjectiveGoalForm`, `showTaskForm`, `showHabitForm` y sus `refreshKey` (ahora viven dentro de `CreatePage.tsx`).

**Checkpoint**: Historia 2 completa y testeable de forma independiente (T007-T020 no dependen de la Historia 1; solo el wiring final T021-T022 sí).

---

## Phase 5: User Story 3 - Llevar el control de un préstamo bancario por su cronograma real de cuotas (Priority: P3)

**Goal**: Registrar un `InstallmentLoan` con los números exactos del banco, pagar cuotas, registrar abonos a capital eligiendo plazo-vs-cuota, y ver el préstamo saldarse sin que la app calcule nada.

**Independent Test**: Registrar un préstamo con cuotas, pagar dos cuotas, intentar pagar de más (debe bloquearse), registrar un abono a capital, y llegar a "Pagado/Saldado".

### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] Test unitario en `src/core/use-cases/recordInstallmentPayment.test.ts`: pagar N cuotas válidas decrementa `remaining_installments` en N y produce un `InstallmentPayment` con `kind: 'installment'`; pagar más cuotas de las que quedan **lanza `DomainError` y no aplica ningún cambio parcial ni capea al máximo disponible** (cita textual del comportamiento acordado en FR-021 / Clarifications de `spec.md`). Agregar un test análogo a `applyDebtSettlement.test.ts`'s `'never returns anything resembling a Movement'`: **el resultado devuelto NO DEBE tener ninguna forma parecida a un `Movement`** (`Object.keys(result).sort()` limitado a los campos de `InstallmentLoan`/`InstallmentPayment` esperados), y la función NO DEBE importar ni recibir `IMovementRepository` como dependencia (FR-027, Principio X).
- [X] T024 [P] [US3] Test unitario en `src/core/use-cases/recordPrincipalPayment.test.ts`: un abono con `adjustment: { type: 'reduce_term', newRemainingInstallments }` aplica exactamente ese valor sin recalcularlo (FR-017); un abono mayor al saldo pendiente (`installment_amount * remaining_installments`) **se rechaza con `DomainError`, nunca se aplica parcialmente** (FR-021). Mismo test de "no-Movement" que T023, aplicado a este use-case (FR-027, Principio X).
- [X] T025 [P] [US3] Test unitario en `src/core/use-cases/evaluateInstallmentLoanStatus.test.ts`: `remaining_installments > 0` → `'active'`; `= 0` → `'settled'`; nunca vuelve a `'active'` una vez `'settled'` (FR-025).
- [X] T026 [P] [US3] Test unitario en `src/infrastructure/repositories/local/LocalInstallmentLoanRepository.test.ts` (mismo patrón que `LocalDebtRepository.test.ts`): `create` inicializa `remaining_installments = installment_count` (FR-011); `recordInstallmentPayment`/`recordPrincipalPayment` delegan toda validación a los use-cases de T023/T024, sin reimplementarla (Principio III).
- [X] T027 [P] [US3] Test de Testing Library en `src/presentation/components/InstallmentLoanForm.test.tsx` (nuevo): completar monto/N° de cuotas/monto de cuota/tasa opcional y enviar invoca `create` con esos cuatro valores exactos, sin transformación (FR-011, FR-012); la tasa nunca llega a ningún cálculo (FR-013).
- [X] T028 [P] [US3] Test de Testing Library en `src/presentation/components/InstallmentLoanList.test.tsx` (nuevo): un préstamo con cuotas se lista junto a los `Debt` existentes (FR-019); un abono a capital muestra la pregunta plazo-vs-cuota (FR-016) y un input para el valor resultante ingresado a mano (FR-017); `remaining_installments = 0` muestra "Pagado/Saldado" y sigue en la lista (FR-025); pagar más cuotas de las que quedan muestra el error sin aplicar el cambio (FR-021).

### Implementation for User Story 3

- [X] T029 [P] [US3] Agregar a `src/core/domain/models/types.ts`: `InstallmentLoanStatus`, `InstallmentPaymentKind`, `InstallmentAdjustmentType`, `InstallmentLoan`, `InstallmentPayment` — campos exactos de `data-model.md` (`amount`/`installment_amount` enteros de centavos PEN, Principio VIII).
- [X] T030 [P] [US3] Agregar `IInstallmentLoanRepository` a `src/core/domain/repositories/IRepositories.ts` con la firma de `contracts/repositories.md`: `getAll`, `getById`, `create`, `updateTerms`, `recordInstallmentPayment`, `recordPrincipalPayment`, `getPayments`, `delete`.
- [X] T031 [US3] Implementar `recordInstallmentPayment` en `src/core/use-cases/recordInstallmentPayment.ts` (depende de T023 en rojo, T029) — mismo patrón que `src/core/use-cases/applyDebtSettlement.ts` (función pura, lanza `DomainError`, nunca capea silenciosamente, sin importar ni recibir `IMovementRepository` — FR-027).
- [X] T032 [US3] Implementar `recordPrincipalPayment` en `src/core/use-cases/recordPrincipalPayment.ts` (depende de T024 en rojo, T029) — mismo patrón que T031, incluyendo la garantía de FR-027 (nunca crea ni toca un `Movement`).
- [X] T033 [US3] Implementar `evaluateInstallmentLoanStatus` en `src/core/use-cases/evaluateInstallmentLoanStatus.ts` (depende de T025 en rojo, T029).
- [X] T034 [US3] Subir la versión del esquema Dexie en `src/infrastructure/db/db.ts` (de 10 a 11, siguiendo el patrón de las versiones anteriores) agregando `installment_loans: 'id, user_id, status'` e `installment_payments: 'id, installment_loan_id, date'`, y sumar `'installment_loans'`/`'installment_payments'` al array `SYNCED_TABLES` (línea 36) — con eso el middleware `setupSyncQueueTransactionScope()` y los hooks de `setupHooks()` ya cubren su sync automáticamente, sin tocar esos dos métodos.
- [X] T035 [US3] Implementar `LocalInstallmentLoanRepository` en `src/infrastructure/repositories/local/LocalInstallmentLoanRepository.ts` (depende de T026 en rojo, T030-T034): delega toda validación/derivación a los use-cases de T031-T033, mismo patrón que `LocalDebtRepository.ts` delegando en `applyDebtSettlement.ts`.
- [X] T036 [US3] Escribir la migración SQL en `supabase/migrations/` (timestamp nuevo, nunca vía Supabase MCP/`execute_sql` directo) creando las tablas Postgres `installment_loans`/`installment_payments` con el mismo patrón de RLS por `user_id` que `20260917190159_add_debts.sql` — archivo escrito en `supabase/migrations/20260918150000_add_installment_loans.sql`. **Pendiente**: correr `supabase db push` (requiere la sesión de Supabase CLI del usuario, no se ejecutó acá).
- [X] T037 [P] [US3] Construir `InstallmentLoanForm.tsx` en `src/presentation/components/` (depende de T027 en rojo, T030): inputs de prestamista, monto, N° de cuotas, monto de cuota, tasa opcional — sin ningún cálculo de amortización en el componente (FR-012).
- [X] T038 [US3] Construir `InstallmentLoanList.tsx` en `src/presentation/components/` (depende de T028 en rojo, T035): convive con `DebtList` en la misma pantalla (FR-019); acciones "Pagar cuota(s)" y "Registrar abono a capital" (con el flujo plazo-vs-cuota de FR-016/017), indicador "Pagado/Saldado" (FR-025), y el historial de pagos de T040.
- [X] T039 [US3] Conectar la sección "Préstamos" en `src/presentation/components/MainFlow.tsx` (depende de T037, T038): agregar `InstallmentLoanForm`/`InstallmentLoanList` junto a `DebtForm`/`DebtList` en la rama `currentRoute === 'debts'`, mismo patrón de diálogo que `showDebtForm`/`debtsRefreshKey`.
- [X] T040 [US3] Agregar la vista de historial de pagos (fecha + monto + tipo, FR-026) dentro de `InstallmentLoanList.tsx`, usando `getPayments(loanId)` de T035.
- [X] T041 [US3] Implementar la corrección de términos originales (FR-022): un modo de edición sobre `InstallmentLoanForm.tsx` que llama a `updateTerms(id, changes)`, independiente de cualquier registro de pago.

**Checkpoint**: Historia 3 completa y testeable de forma independiente.

---

## Phase 6: User Story 4 - Todos los dropdowns se ven y se comportan igual (Priority: P4)

**Goal**: Migrar los `<select>` nativos restantes al componente `Select` compartido (`src/components/ui/select.tsx`).

**Independent Test**: Abrir cada selector migrado y confirmar que se ve/comporta igual que el `Select` de categoría en `MovementForm.tsx`.

- [X] T042 [US4] Migrar `src/presentation/components/SettingsScreen.tsx`: reemplazar el `<select>` nativo del selector de hora de notificación por `Select` (FR-023). Sin test nuevo — confirmado (verificación de `/speckit-analyze`, hallazgo C1): no existe `src/presentation/components/SettingsScreen.test.tsx` a la fecha de este análisis, y es un cambio puramente visual (Principio IV, excepción de estilo/tokens).
- [X] T043 [US4] Migrar `src/presentation/components/DebtForm.tsx`: reemplazar el `<select>` nativo del selector de dirección (línea 85) por `Select` (FR-023). Actualizar `src/presentation/components/DebtForm.test.tsx:49`, que hoy usa `user.selectOptions(screen.getByLabelText(/dirección/i), 'borrowed')` (interacción de `<select>` nativo) — reemplazar por el patrón `user.click(trigger)` + `user.click(option)` que ya usa `src/presentation/components/MovementForm.test.tsx` para su `Select` de categoría (líneas 41-45). Es mantenimiento de un test existente, no un test nuevo.
- [X] T044 [US4] Migrar el `<select>` nativo de "Tipo" (gasto/ingreso) en `src/presentation/components/SharedMovementForm.tsx` al mismo `Select` que ese formulario ya usa para "Categoría" (FR-024). Actualizar `src/presentation/components/SharedMovementForm.test.tsx:148` (`user.selectOptions(screen.getByLabelText(/^tipo$/i), 'income')`) al mismo patrón `click`+`click(option)`.
- [X] T045 [P] [US4] Correr `pnpm test` y confirmar visualmente que no queda ningún `<select>` nativo del navegador en `SettingsScreen.tsx`, `DebtForm.tsx` ni `SharedMovementForm.tsx` (SC-004). Verificado también `InstallmentLoanForm.tsx` (Historia 3, agregado después de escribir estas tareas): no usa `<select>` nativo, ya nace conforme a FR-023.

**Checkpoint**: las 4 historias son ahora independientemente funcionales.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T046 [P] Correr `pnpm test`, `pnpm lint` y `pnpm build` completos sobre las 4 historias integradas.
- [ ] T047 Ejecutar manualmente las 5 secciones de `quickstart.md` de punta a punta, ya con las historias integradas entre sí (no solo aisladas) — incluyendo la sección 5 "Regresión post-integración", que confirma explícitamente que `SavingsGoal` y `Debt` siguen funcionando sin cambios (FR-010, FR-018; hallazgo E1 de `/speckit-analyze`).
- [ ] T048 [P] Revisar que ningún archivo nuevo de esta feature quedó con copy de UI en inglés (Principio VI) — identificadores/tipos en inglés, texto visible en español, igual que el resto de la app.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias, arranca de inmediato.
- **Foundational (Fase 2)**: vacía — no bloquea nada.
- **Historias de usuario (Fase 3-6)**: cada una puede arrancar de inmediato y en paralelo entre sí, salvo las excepciones puntuales de abajo.
- **Polish (Fase 7)**: depende de que las historias que se quieran entregar ya estén completas.

### Dependencias entre historias

- **US1 (P1)**: sin dependencias de otras historias.
- **US2 (P2)**: su lógica interna (T007-T020) es independiente de US1; solo el wiring final de navegación (T021-T022) depende de que T004/T006 de US1 ya existan (mismos archivos: `BottomNav.tsx`, `MainFlow.tsx`).
- **US3 (P3)**: sin dependencias de otras historias — toca archivos completamente distintos.
- **US4 (P4)**: sin dependencias de otras historias, aunque toca `DebtForm.tsx` (también tocado por ningún otro US) — sin conflicto real de archivos con US1-US3.

### Dentro de cada historia

- Tests DEBEN escribirse y fallar antes de la implementación correspondiente.
- Tipos/dominio antes que use-cases; use-cases antes que repositorios; repositorios antes que UI.
- El wiring final a `BottomNav.tsx`/`MainFlow.tsx` es siempre la última tarea de cada historia que lo necesita.

### Oportunidades de paralelismo

- Las 4 historias completas pueden trabajarse en paralelo por personas distintas después de la Fase 1.
- Dentro de cada historia, todas las tareas de test marcadas `[P]` corren en paralelo entre sí.
- T029/T030 (tipos + interfaz de `InstallmentLoan`) son paralelizables entre sí, pero bloquean a T031-T033.

---

## Parallel Example: User Story 3

```bash
# Lanzar juntos los tests de dominio de la Historia 3:
Task: "Test unitario en src/core/use-cases/recordInstallmentPayment.test.ts"
Task: "Test unitario en src/core/use-cases/recordPrincipalPayment.test.ts"
Task: "Test unitario en src/core/use-cases/evaluateInstallmentLoanStatus.test.ts"

# Lanzar juntos los tipos + contrato:
Task: "Agregar InstallmentLoan/InstallmentPayment a types.ts"
Task: "Agregar IInstallmentLoanRepository a IRepositories.ts"
```

---

## Implementation Strategy

### MVP primero (solo User Story 1)

1. Completar Fase 1: Setup.
2. Fase 2 (Foundational) está vacía — no hay nada que esperar.
3. Completar Fase 3: User Story 1.
4. **PARAR y VALIDAR**: probar la navegación reducida de forma independiente en mobile.
5. Es la historia más barata y de mayor frecuencia de uso (spec.md § Why this priority) — el MVP más chico que ya aporta valor todos los días.

### Entrega incremental

1. Setup (sin Foundational que esperar) → Fase 3 (US1) → validar → demo (MVP).
2. Agregar US2 → validar independientemente → demo.
3. Agregar US3 → validar independientemente → demo.
4. Agregar US4 → validar independientemente → demo.
5. Fase 7 (Polish) al final, con las 4 historias ya integradas.

### Estrategia en paralelo

Con más de una persona: después de la Fase 1, cada historia (US1-US4) puede asignarse a alguien distinto — no comparten archivos salvo el wiring final de US1/US2 en `BottomNav.tsx`/`MainFlow.tsx`, que debe coordinarse entre esas dos personas.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- La etiqueta `[Story]` mapea cada tarea a su historia de usuario para trazabilidad.
- Verificar que los tests fallan antes de implementar.
- T007 corrige un error real encontrado en `contracts/repositories.md` durante esta generación de tareas (un método de repositorio que ya existe bajo otro nombre) — no es un cambio de alcance, es una corrección de precisión del contrato. Ya aplicada (ver "Correcciones aplicadas durante `/speckit-analyze`" en la Historia 2).
- FR-027 (InstallmentLoan/InstallmentPayment nunca crean un `Movement`, Principio X) se agregó a `spec.md` durante `/speckit-analyze` (hallazgo D1) y está cubierto por T023/T024/T031/T032.
- T039 y T042 fueron ajustadas durante `/speckit-analyze` (hallazgos F3 y C1) para citar sus dependencias/evidencia de forma explícita, igual que el resto del documento.
- T047 ahora referencia la sección 5 de `quickstart.md` ("Regresión post-integración"), agregada durante `/speckit-analyze` (hallazgo E1) para blindar FR-010/FR-018 contra regresión accidental.

---

## Phase 8: Convergence

- [X] T049 Filtrar `TaskList.tsx`/`HabitList.tsx` cuando se renderizan dentro de `ControlPage.tsx` para mostrar solo las tareas con `due_date` de hoy y los hábitos efectivamente programados para hoy (días fijos que incluyan el día de la semana actual, o hábitos de frecuencia libre aún no cumplidos esta semana) — hoy ambos componentes muestran TODAS las tareas pendientes y TODOS los hábitos activos sin importar la fecha, lo cual no coincide con "para el día actual" de FR-008 ni con el Acceptance Scenario 3 de la Historia 2 ("ve arriba las tareas pendientes de hoy y los hábitos de hoy por marcar") per FR-008 (partial)
- [X] T050 Filtrar `GoalList.tsx` cuando se renderiza dentro de `ControlPage.tsx` para mostrar solo metas con `status !== 'completed'` — hoy muestra todas las metas incluyendo las ya completadas (con el badge "¡Completada!"), mientras que FR-009 especifica "el progreso de las Metas activas" per FR-009 (partial)
