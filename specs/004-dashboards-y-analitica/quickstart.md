# Quickstart: 004-dashboards-y-analitica

Prerrequisito: `003-fixes-criticos` ya implementado (crea `HabitDashboard`/`TaskDashboard`/
`GoalDashboard` en su versión mínima; este spec los extiende).

## 1. Automatizado

```bash
pnpm test
```

Debe incluir tests nuevos para: `compareMonthlyPeriods.test.ts`, la extensión de
`evaluateHabitStreak.test.ts` (historial), `calculateTaskCompletionStats.test.ts`,
`calculateGoalProgress.test.ts` (si se extrae), y tests de Testing Library actualizados para
`Dashboard.test.tsx`, `MovementList.test.tsx`, y los tres `*Dashboard.test.tsx` de 003.

## 2. Manual — Resumen (US1)

1. Cargar movimientos que excedan el límite de una categoría de distribución.
2. Abrir Resumen. **Esperado**: esa categoría se marca en rojo/color de alerta.
3. **Esperado**: aparece un gráfico de distribución de gastos por categoría.
4. **Esperado**: aparece una comparación contra el mes anterior (o un mensaje claro si no hay
   datos previos).
5. Cambiar el rango de fechas. **Esperado**: la comparación se recalcula para ese rango.

## 3. Manual — Dashboards de hábitos/tareas/metas (US2)

1. Abrir el dashboard de un hábito con varios días de historial. **Esperado**: gráfico de
   evolución de racha (30 días por defecto, rango cambiable).
2. Abrir el dashboard de tareas con tareas a tiempo y vencidas. **Esperado**: proporción
   representada visualmente.
3. Abrir el dashboard de metas con progreso parcial. **Esperado**: barra/círculo de progreso.

## 4. Manual — Movimientos (US3)

1. Crear movimientos con categoría y subcategoría distintas.
2. Abrir Movimientos. **Esperado**: ambas visibles en la lista, sin abrir un detalle.
