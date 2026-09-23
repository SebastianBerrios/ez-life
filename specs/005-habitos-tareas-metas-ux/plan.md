# Implementation Plan: UX de Creación y Tareas Recurrentes

**Branch**: `005-habitos-tareas-metas-ux` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-habitos-tareas-metas-ux/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

`Task` gana un patrón de recurrencia propio (días fijos o frecuencia semanal, denormalizado en
cada ocurrencia, agrupado por `recurrence_series_id`), evaluado por un motor nuevo
(`evaluateTaskRecurrence` + `useTaskRecurrenceEvaluator`) independiente del ya existente
`useRecurrenceEvaluator` (que es exclusivo de `Movement`) — sin tocar el pipeline de notificaciones
(`task_due` ya funciona automáticamente en cuanto existe la fila). Los tres formularios de creación
ganan campos opcionales (ícono en Hábito, descripción en Tarea/Meta). El sidebar renombra "Metas" a
"Metas de Ahorro".

## Technical Context

**Language/Version**: TypeScript (strict), Next.js 14 (App Router), React 18

**Primary Dependencies**: ninguna nueva.

**Storage**: IndexedDB (Dexie); campos nuevos en `tasks` (recurrencia + descripción), `habits`
(ícono), `goals` (descripción).

**Testing**: Vitest + Testing Library.

**Target Platform**: Web.

**Project Type**: Web app de un solo proyecto Next.js.

**Performance Goals**: la evaluación de recurrencia corre on-mount + periódica (mismo intervalo que
`useNotificationEvaluator`), sobre el volumen de tareas de una app personal — sin necesidad de
optimización adicional.

**Constraints**: Principio XIII (Task/Habit permanecen entidades separadas — la recurrencia de Task
no reutiliza el modelo de Habit, aunque el vocabulario de campos sea el mismo); Principio XI (la
generación de ocurrencias no es un mecanismo de recordatorio nuevo, ver research.md §2).

**Scale/Scope**: app personal/familiar.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stack y Dependencias** — PASS. Sin dependencias nuevas.
- **II. Spec Antes de Código** — PASS. `spec.md` validado (incluye Q1 resuelto: generación por
  calendario, y la decisión "Recurrencia nueva en Task" en vez de reusar Habit).
- **III. Lógica ≠ UI** — PASS. `evaluateTaskRecurrence` es una función pura en `core/use-cases`;
  `TaskForm.tsx`/`HabitForm.tsx`/`GoalForm.tsx` solo recolectan campos y llaman al repositorio.
- **IV. Tests** — PASS. Test unitario para `evaluateTaskRecurrence` (casos: primera generación, no
  duplicar si ya existe la ocurrencia del período, recurrencia cancelada no genera, patrón editado
  afecta solo ocurrencias futuras); test de Testing Library para el hook nuevo y los tres
  formularios extendidos.
- **V. Persistencia Offline-First** — PASS. Todo detrás de `ITaskRepository`/`IHabitRepository`/
  `IGoalRepository`.
- **VI. Idioma** — PASS.
- **VII. Simplicidad** — PASS. Recurrencia denormalizada en `Task` en vez de una entidad
  `TaskTemplate` nueva (research.md §1); sin capa de use-case nueva para creación simple (research.md §4).
- **VIII. Dinero como Enteros** — N/A, esta spec no toca dinero.
- **XI. Un Solo Sistema de Recordatorios** — PASS, justificado explícitamente en research.md §2:
  la generación de ocurrencias es un cambio de datos, no un recordatorio; `task_due` sigue siendo
  la única vía de aviso al usuario, sin duplicarse.
- **XIII. Conceptos de Dominio Distintos** — PASS. La recurrencia de `Task` es un campo propio de
  `Task`, nunca una referencia a `Habit` ni una tabla de configuración compartida (research.md §1).

Sin violaciones. No aplica Complexity Tracking.

**Post-Design re-check**: los campos nuevos (`Task.schedule_mode`/`fixed_days`/`frequency_target`/
`recurrence_series_id`/`recurrence_active`/`description`, `Habit.icon`, `Goal.description`) son
altas de campo Dexie sin migración destructiva. Sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/005-habitos-tareas-metas-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

No `contracts/`.

### Source Code (repository root)

```text
src/
├── core/
│   ├── domain/models/types.ts                    # Task, Habit, Goal: campos nuevos
│   └── use-cases/
│       └── evaluateTaskRecurrence.ts               # NUEVO
├── infrastructure/db/db.ts                          # bump de schema Dexie
└── presentation/
    ├── hooks/
    │   └── useTaskRecurrenceEvaluator.ts             # NUEVO
    └── components/
        ├── HabitForm.tsx                             # + ícono opcional
        ├── TaskForm.tsx                               # + descripción + controles de recurrencia
        ├── GoalForm.tsx                               # + descripción opcional
        ├── MainFlow.tsx                               # wire del hook nuevo
        └── BottomNav.tsx                              # "Metas" → "Metas de Ahorro"
```

**Structure Decision**: sin reestructuración.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No aplica — sin violaciones.
