# Implementation Plan: Dashboards y Analítica Interactiva

**Branch**: `004-dashboards-y-analitica` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-dashboards-y-analitica/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

El Resumen y los dashboards de Hábitos/Tareas/Metas pasan de mostrar solo números/listas a mostrar
gráficos y comparaciones. La mayor parte de la lógica de negocio necesaria (distribución por
categoría, cálculo de presupuesto 50/30/20) YA existe pero está sin usar (`calculateCategoryBreakdown`,
`calculateBudgets`) — este plan la conecta y agrega tres use-cases puros nuevos (comparación de
períodos, historial de racha, estadísticas de cumplimiento de tareas), más un lookup de
categoría/subcategoría en Movimientos. Requiere una dependencia nueva justificada: `recharts`.

## Technical Context

**Language/Version**: TypeScript (strict), Next.js 14 (App Router), React 18

**Primary Dependencies**: Dexie, `@supabase/supabase-js`, `@base-ui/react`, Tailwind CSS — más
**`recharts` (nueva, justificada en research.md §1)**.

**Storage**: IndexedDB (Dexie) local; sin cambios de schema (todos los datos ya existen).

**Testing**: Vitest + Testing Library; patrón existente de `vi.mock('...LocalXRepository')` +
`vi.mocked(...).mockImplementation(...)` (confirmado en `Dashboard.test.tsx`).

**Target Platform**: Web (navegador).

**Project Type**: Web app de un solo proyecto Next.js, arquitectura en capas existente.

**Performance Goals**: los gráficos se renderizan con datos ya cargados localmente (IndexedDB) —
sin llamadas de red adicionales; SC-002 (identificar de un vistazo el estado del presupuesto) no
requiere ningún cálculo pesado nuevo.

**Constraints**: offline-first sin cambios (todo sigue viniendo de Dexie); dinero en centavos
enteros en todos los use-cases nuevos, convertido a unidades solo al formatear para el gráfico.

**Scale/Scope**: app personal/familiar, sin necesidad de virtualización ni paginación de datos
para los gráficos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stack y Dependencias** — PASS CON JUSTIFICACIÓN. `recharts` es la única dependencia nueva de
  todo el trabajo pendiente (003 y 004 combinados); justificación completa en research.md §1
  (4+ tipos de gráfico distintos, hand-rollear excede el presupuesto de simplicidad varias veces).
- **II. Spec Antes de Código** — PASS. `spec.md` validado antes de este plan.
- **III. Lógica ≠ UI** — PASS. Los cuatro cálculos nuevos/reusados (`calculateCategoryBreakdown`,
  `calculateBudgets`, `compareMonthlyPeriods`, `calculateHabitStreakHistory`,
  `calculateTaskCompletionStats`, `calculateGoalProgress`) son funciones puras en
  `core/use-cases/`; los componentes de `presentation/` solo les pasan datos y renderizan el
  resultado.
- **IV. Tests** — PASS. Cada use-case nuevo lleva su test unitario Vitest; cada componente de
  gráfico/lista con wiring nuevo (Dashboard, MovementList, los tres *Dashboard de 003) lleva test
  Testing Library, siguiendo el patrón de mock ya usado en `Dashboard.test.tsx`.
- **V. Persistencia Offline-First** — PASS. Ningún cambio de repositorio ni de red; todo se deriva
  de datos ya en Dexie.
- **VI. Idioma** — PASS. Sin cambios de convención.
- **VII. Simplicidad** — PASS. Se prioriza reusar `calculateCategoryBreakdown`/`calculateBudgets`
  (ya existentes, sin uso) antes que escribir lógica nueva; la única dependencia nueva está
  justificada por necesidad real, no por preferencia.
- **VIII. Dinero como Enteros** — PASS. Todos los use-cases nuevos operan sobre `Movement.amount`
  en centavos; la conversión a soles ocurre solo en el punto de renderizado del gráfico.

Sin violaciones. No aplica Complexity Tracking.

**Post-Design re-check** (tras Phase 1 / data-model.md): los tipos derivados nuevos
(`PeriodComparison`, `HabitStreakHistoryPoint`, `TaskCompletionStats`) son shapes en memoria, no
entidades persistidas — no requieren migración de Dexie ni tocan Principio V/VIII más allá de lo ya
evaluado. Sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/004-dashboards-y-analitica/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` — mismo motivo que 003: no hay interfaz externa nueva, solo use-cases puros y
componentes de presentación internos al mismo Next.js app.

### Source Code (repository root)

```text
src/
├── core/
│   └── use-cases/
│       ├── calculateCategoryBreakdown.ts       # ya existe — solo se conecta (fix 2)
│       ├── calculateBudgets.ts                 # ya existe — se conecta, se deja de duplicar (fix 8)
│       ├── compareMonthlyPeriods.ts             # NUEVO (fix 3)
│       ├── evaluateHabitStreak.ts               # extendido: calculateHabitStreakHistory (fix 4)
│       ├── calculateTaskCompletionStats.ts      # NUEVO (fix 5)
│       └── calculateGoalProgress.ts             # NUEVO o extraído si ya existe inline (fix 6)
└── presentation/
    └── components/
        ├── Dashboard.tsx                        # gráficos + comparación + indicador de color
        ├── MovementList.tsx                     # categoría/subcategoría visibles (fix 7)
        ├── HabitDashboard.tsx                    # de 003 — se le agrega el gráfico de racha
        ├── TaskDashboard.tsx                     # de 003 — se le agrega el gráfico de cumplimiento
        └── GoalDashboard.tsx                     # de 003 — se le agrega el gráfico de progreso
```

**Structure Decision**: sin reestructuración. Este plan depende de que 003 ya haya creado
`HabitDashboard.tsx`/`TaskDashboard.tsx`/`GoalDashboard.tsx` (versión mínima) — 004 los extiende con
gráficos, no los crea desde cero.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No aplica — el Constitution Check no registró violaciones (la única dependencia nueva está
justificada en la sección de arriba, no es una "violación" sino el proceso normal del Principio I).
