# Implementation Plan: Navegación mobile, metas/tareas/hábitos, préstamos con cuotas y dropdowns

**Branch**: `002-mobile-nav-loans-ux` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-mobile-nav-loans-ux/spec.md`

## Summary

Cuatro mejoras independientes sobre la app existente, sin introducir dependencias nuevas: (1)
reducir la navegación mobile de 9 a 5 destinos (4 fijos + un "Más" tipo drawer); (2) separar la
gestión de `Goal`/`Task`/`Habit` en una página "Crear" (crear + editar, capacidad que hoy no existe)
y una página "Control" (solo seguimiento: agenda del día + progreso de metas); (3) agregar una
entidad nueva `InstallmentLoan` (préstamo con cuotas pactadas por un banco/caja) que convive con el
`Debt` existente sin tocarlo, sin ningún motor de amortización propio — el usuario ingresa los
números tal como se los da su entidad financiera y el sistema solo lleva la cuenta; y (4) migrar los
`<select>` nativos restantes al componente `Select` de shadcn que ya usa el resto de la app.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 14 (App Router), React 18

**Primary Dependencies**: Next.js, React, Dexie 4 (IndexedDB), `@supabase/supabase-js`, Tailwind
CSS, shadcn/ui (`components/ui/select.tsx` ya existente). Ninguna dependencia nueva — ver
`research.md` #1 y #2.

**Storage**: IndexedDB (Dexie) como fuente de verdad local; PostgreSQL (Supabase) como réplica
sincronizada, mismo patrón que toda la app. `InstallmentLoan`/`InstallmentPayment` se agregan a la
lista `SYNCED_TABLES` de `src/infrastructure/db/db.ts` y quedan cubiertas automáticamente por el
middleware `dbcore` que ya garantiza que sus escrituras lleguen a `sync_queue` (fix reciente — ver
`research.md` #2).

**Testing**: Vitest (unit, `core/use-cases`: cálculo/validación de pagos de `InstallmentLoan`) +
Testing Library (wiring de UI: nueva navegación con "Más", páginas Crear/Control, migración de
selects) — Principio IV de la constitución.

**Target Platform**: Web (navegador), mobile-first responsive, Next.js App Router.

**Project Type**: Web app de un solo proyecto (sin frontend/backend separados).

**Performance Goals**: Sin metas de performance nuevas — es una reorganización de UI y una entidad
CRUD adicional del mismo volumen que `Debt`, no un problema de escala.

**Constraints**: Offline-first no negociable (Principio V) — `InstallmentLoan` sigue el mismo patrón
repositorio-local-detrás-de-interfaz que toda entidad sincronizada. Dinero siempre en centavos
enteros, PEN-only (Principio VIII). Sin nueva dependencia runtime (Principio I/VII) — el selector
unificado y el drawer de "Más" se construyen con primitivas ya existentes (shadcn `Select`,
`Sheet`/`Drawer` si ya está en el proyecto, o un componente propio si no aporta ni 50 líneas).
`InstallmentLoan` es una entidad de dominio nueva, separada de `Debt`, `Goal`, `Task`, `Habit`, sin
colapsarlas entre sí (Principio XIII).

**Scale/Scope**: App personal — mismo volumen bajo que el resto de la app. No es un problema de
escala.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Stack y Dependencias | Sin dependencia runtime nueva — ver `research.md` #1/#2 | PASS |
| II. Spec Antes de Código | `spec.md` existe, pasó por `/speckit-clarify` (3 aclaraciones integradas) | PASS |
| III. Lógica ≠ UI | Validación de sobrepago (FR-021), derivación de estado `settled` (FR-025) y registro de pagos (FR-014-017, FR-026) viven en `core/use-cases`, no en componentes | PASS |
| IV. Tests | Cada use-case nuevo lleva test Vitest; el rewiring de navegación y las páginas Crear/Control llevan test de Testing Library; la migración de selects es solo visual y no requiere test nuevo (constitución lo exime explícitamente) | PASS |
| V. Persistencia Offline-First | `InstallmentLoan`/`InstallmentPayment` usan el mismo repositorio local + `sync_queue` que toda entidad existente; la app sigue funcionando 100% offline | PASS |
| VI. Idioma | Código/tipos en inglés; esta spec y sus artefactos de plan están en español, consistente con `specs/001-family-finance-habits/`. `spec.md` había quedado en inglés tras `/speckit-specify` — ya se corrigió (traducido junto con su checklist) antes de cerrar esta fase | PASS |
| VII. Simplicidad | El drawer de "Más" y la unificación de selects reutilizan componentes existentes; sin abstracción nueva que no aporte valor concreto | PASS |
| VIII. Dinero como Enteros | `amount`, `installment_amount` y los montos de `InstallmentPayment` son enteros de centavos PEN | PASS |
| IX. Membership Explícita | No aplica — esta feature no toca espacios compartidos (explícitamente fuera de alcance, FR-020) | PASS (N/A) |
| X. Deudas Contables | `InstallmentLoan` sigue el mismo patrón que `Debt`: pagar una cuota o un abono a capital es contable (decrementa `remaining_installments` / cambia `installment_amount`), nunca genera un `Movement` — ahora garantizado por un FR explícito (FR-027) y por tests que lo verifican (T023/T024), no solo por esta nota (corrección aplicada en `/speckit-analyze`, hallazgo D1) | PASS |
| XI. Un Solo Sistema de Recordatorios | Esta feature no agrega ningún recordatorio nuevo (fuera de alcance del spec); si se agregara a futuro un aviso de cuota próxima a vencer, debería extender `evaluateNotifications` igual que `loan_due_soon` ya hace para `Debt` | PASS (N/A) |
| XII. Offline-First / Sync Best-Effort | No aplica ninguna mejora "casi instantánea" en esta feature — sync sigue siendo el pull periódico existente | PASS (N/A) |
| XIII. Entidades Distintas | `InstallmentLoan` es una entidad separada de `Debt` (decisión explícita del usuario, ver `research.md` #3); `Goal`/`Task`/`Habit` mantienen su semántica y ciclo de vida propios — la reorganización de páginas es solo de UI, no colapsa las entidades | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/002-mobile-nav-loans-ux/
├── spec.md               # ya existe, con Clarifications integradas
├── plan.md               # este archivo
├── research.md           # Fase 0
├── data-model.md         # Fase 1
├── quickstart.md         # Fase 1
├── contracts/
│   └── repositories.md   # Fase 1
└── tasks.md              # Fase 2 (/speckit-tasks, todavía no generado)
```

### Source Code (repository root)

Un solo proyecto Next.js existente — esta feature extiende la estructura en capas actual.

```text
src/
├── core/
│   ├── domain/
│   │   ├── models/types.ts                    # + InstallmentLoan, InstallmentLoanStatus,
│   │   │                                       #   InstallmentPayment, InstallmentPaymentKind,
│   │   │                                       #   InstallmentAdjustmentType (ver data-model.md)
│   │   └── repositories/IRepositories.ts       # + IInstallmentLoanRepository;
│   │                                           #   IGoalRepository/ITaskRepository/IHabitRepository
│   │                                           #   sin cambios — FR-006 usa el save() upsert ya
│   │                                           #   existente (corrección aplicada en /speckit-analyze)
│   └── use-cases/
│       ├── recordInstallmentPayment.ts         # nuevo — valida y aplica pago de cuota (FR-014, FR-021)
│       ├── recordPrincipalPayment.ts           # nuevo — valida y aplica abono a capital con el
│       │                                       #   ajuste que el usuario eligió (FR-015-017, FR-021)
│       └── evaluateInstallmentLoanStatus.ts    # nuevo — deriva 'active' | 'settled' (FR-025)
├── infrastructure/
│   ├── db/db.ts                                # + tablas Dexie `installment_loans`,
│   │                                           #   `installment_payments`; agregadas a
│   │                                           #   `SYNCED_TABLES`
│   ├── repositories/local/
│   │   └── LocalInstallmentLoanRepository.ts   # nuevo
│   └── supabase/ (vía `supabase db push`, fuera de este repo de specs)
│       # migración nueva: tablas `installment_loans` e `installment_payments`,
│       # mismo patrón de RLS por `user_id` que `ez_life.debts`
└── presentation/
    ├── components/
    │   ├── BottomNav.tsx                       # reestructurado: 4 destinos fijos + "Más"
    │   ├── MoreDrawer.tsx                      # nuevo — bottom-sheet con el resto de secciones
    │   ├── CreatePage.tsx                      # nuevo — crea/edita Goal, Task, Habit
    │   ├── ControlPage.tsx                     # nuevo — agenda del día + progreso de metas
    │   │                                       #   (reemplaza el rol de HabitsDashboard actual)
    │   ├── InstallmentLoanForm.tsx             # nuevo
    │   ├── InstallmentLoanList.tsx             # nuevo — convive con DebtList en "Préstamos"
    │   ├── SettingsScreen.tsx                  # migrar `<select>` nativo → shadcn Select (FR-023)
    │   ├── DebtForm.tsx                        # migrar `<select>` nativo → shadcn Select (FR-023)
    │   └── SharedMovementForm.tsx              # migrar el `<select>` nativo restante (FR-024)
    └── (MainFlow.tsx actualiza `currentRoute` para las rutas nuevas/renombradas)
```

**Structure Decision**: Se mantiene la estructura de un solo proyecto en capas que ya usa ez-life —
no aplica ninguna de las opciones de "web application" con frontend/backend separados del template
genérico.

## Complexity Tracking

*Ninguna. La única desviación detectada (Principio VI: `spec.md` había quedado redactado en
inglés durante `/speckit-specify`) fue corregida antes de cerrar esta fase — `spec.md` y su
checklist se tradujeron al español, consistente con `specs/001-family-finance-habits/`. No queda
ninguna violación abierta de la constitución.*
