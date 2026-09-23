# Feature Specification: UX de Creación y Tareas Recurrentes

**Feature Branch**: `[005-habitos-tareas-metas-ux]`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "La UI de creación de Hábitos, Tareas y Metas se ve aburrida y sin detalles. Las Tareas deberían poder ser repetitivas (ej. cada sábado, o N días a la semana). Cambiar 'Metas' a 'Metas de Ahorro' en el sidebar para no confundirla con las otras Metas."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tareas recurrentes (Priority: P1)

Como usuario, quiero poder marcar una tarea como repetitiva — por días específicos de la semana
(ej. "cada sábado") o por una cantidad de veces por semana — para no tener que recrearla a mano
cada vez.

**Why this priority**: Es la única historia de esta spec que agrega comportamiento de negocio
nuevo (no solo pulido visual); las otras dos son mejoras de UI y de una etiqueta.

**Independent Test**: Crear una tarea recurrente con días fijos (ej. sábado) y verificar que, tras
completar o pasar la fecha de la ocurrencia actual, aparece automáticamente la siguiente ocurrencia
en la fecha correspondiente, sin acumular racha ni usar tokens de protección.

**Acceptance Scenarios**:

1. **Given** el usuario crea una tarea con recurrencia "días fijos: sábado", **When** llega la
   siguiente ocurrencia según el calendario, **Then** el sistema genera una nueva instancia de la
   tarea con esa fecha límite.
2. **Given** el usuario crea una tarea con recurrencia "3 veces por semana", **When** completa una
   ocurrencia, **Then** el sistema no le exige repetirla el mismo día pero sigue generando
   ocurrencias futuras hasta cumplir la frecuencia semanal pactada.
3. **Given** una tarea recurrente, **When** el usuario cancela su recurrencia, **Then** no se
   generan más ocurrencias futuras, pero las ya generadas permanecen sin cambios.
4. **Given** una tarea recurrente, **When** el usuario la completa o la deja vencer, **Then** esa
   ocurrencia individual queda marcada como hecha o vencida — la tarea NUNCA acumula una racha ni
   usa tokens de protección (Principio XIII: Task y Habit tienen semántica de completado distinta).

---

### User Story 2 - UI de creación más detallada para Hábitos, Tareas y Metas (Priority: P2)

Como usuario, quiero poder agregar contexto adicional al crear un hábito, una tarea o una meta
(no solo el nombre y lo mínimo indispensable), para que cada registro refleje mejor lo que
realmente quiero lograr.

**Why this priority**: Es una mejora de calidad de vida transversal, independiente de la
recurrencia de tareas, y de menor impacto funcional que US1.

**Independent Test**: Abrir el formulario de creación de un hábito, una tarea y una meta, y
verificar que cada uno permite agregar al menos un campo descriptivo opcional además de los campos
mínimos actuales.

**Acceptance Scenarios**:

1. **Given** el usuario crea un hábito, **When** completa el formulario, **Then** puede
   opcionalmente asignarle un ícono/emoji identificador además del nombre y el schedule.
2. **Given** el usuario crea una tarea, **When** completa el formulario, **Then** puede
   opcionalmente agregar una descripción/nota además del título y la fecha límite.
3. **Given** el usuario crea una meta, **When** completa el formulario, **Then** puede
   opcionalmente agregar una descripción además de los campos ya existentes (nombre, tipo,
   objetivo/milestones).

---

### User Story 3 - Renombrar "Metas" a "Metas de Ahorro" en el sidebar (Priority: P3)

Como usuario, quiero que el ítem del menú que lista mis metas de ahorro se llame "Metas de
Ahorro", para no confundirlo con las Metas (objetivos numéricos/checklist) que veo en Control.

**Why this priority**: Es un cambio de una sola etiqueta, sin lógica de negocio ni riesgo, e
independiente de las otras dos historias.

**Independent Test**: Abrir la navegación de la app y verificar que el ítem que antes decía
"Metas" (y que lista `SavingsGoal`) ahora dice "Metas de Ahorro".

**Acceptance Scenarios**:

1. **Given** el usuario abre la navegación principal, **When** busca el ítem de metas de ahorro,
   **Then** lo encuentra etiquetado "Metas de Ahorro", distinto de "Metas" en Control.

---

### Edge Cases

- Si el usuario edita el patrón de recurrencia de una tarea, el cambio aplica solo a las
  ocurrencias futuras que se generen desde ese momento — las ya generadas no se alteran
  retroactivamente.
- Si el usuario elimina una tarea recurrente completa (no solo cancela la recurrencia), se
  eliminan también sus ocurrencias futuras no completadas; las ya completadas quedan en el
  historial.
- Si el usuario no completa ninguna ocurrencia de una tarea de frecuencia semanal antes de que
  termine la semana, el sistema no bloquea ni penaliza — simplemente no se cumplió esa semana,
  sin efecto de racha (a diferencia de un Habit).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Los usuarios DEBEN poder marcar una Tarea como recurrente, especificando un patrón
  de días fijos de la semana (ej. "sábado") o una cantidad objetivo de veces por semana.
- **FR-002**: Una Tarea recurrente NUNCA DEBE acumular una racha (streak) ni usar tokens de
  protección de racha — cada ocurrencia se marca como pendiente/hecha/vencida de forma
  independiente, preservando la semántica de completado distinta entre `Task` y `Habit`
  (Constitución, Principio XIII).
- **FR-003**: La siguiente ocurrencia de una tarea recurrente DEBE generarse automáticamente según
  su patrón de calendario (día fijo o frecuencia semanal), sin importar si la ocurrencia anterior
  fue completada, quedó pendiente o venció.
- **FR-004**: Los usuarios DEBEN poder cancelar la recurrencia de una tarea; al hacerlo, no se
  generan más ocurrencias futuras y las ya existentes permanecen sin cambios.
- **FR-005**: Editar el patrón de recurrencia de una tarea DEBE aplicar solo a las ocurrencias
  futuras generadas desde ese momento, nunca a las ya generadas.
- **FR-006**: El formulario de creación de Hábitos DEBE permitir asignar opcionalmente un
  ícono/emoji identificador, además del nombre y el schedule existentes.
- **FR-007**: El formulario de creación de Tareas DEBE permitir agregar opcionalmente una
  descripción/nota, además del título y la fecha límite existentes.
- **FR-008**: El formulario de creación de Metas DEBE permitir agregar opcionalmente una
  descripción, además de los campos existentes (nombre, tipo, objetivo/milestones).
- **FR-009**: El ítem de navegación actualmente etiquetado "Metas" que lista los `SavingsGoal`
  del usuario DEBE renombrarse a "Metas de Ahorro", para distinguirlo del listado de `Goal`
  (metas numéricas/checklist) visible en Control.

### Key Entities *(include if feature involves data)*

- **Task**: gana un patrón de recurrencia opcional (días fijos o frecuencia semanal, análogo al
  `schedule_mode`/`fixed_days`/`frequency_target` de `Habit`) y un campo de descripción opcional.
  Su semántica de completado por ocurrencia (pendiente/hecha, sin racha) no cambia.
- **Habit**: gana un campo opcional de ícono/emoji identificador; su modelo de `schedule_mode` no
  cambia.
- **Goal**: gana un campo de descripción opcional; su modelo existente (numérico/checklist) no
  cambia.
- **SavingsGoal**: sin cambios de datos; solo cambia la etiqueta de navegación bajo la que se
  accede a su listado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los usuarios pueden crear una tarea recurrente y ver generarse automáticamente sus
  ocurrencias futuras según el patrón elegido, sin tener que recrearla manualmente cada vez.
- **SC-002**: El 100% de las tareas recurrentes se completan o vencen ocurrencia por ocurrencia,
  sin generar nunca una racha visible ni consumir tokens de protección.
- **SC-003**: Los formularios de creación de Hábitos, Tareas y Metas soportan cada uno al menos un
  campo descriptivo opcional adicional a sus campos mínimos actuales.
- **SC-004**: El 100% de los usuarios que buscan sus metas de ahorro en la navegación las
  encuentran bajo la etiqueta "Metas de Ahorro", sin confundirlas con las metas de Control.

## Assumptions

- La recurrencia de Tareas reutiliza el mismo lenguaje de patrón que `Habit` (días fijos o
  frecuencia semanal) mostrando consistencia entre ambas funcionalidades, pero como un patrón de
  configuración propio de `Task` — según Principio XIII, `Task` y `Habit` permanecen entidades de
  dominio separadas; no se fusionan.
- El ícono/emoji de Hábitos y la descripción de Tareas/Metas son campos opcionales, sin taxonomía
  cerrada de iconos predefinida en este spec — esa decisión (lista de iconos disponibles) se toma
  en `/speckit-plan`.
- El renombre de "Metas" a "Metas de Ahorro" es un cambio de copy/etiqueta únicamente; no afecta
  datos, rutas internas ni el modelo `SavingsGoal`.
