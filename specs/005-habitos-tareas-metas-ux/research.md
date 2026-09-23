# Research: 005-habitos-tareas-metas-ux

## 1. Diseño de la recurrencia de Task

- **Decision**: los campos de recurrencia se guardan **denormalizados en cada ocurrencia** de
  `Task` (no hay una entidad "plantilla" separada). Cada ocurrencia generada comparte un
  `recurrence_series_id` (UUID) con el resto de la serie. El evaluador de recurrencia siempre lee
  la configuración (`schedule_mode`/`fixed_days`/`frequency_target`/`recurrence_active`) de la
  **ocurrencia más reciente** de cada serie para decidir si corresponde generar la próxima.
- **Rationale**: evita introducir una segunda entidad (`TaskTemplate`) solo para esto — Principio
  VII. Editar el patrón (FR-005) o cancelarlo (FR-004) se resuelve automáticamente escribiendo esos
  campos en la ocurrencia vigente, sin mecanismo extra: el evaluador ya lee siempre la más reciente.
- **Alternatives considered**: entidad `TaskTemplate` + `Task` como ocurrencias puras (rechazado,
  Principio VII: una entidad nueva para lo que un campo denormalizado ya resuelve); guardar la
  recurrencia como una entidad tipo `RecurrenceRule` compartida entre Habit y Task (rechazado,
  Principio XIII: `Task` y `Habit` deben permanecer conceptos de dominio separados, no compartir
  una tabla de configuración).

## 2. Motor de evaluación — nuevo, no reutiliza `useRecurrenceEvaluator`

- **Decision**: nuevo use-case puro `src/core/use-cases/evaluateTaskRecurrence.ts`
  (`evaluateTaskRecurrence(tasks: Task[], today: Date): Task[]` — devuelve las nuevas ocurrencias a
  crear) + un nuevo hook `src/presentation/hooks/useTaskRecurrenceEvaluator.ts` que lo invoca
  (on mount + periódico, mismo patrón de intervalo que `useNotificationEvaluator`) y persiste el
  resultado vía `ITaskRepository` en una transacción Dexie.
- **Rationale**: `useRecurrenceEvaluator.ts` (confirmado, research previa) está **hardcodeado a
  `Movement`** y a `profile.last_recurrence_eval_month` (evaluación mensual) — no sirve para
  patrones semanales/de días fijos de `Task` sin reescribirlo por completo, lo que violaría su
  propósito actual. `isHabitScheduledToday` (`evaluateHabitStreak.ts:102-111`) es una función pura
  de predicado, buen molde para la pregunta "¿corresponde una ocurrencia hoy?", pero no genera
  filas — se necesita lógica de generación nueva, estructuralmente parecida a
  `useRecurrenceEvaluator` pero para `Task`.
- **Principio XI (un solo sistema de recordatorios) — por qué esto NO lo viola**: generar la
  siguiente ocurrencia de una tarea es un cambio de **datos** (crear una fila `Task`), no un
  recordatorio/notificación. Ya existe precedente de que la generación de datos recurrentes vive
  fuera del pipeline de `Notification` (`useRecurrenceEvaluator` para `Movement` tampoco es parte
  de `useNotificationEvaluator`). El aviso al usuario de que una tarea vence sigue siendo
  responsabilidad exclusiva de `evaluateNotifications.ts` (`task_due`, ya funciona end-to-end y
  dispara solo con que exista la fila `Task` — sin cambios necesarios ahí).
- **Alternatives considered**: generalizar `useRecurrenceEvaluator` para que sirva a `Movement` Y
  `Task` (rechazado — cadencias y unidades de evaluación distintas, mensual vs. diaria/semanal;
  forzarlas a un mismo hook las acopla sin necesidad).

## 3. Completar una ocurrencia no dispara la generación (consistente con Q1 de la spec)

- **Decision**: `TaskList.tsx` sigue llamando `LocalTaskRepository.markDone(id)` sin cambios. La
  generación de la próxima ocurrencia es puramente calendario (FR-003, ya resuelto en spec.md:
  "sin importar si la ocurrencia anterior fue completada, quedó pendiente o venció").
- **Rationale**: como la generación no depende de completar, no hace falta un nuevo
  `completeTaskOccurrence` que envuelva ambas cosas — mantiene el flujo de completar intacto
  (menor superficie de cambio).
- **Alternatives considered**: envolver `markDone` en un nuevo use-case que también dispare
  generación (rechazado — innecesario dado que FR-003 ya desacopla completar de generar).

## 4. Formularios de creación

- **Decision**: agregar los campos nuevos directamente a `HabitForm.tsx` (ícono/emoji opcional),
  `TaskForm.tsx` (descripción opcional + controles de recurrencia), `GoalForm.tsx` (descripción
  opcional) — mismo patrón actual de cada formulario (llaman al repositorio directo en
  `handleSubmit`, sin capa de use-case intermedia para la creación en sí).
- **Rationale**: los tres formularios ya siguen ese patrón simple; no hay razón para introducir una
  capa de use-case solo para pasar campos adicionales a `repo.save/create`.

## 5. Renombre de sidebar

- **Decision**: cambiar `label: 'Metas'` → `'Metas de Ahorro'` en
  `src/presentation/components/BottomNav.tsx:29` — confirmado sin cambios desde el research
  original, un solo string.
