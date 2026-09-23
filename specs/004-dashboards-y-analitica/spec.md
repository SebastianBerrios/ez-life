# Feature Specification: Dashboards y Analítica Interactiva

**Feature Branch**: `[004-dashboards-y-analitica]`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Rediseñar el Resumen y los dashboards de la app para que sean interactivos: indicadores de color, gráficos e informes en el Resumen; dashboards de hábitos/tareas/metas con gráficos y estadísticas; Movimientos con categoría y subcategoría visibles en la lista."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resumen interactivo con indicadores y gráficos (Priority: P1)

Como usuario, quiero que el Resumen me muestre de un vistazo, con colores y gráficos, qué tan
saludables están mis finanzas del mes — no solo números planos — para poder tomar decisiones sin
tener que interpretar tablas.

**Why this priority**: El Resumen es la pantalla que el usuario ve más seguido; es donde más valor
aporta una mejora visual, y de donde depende que perciba la app como útil en el día a día.

**Independent Test**: Con datos de movimientos e ingresos cargados, abrir el Resumen y verificar
que muestra al menos un indicador de color según cercanía a los límites 50/30/20, al menos un
gráfico, y una comparación contra el período anterior.

**Acceptance Scenarios**:

1. **Given** el usuario gastó más del límite de una categoría de distribución (ej. Gastos
   Esenciales), **When** abre el Resumen, **Then** ve un indicador de color (ej. rojo) señalando
   esa categoría como excedida.
2. **Given** hay movimientos registrados en el mes actual y en el anterior, **When** el usuario
   abre el Resumen, **Then** ve una comparación (ingresos, egresos, balance) entre ambos períodos.
3. **Given** hay movimientos categorizados, **When** el usuario abre el Resumen, **Then** ve un
   gráfico que representa la distribución de sus gastos.
4. **Given** el usuario abre el Resumen, **When** no cambia nada, **Then** ve por defecto la
   comparación entre el mes actual y el anterior; **When** elige un rango de fechas distinto,
   **Then** el Resumen recalcula la comparación para ese rango.

---

### User Story 2 - Dashboards interactivos de hábitos, tareas y metas (Priority: P2)

Como usuario, quiero ver estadísticas y gráficos de mis hábitos, tareas y metas — no solo una
lista con su estado actual — para entender mi progreso a lo largo del tiempo.

**Why this priority**: Depende de que 003-fixes-criticos ya haya resuelto la visibilidad básica;
esta historia agrega el valor analítico encima de esa base.

**Independent Test**: Con un hábito con varios días de historial, varias tareas completadas/
vencidas, y una meta con progreso parcial, abrir cada dashboard y verificar que cada uno muestra
una representación gráfica de su estadística clave (racha en el tiempo, cumplimiento a tiempo vs
vencido, progreso de meta).

**Acceptance Scenarios**:

1. **Given** un hábito con historial de cumplimiento, **When** el usuario abre su dashboard,
   **Then** ve un gráfico de la evolución de su racha en el tiempo, con los últimos 30 días como
   rango por defecto y la posibilidad de cambiarlo.
2. **Given** tareas completadas a tiempo y tareas vencidas, **When** el usuario abre el dashboard
   de tareas, **Then** ve la proporción de cumplimiento a tiempo vs vencidas representada
   visualmente.
3. **Given** una meta con progreso parcial, **When** el usuario abre el dashboard de metas,
   **Then** ve su progreso representado gráficamente (ej. barra o círculo de progreso).

---

### User Story 3 - Movimientos con categoría y subcategoría visibles (Priority: P3)

Como usuario, quiero ver la categoría y subcategoría de cada movimiento directamente en la lista
de Movimientos, sin tener que abrir un detalle aparte, para identificar rápidamente en qué gasté.

**Why this priority**: Es una mejora de detalle puntual, de menor alcance que las otras dos, e
independiente de ellas.

**Independent Test**: Crear movimientos con distintas categorías y subcategorías y verificar que
ambas son visibles en la lista de Movimientos sin interacción adicional.

**Acceptance Scenarios**:

1. **Given** un movimiento tiene categoría y subcategoría asignadas, **When** el usuario abre
   Movimientos, **Then** ve ambas mostradas junto al resto de los datos del movimiento en la
   lista.

---

### Edge Cases

- Si un hábito, tarea o meta no tiene suficiente historial para graficar (ej. recién creado), el
  dashboard muestra un estado vacío amigable en vez de un gráfico roto o vacío sin explicación.
- Si un movimiento referencia una categoría o subcategoría que fue eliminada después de creado el
  movimiento, la lista de Movimientos muestra el nombre vigente al momento de creación si quedó
  guardado, o "Sin categoría" si ya no hay ningún dato asociado.
- Si no hay datos del período anterior (ej. es el primer mes de uso de la app), el Resumen no
  muestra una comparación period-over-period rota — indica que no hay datos previos disponibles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El Resumen DEBE mostrar al menos un indicador visual de color que refleje qué tan
  cerca está el usuario de sus límites de distribución de gasto (50/30/20).
- **FR-002**: El Resumen DEBE mostrar al menos un gráfico que represente la distribución de gastos
  del usuario por categoría.
- **FR-003**: El Resumen DEBE mostrar una comparación entre el período actual y el período
  anterior para ingresos, egresos y balance, cuando exista información del período anterior.
- **FR-004**: El dashboard de Hábitos DEBE mostrar la evolución de la racha de cada hábito a lo
  largo del tiempo mediante una representación gráfica.
- **FR-005**: El dashboard de Tareas DEBE mostrar la proporción de tareas completadas a tiempo
  frente a vencidas mediante una representación gráfica o indicador visual.
- **FR-006**: El dashboard de Metas DEBE mostrar el progreso de cada meta mediante una
  representación gráfica (barra de progreso o equivalente).
- **FR-007**: La vista de Movimientos DEBE mostrar la categoría de cada movimiento directamente en
  la lista, sin requerir abrir un detalle adicional.
- **FR-008**: La vista de Movimientos DEBE mostrar la subcategoría de cada movimiento, cuando
  exista, directamente en la lista.
- **FR-009**: Los cálculos y agregaciones que alimentan el Resumen y los dashboards (porcentajes,
  series de tiempo, comparaciones entre períodos) DEBEN producirse en la capa de lógica de negocio
  (`core/use-cases`), nunca directamente en componentes de `presentation`.
- **FR-010**: Los gráficos e informes históricos (racha de hábitos, evolución de balance,
  comparación de períodos) DEBEN mostrar por defecto una ventana fija razonable (mes actual vs
  mes anterior para el Resumen; últimos 30 días para la racha de hábitos), y el usuario DEBE poder
  cambiar ese rango manualmente cuando quiera ver un período distinto.

### Key Entities *(include if feature involves data)*

- No se introducen entidades nuevas. Este spec agrega vistas de agregación y visualización sobre
  entidades ya existentes: `Movement` (incluyendo su `category`/`subcategory`), `DistributionCategory`,
  `Habit`/`HabitCompletion`, `Task`, `Goal`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los movimientos en el Historial muestran su categoría (y subcategoría
  cuando aplica) visible sin necesidad de abrir un detalle adicional.
- **SC-002**: Un usuario puede identificar, con un solo vistazo al Resumen y sin hacer cálculos
  manuales, si está por encima o por debajo de sus límites de distribución de gasto.
- **SC-003**: Un usuario puede ver la evolución de al menos un indicador (racha de hábito, balance,
  o progreso de meta) representada gráficamente dentro de la propia app, sin exportar datos ni usar
  una herramienta externa.
- **SC-004**: Un usuario puede identificar, con un vistazo al dashboard de tareas, qué proporción
  de sus tareas se completaron a tiempo frente a las que vencieron.

## Assumptions

- El indicador de color del Resumen se basa en las categorías de distribución (50/30/20) ya
  existentes en el dominio (`DistributionCategory`), no en presupuestos personalizados nuevos por
  categoría — eso queda fuera de alcance salvo pedido explícito futuro.
- Cuando un movimiento referencia una categoría/subcategoría eliminada o renombrada después de su
  creación, se muestra el nombre vigente al momento de la creación si quedó registrado, o "Sin
  categoría" en caso contrario — no se implementa versionado histórico de categorías en este spec.
- Este spec no decide la librería de gráficos a usar ni su justificación frente a los Principios I
  y VII de la constitución; esa decisión se toma en `/speckit-plan`.
- Este spec depende de que `003-fixes-criticos` ya haya resuelto la reactividad de la UI (los
  datos deben poder graficarse sin refresh manual) y la visibilidad básica de hábitos en Control —
  los dashboards aquí descritos se construyen sobre esa base, no la reemplazan.
