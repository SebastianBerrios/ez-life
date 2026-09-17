# Implementation Plan: Finanzas familiares, préstamos y hábitos motivacionales

**Branch**: `001-family-finance-habits` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-family-finance-habits/spec.md`

## Summary

Extiende ez-life (hoy single-user) con préstamos bidireccionales, un espacio financiero compartido
multi-usuario con split de gastos y cálculo automático de deuda, un módulo de hábitos/metas/tareas
con mecánica de racha y comodines, y dos dashboards separados — todo sobre la arquitectura en capas
existente (`core/domain`, `core/use-cases`, `infrastructure`, `presentation`), sin introducir
dependencias nuevas: el "casi instantáneo" del espacio compartido se logra con el canal Realtime que
ya trae `@supabase/supabase-js`, aditivo sobre el `CustomSyncLayer` de pull existente.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 14 (App Router), React 18

**Primary Dependencies**: Next.js, React, Dexie 4 (IndexedDB), `@supabase/supabase-js` (incluye
Realtime), `@supabase/ssr`, Tailwind CSS, shadcn/ui, framer-motion. Ninguna dependencia nueva —
ver `research.md` #1.

**Storage**: IndexedDB (Dexie) como fuente de verdad local; PostgreSQL (Supabase) como réplica
sincronizada en la nube, mismo patrón que el resto de la app.

**Testing**: Vitest (unit, `core/use-cases`) + Testing Library (wiring de UI: wizard, flujo de
invitación/canje, formularios de gasto compartido) — Principio IV de la constitución.

**Target Platform**: Web (navegador), mobile-first responsive, Next.js App Router.

**Project Type**: Web app de un solo proyecto (no hay separación frontend/backend — el "backend" es
Supabase + dos funciones RPC puntuales).

**Performance Goals**: Actualización de espacio compartido visible en <10s cuando ambos miembros
están online (SC-003); wizard completable en <3 min (SC-005); registrar un préstamo en <30s
(SC-001).

**Constraints**: Offline-first no negociable (Principio V/XII) — el canal Realtime es una mejora,
nunca un requisito para que la app funcione. Dinero siempre en centavos enteros, PEN-only (Principio
VIII). Sin nueva dependencia runtime sin justificación (Principio I/VII). Membership nunca implícita
por autenticación (Principio IX). Liquidación de deuda nunca genera un `Movement` (Principio X). Un
solo sistema de notificaciones (Principio XI). `Habit`/`Goal`/`Task`/`SavingsGoal` como entidades
separadas (Principio XIII).

**Scale/Scope**: App personal/familiar — espacios compartidos de pocos miembros (pareja o familia
nuclear, no una organización), volumen de movimientos bajo. No es un problema de escala.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Stack y Dependencias | No se agrega ninguna dependencia runtime nueva (Realtime ya viene con `@supabase/supabase-js`) | PASS |
| II. Spec Antes de Código | `spec.md` existe y fue clarificado antes de este plan | PASS |
| III. Lógica ≠ UI | Cálculo de racha/comodines y de saldo compartido diseñados como funciones puras en `core/use-cases`, no en componentes | PASS |
| IV. Tests | Cada use-case nuevo lleva test unitario; flujos de wiring (wizard, invitación) llevan test de Testing Library | PASS |
| V. Persistencia Offline-First | La app sigue funcionando 100% offline; Realtime es aditivo (ver Principio XII) | PASS |
| VI. Idioma | Copy de UI en español, código/tipos en inglés, specs/docs en español | PASS |
| VII. Simplicidad | Saldo compartido calculado on-demand (no balance denormalizado); RPC solo donde la seguridad lo exige, no en todo | PASS |
| VIII. Dinero como Enteros | Todos los montos nuevos (`Debt`, `SharedMovement`) son enteros de centavos PEN | PASS |
| IX. Membership Explícita | Canje de invitación vía RPC `SECURITY DEFINER`, nunca insert directo del cliente ni política RLS de auto-inserción | PASS |
| X. Deudas Contables | `recordSettlement` nunca crea un `Movement` — solo incrementa `settled_amount_cents` | PASS |
| XI. Un Solo Sistema de Recordatorios | Los 5 tipos nuevos se agregan a `evaluateNotifications` existente | PASS |
| XII. Offline-First / Realtime Best-Effort | Realtime channel es una mejora aditiva sobre el `CustomSyncLayer`; sin conexión, cae al pull periódico existente | PASS |
| XIII. Entidades Distintas | `Habit`, `Goal`, `Task` son tablas/entidades separadas entre sí y de `SavingsGoal` | PASS |

Sin violaciones — no hace falta completar `Complexity Tracking`.

## Project Structure

### Documentation (this feature)

```text
specs/001-family-finance-habits/
├── plan.md              # este archivo
├── research.md          # Fase 0
├── data-model.md         # Fase 1
├── quickstart.md         # Fase 1
├── contracts/             # Fase 1
│   ├── repositories.md
│   └── rpc-functions.md
└── tasks.md               # Fase 2 (/speckit-tasks, todavía no generado)
```

### Source Code (repository root)

Un solo proyecto Next.js ya existente — esta feature extiende la estructura en capas actual, no
crea una nueva. Sin frontend/backend separados: el "backend" son dos funciones RPC de Supabase
descritas en `contracts/rpc-functions.md`, junto con las tablas replicadas vía el sync existente.

```text
src/
├── core/
│   ├── domain/
│   │   ├── models/types.ts                # + Debt, SharedSpace, SharedInvite, Membership,
│   │   │                                   #   SharedMovement, Habit, HabitCompletion, Goal, Task;
│   │   │                                   #   extensión de Movement y Notification (ver data-model.md)
│   │   └── repositories/IRepositories.ts   # + IDebtRepository, ISharedSpaceRepository,
│   │                                       #   ISharedInviteRepository, IMembershipRepository,
│   │                                       #   ISharedMovementRepository, IHabitRepository,
│   │                                       #   IGoalRepository, ITaskRepository
│   └── use-cases/
│       ├── calculateSharedBalance.ts       # nuevo — pure function, "quién le debe a quién"
│       ├── evaluateHabitStreak.ts          # nuevo — pure function, racha + comodines (2 modos)
│       ├── evaluateGoalCompletion.ts       # nuevo
│       └── evaluateNotifications.ts        # extendido — 5 tipos nuevos (ver research.md #4)
├── infrastructure/
│   ├── db/db.ts                            # + tablas Dexie: debts, shared_spaces, shared_invites,
│   │                                       #   memberships, shared_movements, habits,
│   │                                       #   habit_completions, goals, tasks
│   ├── repositories/local/                 # + Local{Debt,SharedSpace,SharedInvite,Membership,
│   │                                       #   SharedMovement,Habit,Goal,Task}Repository.ts
│   ├── supabase/                           # + llamadas RPC (redeem_shared_invite, leave_shared_space)
│   └── sync/CustomSyncLayer.ts             # + tablas nuevas al pull/push existente; + suscripción
│                                           #   Realtime aditiva por espacio compartido activo
└── presentation/
    ├── components/                         # + pantallas de préstamos, espacio compartido
    │                                       #   (crear/unirse/detalle/permisos), hábitos, metas,
    │                                       #   tareas, dashboard financiero y dashboard de hábitos;
    │                                       #   + pasos nuevos del wizard/onboarding puntual
    └── hooks/                              # + useSharedSpaceRealtime, useHabitStreak (o extensión
                                            #   de hooks existentes según convenga en /speckit-tasks)
```

**Structure Decision**: Se mantiene la estructura de un solo proyecto en capas que ya usa ez-life
(`core` framework-free / `infrastructure` Dexie+Supabase / `presentation` React) — no aplica ninguna
de las opciones de "web application" con frontend/backend separados del template genérico, porque
esta app ya es ese patrón pero con Supabase como backend gestionado en vez de un backend propio.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
