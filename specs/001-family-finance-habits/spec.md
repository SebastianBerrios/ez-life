# Feature Specification: Finanzas familiares, préstamos y hábitos motivacionales

**Feature Branch**: `001-family-finance-habits`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Crear la spec para la siguiente feature de ez-life: finanzas personales/familiares con distribución adaptable, préstamos, espacio compartido, y hábitos/metas/tareas motivacionales." (ver contexto completo y decisiones de la sesión de grilling en el historial del proyecto)

## Clarifications

### Session 2026-09-17

- Q: ¿El código/link de invitación a un espacio compartido debería expirar después de un tiempo, o queda válido indefinidamente hasta que alguien lo canjea (o el creador lo revoca a mano)? → A: Expira automáticamente a las 24-48hs de creado.
- Q: ¿Quién envía la invitación al otro miembro — la app la manda por sí misma (ej. email), o el link/código se comparte manualmente por el canal que el usuario prefiera? → A: El usuario lo comparte manualmente por el canal que prefiera; la app no envía nada por sí misma.
- Q: Cuando un gasto compartido se divide por porcentaje y el redondeo a centavos deja un resto, ¿a quién se le asigna el centavo sobrante? → A: Al miembro que registró el gasto.
- Q: Para un hábito en modo "frecuencia libre" (racha medida en semanas, no en días), ¿cómo se gana y qué protege un comodín? → A: Se gana 1 comodín por cada 7 cumplimientos individuales (no por racha de semanas), y un comodín perdona un cumplimiento faltante dentro de una semana, permitiendo que esa semana igual cuente para la racha.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar y saldar préstamos personales (Priority: P1)

Un usuario le presta plata a un amigo, o pide plata prestada, y quiere llevar el registro de esa deuda hasta que se salde — con la opción de devoluciones parciales, no todo de una.

**Why this priority**: Es la extensión más simple e independiente sobre el modelo financiero existente; no depende de multi-usuario ni de ningún otro módulo nuevo, y ya aporta valor por sí sola.

**Independent Test**: Se puede probar registrando un préstamo (en cualquiera de las dos direcciones), agregando una devolución parcial, y verificando que el saldo pendiente se actualiza correctamente sin generar ningún movimiento de ingreso/egreso.

**Acceptance Scenarios**:

1. **Given** el usuario abre el registro de préstamos, **When** carga un préstamo que le hizo a otra persona con monto y fecha de vencimiento opcional, **Then** el préstamo aparece con saldo pendiente igual al monto total y una notificación programada para antes del vencimiento.
2. **Given** un préstamo con saldo pendiente, **When** el usuario registra una devolución parcial, **Then** el saldo pendiente se reduce en ese monto y el préstamo sigue abierto hasta llegar a cero.
3. **Given** un préstamo saldado por completo, **When** el usuario lo marca como pagado, **Then** se guarda un registro de liquidación (fecha y monto) y NO se crea ningún movimiento de ingreso/egreso en la distribución personal.

---

### User Story 2 - Crear un espacio financiero compartido y unirse a él (Priority: P1)

Una pareja o familia quiere tener un espacio donde registrar en conjunto sus ingresos y egresos compartidos, sin que "estar autenticado en ez-life" alcance para entrar — hay que ser invitado.

**Why this priority**: Es el prerrequisito de toda la funcionalidad familiar (gastos compartidos, cálculo de deuda, permisos); sin esto no hay nada más que construir en esa rama.

**Independent Test**: Se puede probar creando un espacio, generando una invitación, y verificando que un segundo usuario autenticado que canjea esa invitación pasa a ser miembro — mientras que un tercer usuario autenticado sin invitación no puede ver ni acceder al espacio.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** crea un espacio financiero compartido, **Then** queda como su único miembro y puede generar un código/link de invitación.
2. **Given** un código de invitación válido, **When** otro usuario autenticado lo canjea, **Then** pasa a ser miembro del espacio de inmediato, sin rol especial por sobre los demás miembros.
3. **Given** un usuario autenticado que nunca canjeó una invitación a ese espacio, **When** intenta acceder a los datos del espacio, **Then** el sistema se lo niega — estar autenticado no es suficiente.

---

### User Story 3 - Registrar gastos/ingresos compartidos y ver quién le debe a quién (Priority: P1)

Dentro de un espacio compartido, los miembros registran gastos e ingresos conjuntos indicando cuánto puso o le corresponde a cada uno (por porcentaje o por monto fijo), y el sistema calcula automáticamente el saldo entre ellos.

**Why this priority**: Es el valor central de "finanzas familiares" — sin el cálculo automático de deuda, el espacio compartido es solo una lista de gastos sin el beneficio real que se buscaba.

**Independent Test**: Se puede probar registrando un gasto compartido donde un miembro puso más de lo que le correspondía, y verificando que el sistema muestra correctamente cuánto le debe el otro miembro, sin que nadie tenga que calcularlo a mano.

**Acceptance Scenarios**:

1. **Given** un espacio con dos miembros, **When** uno de ellos registra un gasto compartido con un split 50/50 pero lo paga completo de su bolsillo, **Then** el sistema calcula automáticamente que el otro miembro le debe la mitad del monto.
2. **Given** un gasto compartido recién registrado, **When** se guarda, **Then** se genera automáticamente un movimiento personal enlazado en la distribución de cada miembro, según su parte, y ese movimiento no puede editarse ni borrarse fuera del gasto compartido.
3. **Given** ambos miembros conectados al mismo tiempo, **When** uno registra un gasto compartido, **Then** el otro lo ve reflejado sin necesidad de una acción manual de actualización.
4. **Given** un miembro sin la app abierta, **When** el otro miembro registra un gasto compartido, **Then** recibe una notificación al respecto la próxima vez que interactúa con la app.
5. **Given** el espacio en su modo de permisos por defecto, **When** un miembro intenta editar o borrar un gasto cargado por otro miembro, **Then** el sistema lo impide, salvo que el espacio esté en "modo abierto".
6. **Given** un miembro con deudas pendientes dentro del espacio, **When** decide abandonar el espacio, **Then** puede hacerlo sin restricción y la deuda queda congelada y visible para ambas partes en su historial.

---

### User Story 4 - Crear y sostener hábitos con racha y comodines (Priority: P2)

Un usuario quiere construir un hábito recurrente (por días fijos de la semana o por una frecuencia libre) y que la app lo motive a seguir aunque falle algún día, en vez de simplemente castigarlo con una racha rota.

**Why this priority**: Es el corazón del módulo motivacional; depende únicamente del usuario individual (no del espacio compartido), por lo que puede probarse y entregarse en paralelo a las historias de espacio familiar.

**Independent Test**: Se puede probar creando un hábito, marcándolo cumplido varios días seguidos, dejándolo sin cumplir un día, y verificando que un comodín ganado evita que la racha se rompa.

**Acceptance Scenarios**:

1. **Given** un usuario creando un hábito nuevo, **When** elige el modo "días fijos de la semana", **Then** puede seleccionar cualquier combinación de días y el hábito solo pide cumplimiento esos días.
2. **Given** un hábito en modo "frecuencia libre" con objetivo de N veces por semana, **When** el usuario cumple N veces en la semana en curso, **Then** la racha avanza en una unidad al cierre de esa semana.
3. **Given** un hábito de días fijos con 7 días consecutivos de cumplimiento, **When** se completa el séptimo día, **Then** el usuario gana un comodín (hasta un máximo de 3 acumulados).
4. **Given** un usuario con al menos un comodín disponible en un hábito de días fijos, **When** deja de cumplir el hábito un día, **Then** puede usar un comodín para que la racha no se rompa.
5. **Given** un hábito de frecuencia libre, **When** el usuario acumula 7 cumplimientos individuales en total, **Then** gana un comodín (hasta el mismo máximo de 3).
6. **Given** una semana donde a un hábito de frecuencia libre le faltó un cumplimiento para alcanzar el objetivo, **When** el usuario canjea un comodín, **Then** esa semana cuenta como cumplida para la racha.

---

### User Story 5 - Definir metas y tareas puntuales (Priority: P2)

Un usuario quiere registrar objetivos que se cumplen una sola vez (numéricos o por checklist) y tareas puntuales con fecha límite, sin que ninguno de los dos tenga que ver necesariamente con dinero.

**Why this priority**: Complementa el módulo de hábitos con dos tipos de seguimiento distintos; se puede construir y probar de forma independiente porque no depende de rachas ni de espacios compartidos.

**Independent Test**: Se puede probar creando una meta numérica, avanzando su contador hasta el objetivo, y por separado creando una tarea con fecha límite y marcándola como hecha.

**Acceptance Scenarios**:

1. **Given** un usuario creando una meta, **When** elige el tipo numérico, **Then** puede definir un valor objetivo y registrar avances parciales hasta alcanzarlo.
2. **Given** un usuario creando una meta, **When** elige el tipo checklist, **Then** puede definir una lista de hitos y la meta se considera cumplida cuando todos están marcados.
3. **Given** una tarea puntual con fecha límite, **When** el usuario la marca como hecha, **Then** la tarea se archiva y deja de aparecer entre las pendientes.

---

### User Story 6 - Recibir recordatorios de todo lo anterior (Priority: P2)

El usuario quiere que la misma vía de notificaciones que ya usa la app (RF-16) le avise sobre vencimientos de préstamos, hábitos y tareas próximas a vencer, rachas en riesgo, y actividad en su espacio compartido — sin un sistema de recordatorios paralelo.

**Why this priority**: Sin esto, buena parte del valor motivacional de las historias 1, 4 y 5 se pierde porque el usuario no se entera a tiempo; depende de que esas entidades ya existan.

**Independent Test**: Se puede probar generando cada condición (vencimiento próximo, racha en riesgo, tarea próxima a vencer, actividad compartida) y verificando que aparece como una notificación dentro del mismo centro de notificaciones existente.

**Acceptance Scenarios**:

1. **Given** un préstamo próximo a vencer, **When** se acerca la fecha, **Then** el usuario recibe una notificación del tipo correspondiente.
2. **Given** una racha de hábito sin comodines disponibles y un día sin cumplir, **When** el día está por cerrarse, **Then** el usuario recibe una notificación de racha en riesgo.
3. **Given** una tarea próxima a su fecha límite, **When** se acerca esa fecha, **Then** el usuario recibe un recordatorio.

---

### User Story 7 - Configurar la app desde cero con el wizard, y ver el progreso en los dashboards (Priority: P3)

Un usuario nuevo configura su distribución financiera personal en un wizard de arranque simple, y luego navega dos dashboards separados: uno financiero y otro de hábitos/motivación.

**Why this priority**: El wizard y los dashboards son la capa de presentación sobre todo lo anterior; tiene más valor una vez que las historias P1/P2 ya existen, porque si no, no hay datos que mostrar ni configurar.

**Independent Test**: Se puede probar completando el wizard con la plantilla 50/30/20 precargada, editándola, y luego navegando a cada dashboard por separado para confirmar que muestra la información esperada.

**Acceptance Scenarios**:

1. **Given** un usuario nuevo, **When** llega al wizard de arranque, **Then** ve una plantilla 50/30/20 editable con categorías de ejemplo precargadas en los tres buckets, y puede editarlas o borrarlas antes de continuar.
2. **Given** un usuario que terminó el wizard, **When** entra por primera vez a la sección de espacio compartido o a la de hábitos/metas, **Then** ve su propio flujo de configuración inicial para esa sección, separado del wizard general.
3. **Given** un usuario con datos financieros y de hábitos cargados, **When** entra al dashboard financiero, **Then** ve su distribución presupuestada vs. real, ingresos/egresos y deudas activas — sin mezclarse con información de hábitos.
4. **Given** ese mismo usuario, **When** entra al dashboard de hábitos/motivación, **Then** ve su racha actual y su porcentaje de cumplimiento en ventana móvil de 30 días por hábito, el progreso de sus metas activas, y sus tareas próximas a vencer.

---

### Edge Cases

- ¿Qué pasa si los porcentajes o montos de un split de gasto compartido no suman el 100% (o el monto total)? El sistema debe impedir guardar el gasto hasta que la distribución sea consistente.
- ¿Qué pasa si el único miembro restante de un espacio compartido decide abandonarlo? El espacio queda archivado (sin miembros activos), sin necesidad de una acción explícita de "eliminar espacio".
- ¿Qué pasa si se borra un gasto compartido que ya generó una deuda? El saldo entre los miembros involucrados se recalcula automáticamente para reflejar la eliminación.
- ¿Qué pasa si un usuario intenta canjear un código de invitación ya usado o vencido? El sistema lo rechaza con un mensaje claro, sin otorgar membresía.
- ¿Qué pasa si un hábito de frecuencia libre define un objetivo de 0 veces por semana, o uno de días fijos no selecciona ningún día? El sistema no permite guardar un hábito sin al menos una condición de cumplimiento válida.
- ¿Qué pasa si dos miembros cambian el modo de permisos del espacio casi al mismo tiempo estando ambos offline? Se resuelve con la misma política de "el último cambio sincronizado gana" que ya usa el resto de la app.

## Requirements *(mandatory)*

### Functional Requirements

**Préstamos y deudas**

- **FR-001**: El sistema DEBE permitir registrar una deuda en cualquiera de las dos direcciones: dinero que el usuario prestó a otra persona, o dinero que el usuario pidió prestado.
- **FR-002**: Un registro de deuda DEBE admitir una fecha de vencimiento opcional y una tasa de interés opcional, ambas informativas.
- **FR-003**: El sistema DEBE permitir registrar devoluciones parciales contra una deuda, sin exigir el pago total de una sola vez.
- **FR-004**: Marcar una deuda como saldada DEBE crear únicamente un registro de liquidación (fecha y monto) y NUNCA un movimiento de ingreso o egreso.
- **FR-005**: El sistema DEBE notificar al usuario cuando se acerca la fecha de vencimiento de una deuda con fecha definida.

**Espacio financiero compartido**

- **FR-006**: El sistema DEBE permitir crear un espacio financiero compartido y generar un código o link de invitación canjeable, que expira automáticamente entre 24 y 48 horas después de creado si nadie lo canjea. El envío de ese código/link al invitado es responsabilidad del usuario (por el canal que prefiera, fuera de la app) — el sistema NO envía la invitación por sí mismo (ej. no hay envío de email).
- **FR-007**: Un usuario DEBE convertirse en miembro de un espacio compartido únicamente al canjear una invitación estando autenticado; estar autenticado por sí solo NUNCA otorga membresía.
- **FR-008**: Un espacio compartido DEBE admitir dos o más miembros (la pareja, con dos miembros, es el caso base; no hay un límite fijo de dos).
- **FR-009**: Los miembros DEBEN poder registrar ingresos y egresos compartidos, indicando la parte de cada miembro por porcentaje o por monto fijo. Cuando un split por porcentaje deja un resto de centavos por el redondeo a enteros, ese resto se asigna íntegramente al miembro que registró el movimiento.
- **FR-010**: El sistema DEBE calcular automáticamente, entre cada par de miembros, quién le debe a quién a partir de los movimientos compartidos donde los aportes fueron desiguales.
- **FR-011**: Un gasto compartido DEBE generar automáticamente un movimiento personal enlazado para cada miembro según su parte; ese movimiento enlazado solo puede editarse o eliminarse a través del gasto compartido que lo originó.
- **FR-012**: Los movimientos compartidos DEBEN contarse dentro de la distribución presupuestaria personal de cada miembro.
- **FR-013**: El sistema DEBE reflejar los cambios de un espacio compartido a los demás miembros sin necesidad de una actualización manual cuando todos están conectados, y DEBE recurrir a la sincronización periódica existente cuando algún miembro está desconectado.
- **FR-014**: Un miembro DEBE recibir una notificación cuando otro miembro registra un movimiento compartido mientras no estaba activo en la app.
- **FR-015**: Un espacio compartido DEBE admitir dos modos de permisos — cada miembro edita/elimina solo lo propio (modo por defecto), o cualquier miembro edita/elimina cualquier movimiento ("modo abierto") — y cualquier miembro DEBE poder cambiar el modo activo.
- **FR-016**: Un usuario DEBE poder abandonar un espacio compartido en cualquier momento, incluso con deudas pendientes; las deudas pendientes DEBEN seguir siendo visibles para las partes involucradas después de la salida.

**Hábitos, metas y tareas**

- **FR-017**: El sistema DEBE permitir crear un hábito con horario de días fijos de la semana o con frecuencia libre (N veces por semana, cualquier día).
- **FR-018**: El sistema DEBE llevar una racha de cumplimiento por hábito: días programados consecutivos cumplidos para hábitos de días fijos, y semanas consecutivas donde se alcanzó el objetivo para hábitos de frecuencia libre.
- **FR-019**: En hábitos de días fijos, el usuario DEBE ganar un comodín de protección de racha por cada 7 días consecutivos de cumplimiento, hasta un máximo de 3 acumulados, canjeable para evitar que un día sin cumplir rompa la racha.
- **FR-019a**: En hábitos de frecuencia libre, el usuario DEBE ganar un comodín por cada 7 cumplimientos individuales acumulados (no por semanas de racha), hasta el mismo máximo de 3 acumulados. Un comodín canjeado en una semana donde faltó un cumplimiento para alcanzar el objetivo hace que esa semana cuente igual como cumplida para la racha.
- **FR-020**: El sistema DEBE permitir crear una meta con un contador numérico hacia un valor objetivo, o con una lista de hitos (checklist), independientemente de si involucra dinero.
- **FR-021**: El sistema DEBE permitir crear una tarea puntual con fecha límite y marcarla como hecha; una tarea completada DEBE archivarse sin repetirse.
- **FR-022**: El sistema DEBE enviar recordatorios de hábitos próximos, tareas por vencer y rachas en riesgo, utilizando el mecanismo de notificaciones existente.

**Onboarding y dashboards**

- **FR-023**: El wizard de configuración inicial DEBE permitir configurar la distribución presupuestaria personal partiendo de una plantilla 50/30/20 editable, con categorías de ejemplo precargadas en los tres buckets.
- **FR-024**: El sistema NO DEBE exigir la configuración del espacio compartido ni de hábitos/metas/tareas durante el wizard inicial; cada uno DEBE tener su propia configuración la primera vez que el usuario abre esa sección.
- **FR-025**: El sistema DEBE mostrar un dashboard financiero con distribución presupuestada vs. real por bucket, totales de ingresos/egresos, y deudas activas.
- **FR-026**: El sistema DEBE mostrar, en una sección separada del dashboard financiero, un dashboard de hábitos y motivación con racha actual y porcentaje de cumplimiento en ventana móvil de 30 días por hábito, progreso de metas activas, y tareas próximas a vencer.

### Key Entities *(include if feature involves data)*

- **Debt (Deuda/Préstamo)**: Obligación de dinero entre dos personas, con un origen (`manual` o generado por un gasto compartido), dirección, monto, estado de pagos parciales, y fecha de vencimiento/interés opcionales. Su liquidación es un registro contable, nunca un movimiento de ingreso/egreso.
- **SharedSpace (Espacio compartido)**: Agrupación de dos o más usuarios que comparten el registro de ingresos/egresos conjuntos y su modo de permisos. No tiene rol de administrador; todos los miembros son pares.
- **Membership (Membresía)**: Relación explícita entre un usuario y un espacio compartido, creada únicamente por canje de invitación — nunca implícita por autenticación.
- **SharedMovement (Movimiento compartido)**: Ingreso o egreso registrado dentro de un espacio compartido, con la parte de cada miembro (por porcentaje o monto fijo), que genera movimientos personales enlazados y puede originar una Debt entre miembros.
- **SharedInvite (Invitación)**: Código de invitación de corta vida asociado a un espacio compartido, con vencimiento automático (24-48hs) y canje de un solo uso; distinta de la Membership que genera al canjearse.
- **Habit (Hábito)**: Acción recurrente indefinida, con un modo de horario (días fijos o frecuencia libre), una racha de cumplimiento, y comodines de protección de racha.
- **HabitCompletion (Registro de cumplimiento)**: Marca de que un hábito se cumplió (o se cubrió con un comodín) en una fecha dada; es la base de datos sobre la que se calcula la racha y el otorgamiento de comodines de un Habit.
- **Goal (Meta)**: Objetivo medible que se cumple una sola vez, de tipo numérico (contador) o checklist (hitos), independiente de cualquier dato financiero.
- **Task (Tarea)**: Acción puntual con fecha límite que se completa una sola vez y se archiva.
- **Notification (extensión)**: Se agregan nuevos tipos (`loan_due_soon`, `shared_movement_added`, `habit_reminder`, `task_due`, `streak_at_risk`) al sistema de notificaciones ya existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede registrar un préstamo (en cualquier dirección) en menos de 30 segundos.
- **SC-002**: Un usuario puede crear un espacio compartido y lograr que otra persona se una en menos de 2 minutos desde que genera la invitación.
- **SC-003**: Cuando ambos miembros de un espacio compartido están conectados, un movimiento recién registrado por uno es visible para el otro en menos de 10 segundos, sin acción manual.
- **SC-004**: El 100% de los saldos de deuda dentro de un espacio compartido se calculan automáticamente, sin que el usuario tenga que hacer ninguna cuenta a mano.
- **SC-005**: Un usuario nuevo completa el wizard de configuración inicial en menos de 3 minutos.
- **SC-006**: Un usuario que falla uno o varios días en un hábito sigue viendo un indicador de progreso mayor a cero (no una racha reseteada a cero sin contexto) en el dashboard de hábitos.
- **SC-007**: Un usuario puede ver el estado completo de sus deudas activas (propias y de espacios compartidos) desde una única pantalla del dashboard financiero.

## Assumptions

- Toda la funcionalidad opera exclusivamente en soles peruanos (PEN) y con montos en centavos enteros, consistente con el resto de la app.
- La app nunca mueve dinero real ni se integra con una pasarela de pago; toda liquidación de deuda es un registro informativo de que algo se saldó fuera de la app.
- "Casi instantáneo" en el espacio compartido depende de que ambos miembros estén conectados al mismo tiempo; si alguno está offline, se aplica la misma cadencia de sincronización que ya usa el resto de la app.
- El interés de un préstamo, cuando se define, es informativo en esta versión — no se recalcula ni se acumula automáticamente con el tiempo.
- Un espacio compartido sin miembros activos (porque todos lo abandonaron) queda archivado automáticamente; no existe una acción explícita de "eliminar espacio" en esta versión.
- La semana de referencia para hábitos de frecuencia libre es la semana calendario (lunes a domingo).
- Los usuarios ya cuentan con una cuenta autenticada en ez-life antes de crear o unirse a un espacio compartido; el flujo de autenticación en sí no cambia con esta feature.
- No se agrega ningún proveedor de envío de email/SMS: compartir el código/link de invitación es responsabilidad manual del usuario, fuera de la app.
