# Feature Specification: Fixes Críticos (dropdowns, reactividad, hábitos, préstamos)

**Feature Branch**: `[003-fixes-criticos]`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Corregir cuatro bugs críticos de integridad y usabilidad en ez-life: (1) los dropdowns tapan la primera selección; (2) crear un registro (ingreso, egreso, pago de cuota, hábito, tarea, meta) no se refleja en la UI sin refrescar la página; (3) los hábitos no se muestran en Control y no existe dashboard de hábitos/tareas/metas; (4) en Préstamos, cualquier registro (incluidos los abonos) resta cuotas restantes incorrectamente, y un pago de cuota no descuenta el balance ni aparece en Movimientos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pagos de préstamo se reflejan como gasto real (Priority: P1)

Como usuario que paga cuotas de un préstamo bancario/de caja, cuando registro un pago (cuota
regular o abono a capital), quiero que el sistema descuente correctamente las cuotas restantes
solo cuando corresponde, y que ese pago aparezca como un gasto real en mi balance y en mi
Historial de Movimientos — porque es plata que efectivamente salió de mi bolsillo.

**Why this priority**: Es el bug de mayor impacto: corrompe datos financieros (cuotas restantes
incorrectas) y esconde gastos reales del usuario, afectando su balance real y la confianza en la
app como fuente de verdad de sus finanzas.

**Independent Test**: Crear un préstamo con N cuotas, registrar un pago de tipo cuota y verificar
que `remaining_installments` baja en 1 y aparece un movimiento de egreso por el monto pagado;
registrar un abono a capital y verificar que `remaining_installments` NO cambia pero también
aparece su movimiento de egreso.

**Acceptance Scenarios**:

1. **Given** un préstamo activo con 12 cuotas restantes, **When** el usuario registra un pago de
   tipo cuota, **Then** las cuotas restantes bajan a 11 y el balance del usuario se reduce en el
   monto pagado.
2. **Given** un préstamo activo, **When** el usuario registra un abono a capital (`principal`),
   **Then** las cuotas restantes no cambian, pero el balance se reduce en el monto abonado.
3. **Given** un pago de cuota o abono recién registrado, **When** el usuario abre Movimientos
   (Historial), **Then** ve ese pago listado como un egreso.

---

### User Story 2 - Los registros nuevos aparecen sin recargar la página (Priority: P1)

Como usuario, cuando creo cualquier registro (ingreso, egreso, pago de préstamo, hábito, tarea o
meta), quiero verlo reflejado de inmediato en la pantalla correspondiente, sin tener que refrescar
manualmente el navegador.

**Why this priority**: Rompe la confianza básica en que la acción que acabo de hacer "funcionó" —
sin esto, cada flujo de creación se siente roto aunque el dato sí se haya guardado.

**Independent Test**: Crear un ingreso, un hábito, una tarea y una meta en secuencia, sin recargar
la página, y verificar que cada uno aparece en su vista correspondiente inmediatamente después de
guardarlo.

**Acceptance Scenarios**:

1. **Given** el usuario está en la vista de Movimientos, **When** crea un nuevo ingreso o egreso,
   **Then** el movimiento aparece en la lista sin necesidad de recargar la página.
2. **Given** el usuario está en Control, **When** crea un hábito, una tarea o una meta, **Then**
   el nuevo elemento aparece en su vista correspondiente sin recargar la página.

---

### User Story 3 - Hábitos visibles y con dashboard básico (Priority: P2)

Como usuario, quiero ver los hábitos que creé en la sección Control, y contar con una vista de
dashboard mínima para hábitos, tareas y metas que me muestre su estado actual.

**Why this priority**: Sin esto, una funcionalidad ya construida (hábitos) es invisible para el
usuario — es una regresión de visibilidad, no solo una mejora pendiente.

**Independent Test**: Crear un hábito y verificar que aparece listado en Control; abrir el
dashboard de hábitos y verificar que muestra el hábito con su racha actual; repetir para tareas
(pendiente/hecha) y metas (progreso).

**Acceptance Scenarios**:

1. **Given** el usuario creó un hábito, **When** entra a Control, **Then** el hábito aparece en la
   lista con su estado de racha.
2. **Given** existen hábitos, tareas y metas creadas, **When** el usuario abre el dashboard
   correspondiente a cada uno, **Then** ve una vista con los registros existentes y su estado
   (racha para hábitos, pendiente/hecha para tareas, progreso para metas).

---

### User Story 4 - Los dropdowns no tapan la opción seleccionable (Priority: P2)

Como usuario, cuando abro cualquier dropdown/select de la app, quiero ver todas las opciones sin
que el menú desplegado tape la opción actualmente seleccionada o la primera opción de la lista.

**Why this priority**: Es un bug transversal de usabilidad que afecta todos los formularios de la
app, pero tiene un workaround manual (scrollear o adivinar), a diferencia de los otros tres puntos
que corrompen datos o esconden funcionalidad completa.

**Independent Test**: Abrir cualquier formulario con un dropdown (categoría, subcategoría, tipo de
movimiento, etc.), desplegarlo y verificar visualmente que ninguna opción queda oculta detrás del
menú ni detrás del control que lo dispara.

**Acceptance Scenarios**:

1. **Given** un formulario con un dropdown con un valor ya seleccionado, **When** el usuario lo
   abre, **Then** el valor seleccionado y todas las opciones son completamente visibles y
   clickeables.

---

### Edge Cases

- Los pagos de préstamo ya registrados antes de este fix, cuyo `remaining_installments` ya quedó
  mal calculado y que nunca generaron un Movement, NO se corrigen retroactivamente (FR-013); si el
  usuario necesita corregir un préstamo puntual con datos históricos incorrectos, lo hace a mano.
- Si el usuario crea un registro y pierde conectividad justo después (antes del próximo ciclo de
  sync), el registro igual debe aparecer de inmediato en la UI local (la reactividad es sobre el
  estado local/IndexedDB, no depende de la sincronización con Supabase — Principio XII).
- Si dos pestañas del navegador están abiertas, esta spec no exige que un registro creado en una
  pestaña aparezca en la otra sin recargar — eso sigue el ciclo de sync existente entre sesiones.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema NO DEBE permitir que el menú desplegado de un dropdown/select se
  superponga visualmente a la opción actualmente seleccionada ni a la primera opción de la lista.
- **FR-002**: Al crear un Movement (ingreso o egreso), el sistema DEBE reflejarlo en la vista de
  Movimientos activa sin requerir recarga manual de la página.
- **FR-003**: Al crear un Habit, Task, Goal, o registrar un HabitCompletion, el sistema DEBE
  reflejarlo en su vista correspondiente sin requerir recarga manual de la página.
- **FR-004**: Los hábitos creados por el usuario DEBEN permanecer visibles en la sección Control
  incluso los días en que no están programados según su `schedule_mode` (`fixed_days` o
  `frequency`) — hoy se ocultan por completo esos días, lo que los hace parecer inexistentes; el
  usuario debe poder verlos y gestionarlos cualquier día, con una indicación de si corresponden a
  hoy o no.
- **FR-005**: El sistema DEBE proveer una vista de dashboard básica para Hábitos, mostrando cada
  hábito existente con su racha actual.
- **FR-006**: El sistema DEBE proveer una vista de dashboard básica para Tareas, mostrando cada
  tarea existente con su estado (pendiente/hecha).
- **FR-007**: El sistema DEBE proveer una vista de dashboard básica para Metas, mostrando cada
  meta existente con su progreso actual.
- **FR-008**: Al registrar un InstallmentPayment de tipo `installment`, el sistema DEBE decrementar
  `remaining_installments` del préstamo en exactamente 1.
- **FR-009**: Al registrar un InstallmentPayment de tipo `principal` (abono), el sistema NO DEBE
  modificar `remaining_installments` del préstamo.
- **FR-010**: Al registrar cualquier InstallmentPayment (tipo `installment` o `principal`), el
  sistema DEBE crear un Movement de egreso por el monto pagado, en adición a su registro de
  bookkeeping existente (Constitución v2.0.0, Principio X).
- **FR-011**: El Movement creado por un InstallmentPayment DEBE reflejarse en el cálculo de balance
  del usuario exactamente igual que cualquier otro Movement de egreso.
- **FR-012**: El Movement creado por un InstallmentPayment DEBE aparecer en Movimientos (Historial)
  de forma indistinguible en su tratamiento de cualquier otro movimiento (filtrable, listable).
- **FR-013**: FR-008 a FR-012 aplican únicamente a los InstallmentPayment registrados a partir del
  despliegue de este fix. El sistema NO DEBE recalcular retroactivamente `remaining_installments`
  ni generar Movements para InstallmentPayments ya existentes al momento del despliegue — el
  historial previo permanece sin modificar.
- **FR-014**: El control de confirmación de un abono a capital ("¿reduce plazo o cuota?" + monto)
  DEBE deshabilitarse mientras la operación está en curso, para impedir un doble envío accidental
  por doble clic.
- **FR-015**: Las tablas `installment_loans` e `installment_payments` DEBEN participar del ciclo de
  sincronización de traída de cambios remotos ("pull"), igual que el resto de las tablas
  sincronizadas — hoy solo se empujan cambios locales hacia Supabase, nunca se traen cambios
  remotos, lo que rompe la sincronización multi-dispositivo para préstamos (bug descubierto durante
  la investigación de este spec, sin relación directa con FR-008/009 pero del mismo dominio).
- **FR-016**: El formulario de un préstamo DEBE distinguir visualmente con claridad la acción
  "Pagar cuota(s)" de "Registrar abono a capital" (hoy son dos controles adyacentes en la misma
  tarjeta), para reducir el riesgo de que el usuario dispare la acción equivocada.

### Key Entities *(include if feature involves data)*

- **Movement**: ingreso/egreso existente; ahora también puede originarse automáticamente desde un
  InstallmentPayment.
- **InstallmentLoan**: préstamo con cuotas; su `remaining_installments` es el campo afectado por el
  bug de FR-008/FR-009.
- **InstallmentPayment**: registro de pago (cuota o abono) sobre un InstallmentLoan; pasa de ser
  puramente contable a generar también un Movement (FR-010).
- **Habit / HabitCompletion**: hábito del usuario y sus registros de cumplimiento; afectados por
  FR-004 (visibilidad) y FR-005 (dashboard).
- **Task**: tarea puntual con fecha límite; afectada por FR-006 (dashboard).
- **Goal**: meta numérica o de checklist; afectada por FR-007 (dashboard).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los dropdowns de la app permiten seleccionar cualquier opción, incluida
  la primera, sin que el menú la oculte, verificado en los formularios principales de la app.
- **SC-002**: Un registro nuevo (movimiento, pago de préstamo, hábito, tarea o meta) aparece en su
  vista correspondiente en menos de 1 segundo desde que el usuario lo guarda, sin recargar la
  página.
- **SC-003**: El 100% de los hábitos creados aparecen en Control inmediatamente después de
  creados.
- **SC-004**: Los usuarios pueden ver el estado actual (racha, pendiente/hecha, progreso) de todos
  sus hábitos, tareas y metas desde una vista de dashboard dedicada, sin navegar fuera de la app.
- **SC-005**: El 100% de los pagos de préstamo (cuota o abono) quedan reflejados como un egreso en
  el balance del usuario y en el Historial de Movimientos inmediatamente después de registrarse.
- **SC-006**: `remaining_installments` solo disminuye cuando se registra un pago de tipo cuota —
  nunca con un abono a capital — verificado en el 100% de los préstamos activos, incluso bajo
  doble clic accidental.
- **SC-007**: Un préstamo creado o pagado en un dispositivo se refleja correctamente al sincronizar
  en otro dispositivo del mismo usuario.

## Assumptions

- La corrección de reactividad (US2) aplica al estado local de la sesión/pestaña actual
  (IndexedDB); no implica sincronización en tiempo real entre pestañas o dispositivos, que sigue
  el ciclo de sync existente (Principio XII).
- El "dashboard básico" de hábitos/tareas/metas (US3) es de visibilidad funcional mínima: lista +
  estado actual (racha/pendiente-hecha/progreso). Gráficos, tendencias e indicadores más ricos
  quedan fuera de alcance de este spec (ver spec futura de dashboards y analítica).
- El Movement generado por un InstallmentPayment usa una categoría de egreso dedicada a
  préstamos/deudas para poder distinguirlo en reportes; la taxonomía exacta de esa categoría se
  decide en el diseño técnico (`/speckit-plan`), no en este spec.
- El fix de dropdowns (US4) es un problema de posicionamiento/z-index transversal a todos los
  componentes de tipo select/dropdown de la app, no un caso puntual de un formulario específico.
- La lógica de `recordPrincipalPayment` (caso `reduce_installment_amount`) fue verificada como
  correcta a nivel de persistencia (incluso bajo doble-submit concurrente) durante la investigación
  de este spec; FR-014/FR-016 son endurecimiento preventivo de UI/UX, no una corrección de lógica
  de negocio ya probada correcta.
