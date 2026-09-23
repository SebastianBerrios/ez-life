# Research: 004-dashboards-y-analitica

## 1. Librería de gráficos

- **Decision**: adoptar `recharts`.
- **Rationale**: no existe ninguna librería de gráficos en el proyecto (`package.json` sin
  recharts/chart.js/d3/nivo/victory, `find *chart*` sin resultados). El spec pide al menos 4 tipos
  de visualización distintos con interactividad (barra/torta para distribución de gastos, línea
  para evolución de racha y de balance, indicador de cumplimiento de tareas, progreso de metas) —
  hand-rollear SVG a mano para los cuatro superaría varias veces el umbral de "menos de 50 líneas
  de valor" del Principio VII, reimplementando problemas ya resueltos (responsive, accesibilidad,
  tooltips). `recharts` es composable en JSX (encaja con el estilo de componentes ya usado),
  liviana, sin SSR issues (los componentes de gráfico son `'use client'`, igual que el resto de
  `presentation/`), y sus nodos son SVG reales — testeables con Testing Library igual que el resto
  de la suite, a diferencia de una librería basada en `<canvas>`.
- **Alternatives considered**: SVG a mano (rechazado, 4+ tipos de gráfico exceden el presupuesto de
  simplicidad); `chart.js` + `react-chartjs-2` (rechazado — API imperativa sobre `<canvas>`, más
  fricción para testear con Testing Library que los nodos SVG que expone `recharts`).

## 2. Distribución de gastos por categoría (FR-002)

- **Decision**: reusar `calculateCategoryBreakdown` (`src/core/use-cases/calculateCategoryBreakdown.ts:44-78`),
  que YA existe y YA construye el árbol categoría→subcategoría→monto completo, pero hoy no se
  invoca desde ningún lado. Se alimenta al gráfico de distribución sin escribir lógica nueva.
- **Rationale**: evita duplicar lógica de negocio (Principio III); es exactamente el shape que
  necesita un gráfico de torta/barras por categoría.
- **Alternatives considered**: ninguna — la función ya resuelve el problema, solo faltaba
  conectarla a una vista.

## 3. Comparación mes actual vs. anterior (FR-003)

- **Decision**: nuevo use-case puro `src/core/use-cases/compareMonthlyPeriods.ts`, firma
  `compareMonthlyPeriods(currentMovements: Movement[], previousMovements: Movement[]): PeriodComparison`
  (ver data-model.md), calculando ingreso/egreso/balance de cada período y su delta.
- **Rationale**: no existe ningún use-case de comparación entre períodos hoy; `Dashboard.tsx` solo
  carga un mes a la vez (`refDate`). Debe ser una función pura para respetar Principio III — la UI
  solo la invoca con los dos arrays de movimientos ya cargados.
- **Alternatives considered**: calcular la comparación inline en `Dashboard.tsx` (rechazado, viola
  Principio III — es lógica de negocio, no de presentación).

## 4. Evolución de racha de hábito en el tiempo (FR-004)

- **Decision**: extender `src/core/use-cases/evaluateHabitStreak.ts` (donde ya vive
  `isHabitScheduledToday` y el cálculo de racha actual) con una función
  `calculateHabitStreakHistory(habit, completions, range): { date: Date; completed: boolean }[]`.
- **Rationale**: mismo archivo que ya es dueño de la lógica pura de hábitos — evita esparcir lógica
  de streak en dos lugares. Es una extensión natural del cálculo de racha actual (mismo dato de
  entrada, distinta forma de salida: serie temporal en vez de un solo número).
- **Alternatives considered**: nuevo archivo separado (rechazado — la lógica de streak ya vive en
  `evaluateHabitStreak.ts`, fragmentarla no aporta claridad).

## 5. Cumplimiento de tareas a tiempo vs. vencidas (FR-005)

- **Decision**: nuevo use-case puro `src/core/use-cases/calculateTaskCompletionStats.ts`,
  `calculateTaskCompletionStats(tasks: Task[]): { onTime: number; overdue: number; pending: number }`.
  Regla: una tarea es "a tiempo" si `status === 'done' && done_at <= due_date`; "vencida" si
  `status === 'pending' && due_date < today`, o si `status === 'done' && done_at > due_date`;
  el resto queda "pendiente" (aún no vence).
- **Rationale**: hoy no existe ningún use-case para `Task` — `TaskList.tsx` llama al repositorio
  directo (research: "no core/use-cases file for completing a Task"). Se crea el mínimo necesario
  para este spec sin tocar el flujo de completar tarea (eso es responsabilidad de 005).
- **Alternatives considered**: calcular esto inline en `TaskDashboard.tsx` (rechazado, Principio
  III — es una regla de negocio con casos borde, no presentación).

## 6. Progreso de metas (FR-006)

- **Decision**: si `GoalList.tsx` ya calcula el progreso inline para su propia barra, extraerlo a
  un use-case puro reutilizable (`calculateGoalProgress(goal): number` — 0 a 1) para que
  `GoalDashboard` (creado en 003) lo reuse sin duplicar la fórmula (numérico:
  `current_value / target_value`; checklist: `milestones done / total`).
- **Rationale**: Principio III — evitar que la misma fórmula de progreso viva en dos componentes.
- **Alternatives considered**: duplicar el cálculo en el nuevo gráfico (rechazado, duplicación
  innecesaria de una fórmula ya resuelta en algún lado del código de Goals).

## 7. Categoría/subcategoría en Movimientos (FR-007/FR-008)

- **Decision**: en `MovementList.tsx`, construir un mapa de lookup (id → nombre) de
  `DistributionCategory`/`ExpenseCategory`/`ExpenseSubcategory` una sola vez al cargar la lista
  (mismo patrón que ya usa `calculateCategoryBreakdown.ts` internamente), y resolver
  `distribution_category_id`/`expense_category_id`/`expense_subcategory_id` de cada movimiento
  contra ese mapa antes de renderizar.
- **Rationale**: `ICategoryRepository.getSubcategories(categoryId)` no tiene un lookup directo por
  id de subcategoría — armar el mapa una vez evita N llamadas por movimiento. Esto es ensamblado de
  datos para presentación, no lógica de negocio — vive en el componente/un hook, no en
  `core/use-cases`.
- **Alternatives considered**: agregar un método nuevo a `ICategoryRepository` para lookup directo
  por id (rechazado por ahora — el mapa in-memory alcanza para el volumen de datos de esta app
  personal/familiar; se puede revisar si escala a un problema real).

## 8. Limpieza oportunista

- `Dashboard.tsx` calcula el 50/30/20 duplicando la fórmula de `calculateBudgets` inline en vez de
  llamar al use-case ya existente (`calculateBudgets.ts:5`). Se corrige como parte de este spec ya
  que se está tocando el mismo archivo para agregar los gráficos — no amplía el alcance, es la
  misma sección de código.
