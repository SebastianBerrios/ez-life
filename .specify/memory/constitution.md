<!--
Sync Impact Report
===================
Version change: (unversioned baseline, carried over from docs/constitution.md) → 1.1.0
Modified principles: none (all 8 pre-existing rules carried over verbatim in meaning, renumbered as
  Roman-numeral principles I–VIII to fit this template's structure)
Added principles:
  - IX. Membership Requiere Consentimiento Explícito, Nunca Implícito Por Autenticación
  - X. Deudas y Liquidaciones Son Contables, Nunca Transacciones Simuladas
  - XI. Un Solo Sistema de Recordatorios
  - XII. Offline-First No Es Negociable; Sync en Tiempo Real Es una Mejora Best-Effort
  - XIII. Los Conceptos de Dominio Distintos Permanecen Distintos
Removed sections: none
Omitted template sections: [SECTION_2_NAME] and [SECTION_3_NAME] were dropped rather than filled
  with filler content — every rule the project currently enforces fits as a Core Principle; adding
  empty/generic sections would violate Principle VII (Simplicidad).
Templates requiring follow-up: none checked automatically in this run — `.specify/templates/*`
  (plan/spec/tasks) should be skimmed next time they're touched to confirm they don't reference a
  stale principle count or the pre-spec-kit `specs/` legacy layout.
Deferred items: none. RATIFICATION_DATE recovered from `git log --follow -- docs/constitution.md`
  (first commit "version 01", 2026-09-14) instead of a TODO.
-->

# Ez-life Constitution

## Core Principles

### I. Stack y Dependencias
TypeScript, React, Next.js, Supabase. Toda nueva dependencia runtime requiere justificación
explícita en la spec correspondiente — no se agrega una librería "porque sí" o "porque es la
moda".

### II. Spec Antes de Código
Toda funcionalidad DEBE tener una spec en `specs/` ANTES de escribir código. Código sin spec no
está autorizado por este proyecto, sin excepciones de "es un cambio chico".

### III. Lógica ≠ UI
Las reglas de negocio viven en funciones puras o hooks sin imports de UI (`core/use-cases`,
`core/domain`). Los componentes de `presentation/` solo renderizan y delegan — nunca deciden.

### IV. Tests
Todo caso de uso tiene al menos un test unitario (Vitest). El comportamiento de UI que implica
wiring o flujo de datos (conectar un formulario, cambiar qué se llama al hacer submit, agregar una
ruta) requiere test con Testing Library. Los cambios puramente de estilo visual o de tokens
(spacing, tipografía, colores, tamaños) no requieren test nuevo. Sin e2e hasta que una spec lo
requiera explícitamente.

### V. Persistencia Offline-First
IndexedDB es la fuente de verdad local. Supabase sincroniza a la nube mediante una capa de sync
custom. La app DEBE funcionar completamente sin conectividad, con una única excepción explícita:
el login inicial vía OAuth requiere conexión (ver `specs-legacy/001-ezlife-mvp/spec.md`
RF-01/RNF-01). La persistencia vive siempre detrás de una interfaz de repositorio.

### VI. Idioma
Código, tipos, variables y commits en inglés. El copy de UI va en español, centralizado a mano en
los componentes — v1 NO usa una librería de i18n: agregarla violaría los Principios I y VII (nueva
dependencia sin justificación suficiente frente al valor que aporta hoy). Esto se documenta como
deuda técnica explícita, no como una violación activa de esta constitución. README y documentos de
proyecto (specs, esta constitución) en español.

### VII. Simplicidad
Si una librería aporta menos de 50 líneas de valor, se escribe a mano. Menos dependencias, menos
problemas.

### VIII. Dinero como Enteros
Todos los valores monetarios se almacenan como enteros (céntimos). Nunca floats. v1 opera solo en
PEN.

### IX. Membership Requiere Consentimiento Explícito, Nunca Implícito Por Autenticación
Todo espacio compartido o multi-usuario (ej. un espacio familiar/de pareja de finanzas) DEBE
modelar la membresía como una fila explícita creada a través de un flujo de invitación + aceptación.
Una sesión autenticada válida NUNCA implica membresía en un espacio compartido. No se permiten
políticas RLS de auto-inserción ni triggers sobre un evento de auth que otorguen membresía.
Rationale: este es el error de seguridad más caro posible en una app financiera compartida — un
usuario autenticado viendo o editando datos de un espacio del que no es miembro.

### X. Deudas y Liquidaciones Son Contables, Nunca Transacciones Simuladas
Marcar una deuda o préstamo como saldado registra únicamente que una obligación quedó resuelta
(monto + fecha). NO DEBE generar un `Movement` de ingreso/egreso — la app no mueve plata real, y
hacerlo corrompería la distribución real de ingresos/egresos del usuario.
Rationale: sin esta regla, un refactor futuro bien intencionado podría "simplificar" convirtiendo
una liquidación en un movimiento, ensuciando silenciosamente el 50/30/20 del usuario.

### XI. Un Solo Sistema de Recordatorios
Toda funcionalidad de recordatorio, alerta o impulso motivacional (hábitos, tareas, préstamos,
presupuesto, actividad de espacio compartido) DEBE extender el sistema de `Notification` existente
y su pipeline de evaluación. No se permiten mecanismos de notificación/recordatorio paralelos.
Rationale: evita que en el futuro aparezca un segundo sistema de reminders compitiendo con el que
ya existe (RF-16), duplicando preferencias de usuario y lógica de evaluación.

### XII. Offline-First No Es Negociable; Sync en Tiempo Real Es una Mejora Best-Effort
Cualquier comportamiento casi-instantáneo (ej. actualizaciones de un espacio familiar compartido)
es una mejora que se apoya sobre la capa de sync existente basada en pull. La app DEBE seguir
funcionando completamente offline y NO DEBE bloquearse ni degradarse cuando no hay conexión. Las
funcionalidades en tiempo real deben degradar con gracia a la cadencia de sync existente, sin
errores ni bloqueos de UI.
Rationale: agregar multi-usuario no puede convertir "offline-first" en "offline-a-veces" — es el
valor central de la app (Principio V) y no se negocia ni siquiera por una buena UX de espacio
compartido.

### XIII. Los Conceptos de Dominio Distintos Permanecen Distintos
`Habit` (recurrente, con racha), `Goal` (objetivo medible único — numérico o checklist), `Task`
(puntual, con fecha límite) y `SavingsGoal` (objetivo financiero) son entidades de dominio
separadas, con ciclos de vida y semántica de "completado" distintos. NO DEBEN colapsarse en una
sola entidad polimórfica, aun cuando parezca reducir duplicación.
Rationale: los cuatro conceptos tienen reglas de completado y de UI genuinamente distintas; una
entidad polimórfica compartida termina llena de campos opcionales y `if` según el tipo, que es peor
que la duplicación que evita.

## Governance

Esta constitución tiene precedencia sobre cualquier otra práctica, convención de equipo o atajo de
implementación documentado en otro lugar (incluyendo `CLAUDE.md`/`AGENTS.md`, que deben mantenerse
consistentes con este documento y nunca contradecirlo).

- **Enmiendas**: cualquier cambio a un Principio Central se hace exclusivamente a través de
  `/speckit-constitution`, nunca editando este archivo a mano ni "de paso" en un PR de feature.
  Cada enmienda actualiza la versión según semver (MAJOR: eliminación o redefinición incompatible
  de un principio; MINOR: principio o sección nueva; PATCH: aclaración de redacción) y dispara un
  Sync Impact Report.
- **Revisión de cumplimiento**: toda spec, diseño y PR debe verificar alineación con estos
  principios antes de mergear. Si una implementación necesita violar un principio, el precedente
  correcto es enmendar la constitución primero (con su justificación explícita), no violar en
  silencio.
- **Resolución de conflictos**: si esta constitución y una spec existente entran en conflicto, esta
  constitución gana; la spec se corrige.

**Version**: 1.1.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-17
