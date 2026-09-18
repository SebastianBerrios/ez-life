# Feature Specification: Navegación mobile, separación de metas/tareas/hábitos, préstamos con cuotas y consistencia de dropdowns

**Feature Branch**: `002-mobile-nav-loans-ux`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Reorganizar la navegación mobile, unificar la gestión de metas/tareas/hábitos, agregar préstamos con cuotas, y unificar el estilo de los dropdowns."

## Clarifications

### Session 2026-09-18

- Q: Cuando un `InstallmentLoan` termina de pagarse (cuotas restantes llegan a cero), ¿qué le pasa al préstamo en la sección "Préstamos"? → A: Pasa a estado "Pagado/Saldado" (estado derivado, igual que ya hace `Debt`) y sigue visible con un indicador visual distinto — nunca se archiva ni se elimina automáticamente.
- Q: Cuando el usuario intenta marcar más cuotas como pagadas de las que quedan, ¿qué debe pasar? → A: La acción se bloquea con un error de validación; el sistema nunca la limita silenciosamente al máximo disponible.
- Q: ¿El sistema necesita un historial detallado y fechado de cada pago de cuota/abono a capital, o alcanza con contadores corrientes? → A: Historial detallado — cada pago de cuota y cada abono a capital queda como su propio registro con fecha y monto, para que el usuario pueda revisar después qué pagó y cuándo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Menos destinos de navegación, más claros, en mobile (Priority: P1)

Como usuario mobile, hoy tengo que recorrer una fila de 9 tabs para encontrar la sección que busco. Necesito que la barra se reduzca a los pocos destinos que uso a diario, con un único lugar obvio para llegar a todo lo demás.

**Why this priority**: Afecta todas las pantallas y todas las sesiones; es el punto de fricción de mayor frecuencia, y el más barato de entregar de forma independiente respecto de las otras tres historias.

**Independent Test**: Se puede probar completamente abriendo la app en una vista mobile y contando/usando los destinos de navegación visibles — aporta valor por sí sola, sin depender de las otras historias.

**Acceptance Scenarios**:

1. **Given** la app abierta en una vista mobile, **When** el usuario mira la barra de navegación inferior, **Then** ve como máximo 5 destinos en total (4 fijos + 1 "Más").
2. **Given** el usuario toca "Más", **When** se abre la vista de destinos adicionales, **Then** aparece como un drawer/bottom-sheet sobre la pantalla actual (no como navegación de página completa) y lista todos los destinos que no están ya en la barra fija.
3. **Given** un destino vive dentro de "Más", **When** el usuario lo selecciona, **Then** llega a esa sección en la misma cantidad de pasos que antes (no se elimina ninguna funcionalidad, solo se reubica).
4. **Given** la vista desktop/tablet, **When** el usuario ve la navegación ahí, **Then** no se ve afectada por este cambio (la restricción es específica de mobile).

---

### User Story 2 - Separar "crear/editar" de "hacer seguimiento" para metas, tareas y hábitos (Priority: P2)

Como usuario, quiero un único lugar donde agregar o editar cualquier meta, tarea o hábito, y un lugar distinto donde solo revisar qué tengo pendiente hoy y cómo van mis metas — en vez de tener los controles de creación mezclados con las listas de seguimiento en pantallas por entidad.

**Why this priority**: Flujo de productividad significativo y de uso frecuente; independiente de la navegación y de los préstamos, pero se beneficia de los espacios de navegación que libera la Historia 1.

**Independent Test**: Se puede probar completamente creando, editando y completando una meta/tarea/hábito a través de las páginas "Crear" y "Control", confirmando que ningún control de creación se filtra a "Control" ni ningún control de seguimiento/marcado se filtra a "Crear".

**Acceptance Scenarios**:

1. **Given** el usuario abre la página "Crear", **When** elige agregar una meta, tarea o hábito nuevo, **Then** puede completarlo y guardarlo, igual que hoy.
2. **Given** una meta, tarea o hábito existente, **When** el usuario lo abre desde la página "Crear", **Then** puede editar sus campos y guardar los cambios (esto no existía antes de esta feature).
3. **Given** el usuario abre la página "Control", **When** la página carga, **Then** ve arriba las tareas pendientes de hoy y los hábitos de hoy por marcar, y más abajo el progreso de las metas activas — sin ninguna forma de crear un ítem nuevo desde esta página.
4. **Given** el usuario no tiene ninguna meta, tarea ni hábito, **When** abre "Control", **Then** ve un estado vacío que explica cómo agregar su primer ítem (apuntando a "Crear"), no una pantalla en blanco.
5. **Given** la meta de ahorro financiera (`SavingsGoal`), **When** el usuario la busca, **Then** sigue exactamente donde está hoy, sin verse afectada por esta reorganización.

---

### User Story 3 - Llevar el control de un préstamo bancario por su cronograma real de cuotas (Priority: P3)

Como usuario que se prestó plata de un banco o caja (ej. 12 cuotas mensuales), quiero registrar los números exactos que me dio la entidad financiera — monto, número de cuotas, monto de cuota y tasa — y anotar lo que efectivamente pago cada mes, incluyendo pagos extra a capital, sin que la app me muestre nunca un número que no coincida con mi estado de cuenta.

**Why this priority**: Capacidad nueva con una forma de datos nueva; mayor costo de implementación que las otras historias, e independiente de ellas.

**Independent Test**: Se puede probar completamente registrando un préstamo con un cronograma de cuotas fijo, marcando cuotas como pagadas, y registrando un pago a capital — aporta valor por sí sola (un registro personal preciso de un préstamo con cuotas) sin tocar las otras historias.

**Acceptance Scenarios**:

1. **Given** el usuario está en la sección "Préstamos", **When** registra un préstamo nuevo con cuotas, **Then** ingresa el monto del préstamo, el número de cuotas, el monto de cuota y (opcionalmente) una tasa de interés, y la app guarda exactamente esos valores sin recalcularlos ni ajustarlos.
2. **Given** un préstamo con cuotas existente, **When** el usuario marca una o más cuotas como pagadas, **Then** el número de cuotas restantes del préstamo disminuye en consecuencia.
3. **Given** un préstamo con cuotas existente, **When** el usuario registra un pago extra a capital, **Then** la app pregunta si ese pago reduce el número de cuotas restantes o el monto de cuota, y deja que el usuario ingrese él mismo el valor resultante (la app nunca calcula ese valor).
4. **Given** la funcionalidad existente de préstamo simple (`Debt`, préstamos informales entre personas, en cualquier dirección), **When** esta feature se lanza, **Then** sigue funcionando exactamente igual que antes, sin cambios, y ambos tipos de préstamo se ven juntos en la misma sección "Préstamos".
5. **Given** un préstamo originado como gasto compartido/familiar, **When** el usuario busca una forma de vincular un préstamo con cuotas a un espacio compartido, **Then** no se ofrece ningún vínculo de ese tipo (explícitamente fuera de alcance para esta feature).

---

### User Story 4 - Todos los dropdowns se ven y se comportan igual (Priority: P4)

Como usuario, cuando abro cualquier selector en la app (dirección de préstamo, hora de notificación, tipo de movimiento, categoría, etc.), quiero que se vea y se comporte igual en todos lados, en vez de que algunos sean el dropdown nativo del navegador y otros un componente con estilo propio.

**Why this priority**: Consistencia visual/de interacción pura, la de menor riesgo y valor de las cuatro, sin dependencia hacia ni desde las otras tres.

**Independent Test**: Se puede probar completamente abriendo cada pantalla que contiene un dropdown/select y confirmando que todos comparten el mismo componente visual y patrón de interacción.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla de la app que presenta una lista de selección única (hora de notificación, dirección de préstamo, tipo de movimiento, categoría, subcategoría, meta de ahorro), **When** el usuario la abre, **Then** se renderiza con el mismo estilo visual y patrón de interacción que cualquier otro selector de la app.
2. **Given** un formulario que antes mezclaba un selector nativo con el selector con estilo (tipo de movimiento vs. categoría), **When** el usuario usa cualquiera de los dos campos, **Then** ambos se comportan de forma idéntica.

---

### Edge Cases

- ¿Qué pasa si el usuario intenta marcar más cuotas como pagadas de las que quedan en el préstamo? La app debe bloquear la acción con un error de validación — nunca debe limitarla silenciosamente al máximo disponible.
- ¿Qué pasa si se ingresa un pago a capital mayor al saldo pendiente del préstamo? La app debe rechazarlo en vez de aceptar en silencio un estado inconsistente.
- ¿Qué pasa si al usuario no le queda ningún destino para mostrar en "Más" (un rediseño futuro elimina suficientes secciones)? "Más" puede ocultarse cuando quedaría vacío, en vez de mostrarse vacío.
- ¿Qué pasa si una tarea o hábito programado para "hoy" ya se completó antes de que el usuario abra "Control"? Debe reflejarse como hecho, no repetirse como pendiente.
- ¿Qué pasa si un usuario con un préstamo con cuotas existente quiere corregir un error de tipeo en el monto o número de cuotas original ingresado al crearlo? Debe ser posible editar las condiciones originales del préstamo (distinto de registrar un pago).

## Requirements *(mandatory)*

### Functional Requirements

**Navegación**

- **FR-001**: En vistas mobile, el sistema DEBE mostrar como máximo 5 destinos de navegación en la barra inferior principal, incluyendo uno dedicado a acceder a todas las secciones restantes.
- **FR-002**: El sistema DEBE presentar las secciones restantes en un drawer/bottom-sheet cuando se activa el destino "Más", no como navegación de página completa.
- **FR-003**: El sistema NO DEBE eliminar el acceso a ninguna sección que exista en la navegación actual de 9 destinos; toda sección DEBE seguir siendo alcanzable, directamente o vía "Más".
- **FR-004**: La disposición de navegación desktop/tablet DEBE permanecer sin cambios por esta feature.

**Metas, tareas y hábitos**

- **FR-005**: El sistema DEBE proveer una única superficie "Crear" donde el usuario pueda crear una Meta (`Goal`), una Tarea (`Task`) o un Hábito (`Habit`).
- **FR-006**: El sistema DEBE permitir editar una Meta, Tarea o Hábito existente desde la superficie "Crear" (esta capacidad no existe hoy para ninguna de las tres).
- **FR-007**: El sistema DEBE proveer una única superficie "Control", separada de "Crear", que sea de solo lectura respecto de la creación de ítems nuevos.
- **FR-008**: La superficie "Control" DEBE mostrar, para el día actual, las Tareas pendientes y los Hábitos aún por marcar.
- **FR-009**: La superficie "Control" DEBE mostrar el progreso de las Metas activas, ubicado debajo de las Tareas/Hábitos del día.
- **FR-010**: La entidad `SavingsGoal` (meta de ahorro) y su pantalla existente DEBEN permanecer sin cambios por esta reorganización — quedan fuera de alcance.

**Préstamos con cuotas**

- **FR-011**: El sistema DEBE permitir al usuario registrar un préstamo con cuotas nuevo ingresando: monto total, número de cuotas, monto de cuota, y una tasa de interés opcional.
- **FR-012**: El sistema DEBE guardar los valores ingresados en FR-011 exactamente como se proveyeron, sin derivarlos, recalcularlos ni ajustarlos mediante ninguna fórmula de amortización.
- **FR-013**: La tasa de interés de un préstamo con cuotas DEBE tratarse únicamente como dato informativo de visualización y NO DEBE influir en ningún cálculo.
- **FR-014**: El sistema DEBE permitir al usuario registrar uno o más pagos de cuota contra un préstamo, disminuyendo su número de cuotas restantes.
- **FR-015**: El sistema DEBE permitir al usuario registrar un pago a capital/adelanto contra un préstamo, distinto de un pago de cuota regular.
- **FR-016**: Al registrarse un pago a capital/adelanto, el sistema DEBE preguntar al usuario si ese pago reduce el número de cuotas restantes o el monto de cuota.
- **FR-017**: Después de esa elección, el sistema DEBE permitir que el usuario ingrese él mismo el valor resultante (cuotas restantes o nuevo monto de cuota); el sistema NO DEBE calcular ese valor.
- **FR-018**: La capacidad existente de `Debt` (préstamo simple, prestado o pedido prestado, sin cronograma de cuotas) DEBE permanecer sin cambios y seguir soportando ambas direcciones.
- **FR-019**: Los préstamos con cuotas y los registros simples de `Debt` DEBEN aparecer juntos dentro de la misma sección "Préstamos".
- **FR-020**: Los préstamos con cuotas NO DEBEN ofrecer ningún vínculo a un espacio compartido/gasto compartido en esta feature.
- **FR-021**: El sistema DEBE bloquear, con un error de validación, cualquier intento de marcar más cuotas como pagadas de las que restan en el préstamo, y cualquier intento de registrar un pago a capital mayor al saldo pendiente — ninguno de los dos casos puede limitarse silenciosamente ni aplicarse de forma parcial.
- **FR-022**: El sistema DEBE permitir corregir las condiciones originales de un préstamo con cuotas (monto, número de cuotas, monto de cuota, tasa) de forma independiente a registrar un pago.
- **FR-025**: El sistema DEBE tratar un préstamo con cuotas como saldado en cuanto su número de cuotas restantes llega a cero, replicando el comportamiento de saldado que ya tiene `Debt`, y DEBE mantenerlo visible en la sección "Préstamos" con un indicador distinto de "Pagado/Saldado", en vez de archivarlo o eliminarlo automáticamente.
- **FR-026**: El sistema DEBE registrar cada pago de cuota y cada pago a capital/adelanto como su propio registro fechado (fecha + monto, y para los pagos a capital/adelanto, si redujo plazo o monto de cuota y el valor resultante), de forma que el usuario pueda revisar después el historial completo de pagos de un préstamo.
- **FR-027**: El sistema NO DEBE generar ningún `Movement` de ingreso/egreso al registrar un pago de cuota o un pago a capital/adelanto contra un `InstallmentLoan` — igual que ya exige el Principio X de la constitución para `Debt`, registrar un pago contra un préstamo con cuotas es únicamente contable.

**Consistencia de dropdowns**

- **FR-023**: Todo selector de opción única de la aplicación DEBE usar el mismo componente de selector compartido y el mismo estilo visual.
- **FR-024**: Ninguna pantalla puede mezclar el componente de selector compartido con un selector de estilo distinto dentro del mismo formulario.

### Key Entities *(include if feature involves data)*

- **Goal (Meta)**: Objetivo personal genérico existente (numérico o checklist) con su propio estado de progreso. Gana soporte de edición con esta feature; sin cambios por lo demás.
- **Task (Tarea)**: Ítem pendiente existente con fecha límite y estado pendiente/hecho. Gana soporte de edición con esta feature; sin cambios por lo demás.
- **Habit (Hábito)**: Compromiso recurrente existente, con seguimiento vía cumplimientos diarios/periódicos. Gana soporte de edición con esta feature; sin cambios por lo demás.
- **SavingsGoal (Meta de ahorro)**: Meta de ahorro financiera existente, ligada a movimientos de dinero. Explícitamente fuera de alcance — esta feature no la toca.
- **Debt (Deuda/Préstamo simple)**: Registro de préstamo simple existente (prestado o pedido prestado, monto único, devoluciones acumuladas, tasa informativa). Sin cambios por esta feature; sigue conviviendo con la entidad nueva de abajo.
- **InstallmentLoan (Préstamo con cuotas)** *(nueva)*: Préstamo con un cronograma de cuotas fijo definido por la entidad financiera — monto, número de cuotas, monto de cuota, tasa opcional informativa, cuotas restantes, y un estado derivado saldado/activo (saldado cuando las cuotas restantes llegan a cero, replicando `Debt`).
- **InstallmentPayment (Pago de préstamo con cuotas)** *(nueva)*: Registro fechado de un pago de cuota individual o de un pago a capital/adelanto contra un `InstallmentLoan` — fecha, monto, y para los pagos a capital/adelanto, si redujo el plazo o el monto de cuota y el valor resultante que ingresó el usuario. Es lo que hace que el historial de pagos de un préstamo sea revisable, y no solo sus contadores actuales.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En vista mobile, la navegación principal muestra como máximo 5 destinos, y el 100% de las secciones antes alcanzables desde la barra de 9 destinos siguen siendo alcanzables en como máximo 2 toques.
- **SC-002**: El usuario puede editar una Meta, Tarea o Hábito antes no editable, sin borrarla y volver a crearla — 0% de capacidad de edición hoy, 100% después de lanzada esta feature.
- **SC-003**: Un usuario que registra un préstamo con cuotas ve el monto, número de cuotas, monto de cuota y tasa exactos que ingresó reflejados sin ninguna discrepancia respecto de lo que indica su entidad financiera.
- **SC-004**: El 100% de los selectores de opción única de la aplicación se renderizan usando el mismo componente visual compartido, sin que quede ningún selector nativo del navegador en las pantallas auditadas.
- **SC-005**: Un usuario puede distinguir, sin ayuda externa, dónde ir para agregar algo nuevo versus dónde ir para revisar lo pendiente — medido por que el usuario ubica la página correcta (Crear vs. Control) en el primer intento durante una prueba de usabilidad.

## Assumptions

- La moneda sigue siendo exclusivamente soles peruanos (PEN), consistente con el resto de la app; los montos de préstamos con cuotas se guardan como centavos enteros, igual que todos los demás campos de dinero.
- Ninguna de las cuatro historias requiere una dependencia runtime nueva; se reutilizan las primitivas de UI existentes (el componente de selector compartido) y la infraestructura offline-first/sync ya existente.
- El "hoy" de la agenda de tareas/hábitos de la superficie Control se evalúa en la hora local del dispositivo del usuario, consistente con cómo se evalúan las fechas límite y los horarios de hábitos en el resto de la app.
- El conjunto exacto de destinos ubicados en la barra fija de navegación versus en "Más" (Resumen, Movimientos, Control, Préstamos fijos; Análisis, Metas de ahorro, Espacio, Crear, Ajustes bajo "Más") es una decisión de diseño tomada durante la sesión de clarificación con el usuario, y se trata como input ya resuelto de esta spec, no como pregunta abierta.
- Esta feature es independiente del bug de integridad de datos de wizard/sync, y no lo incluye — ese bug se corrigió aparte, como hotfix fuera de spec-kit.
