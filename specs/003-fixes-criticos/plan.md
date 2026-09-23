# Implementation Plan: Fixes Críticos (dropdowns, reactividad, hábitos, préstamos)

**Branch**: `003-fixes-criticos` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-fixes-criticos/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cuatro correcciones independientes sobre la app ya existente: (1) el `Select` compartido
(`@base-ui/react`) posiciona el ítem seleccionado encima del trigger por defecto — se cambia a
anclar el menú debajo; (2) `Movement`, `Habit` y `Task` no se refrescan tras crearse — se extiende
el patrón de refresh-por-key ya usado y probado en `SavingsGoal`; (3) `HabitList` oculta por
completo los hábitos no programados para hoy — se cambia el filtro para mostrarlos siempre con una
marca visual; (4) los pagos de préstamo no generan `Movement` (confirmado, y ahora permitido por la
constitución v2.0.0) — se extiende el use-case puro para describir el `Movement` a crear y el
repositorio lo persiste en la misma transacción; además se corrige un gap de sync descubierto en el
camino (`installment_loans`/`installment_payments` nunca se traen del remoto) y se endurece la UI
de abonos contra doble-submit.

## Technical Context

**Language/Version**: TypeScript (strict), Next.js 14 (App Router), React 18

**Primary Dependencies**: Dexie (IndexedDB), `@supabase/supabase-js`, `@base-ui/react` (primitivas
de UI, estilo shadcn `base-nova`), Tailwind CSS. Sin dependencias nuevas — ver research.md §2 para
por qué se descarta `dexie-react-hooks`.

**Storage**: IndexedDB (Dexie) como fuente de verdad local; Supabase Postgres remoto vía la capa de
sync custom (`CustomSyncLayer.ts`, pull + drenado de `sync_queue`).

**Testing**: Vitest (`jsdom` + `fake-indexeddb/auto` global) + Testing Library, suite existente en
`*.test.ts`/`*.test.tsx` colocados junto a cada archivo.

**Target Platform**: Web (navegador), app offline-first de finanzas personales/familiares.

**Project Type**: Web app de un solo proyecto Next.js (sin backend propio separado — Supabase es el
backend gestionado); arquitectura interna en capas (`core/domain`, `core/use-cases`,
`infrastructure`, `presentation`).

**Performance Goals**: Reflejar un registro nuevo en su vista en menos de 1s sin recarga manual
(spec SC-002) — ya alcanzable con remount local, sin requerir optimización adicional.

**Constraints**: Offline-first no negociable (Principio XII); dinero siempre en centavos enteros
(Principio VIII); lógica de negocio fuera de componentes React (Principio III).

**Scale/Scope**: App personal/familiar (mvp-lab, demo/localhost), no requiere diseño para escala.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stack y Dependencias** — PASS. Cero dependencias nuevas (research.md §1, §2).
- **II. Spec Antes de Código** — PASS. `spec.md` existe y fue validado antes de este plan.
- **III. Lógica ≠ UI** — PASS. La generación del `Movement` de un pago de préstamo vive en los
  use-cases puros (`recordInstallmentPayment.ts`, `recordPrincipalPayment.ts`), no en
  `InstallmentLoanList.tsx` ni en el repositorio (el repositorio solo persiste lo que el use-case
  describe, igual que ya hace con `remaining_installments`).
- **IV. Tests** — PASS, con obligación explícita: cada FR de esta spec que toca wiring de UI
  (refresh-key de Movement/Habit/Task, filtro de `HabitList`, disabled del botón de abono) requiere
  test con Testing Library; cada cambio de use-case/repositorio requiere test Vitest (unit +
  repositorio, cerrando el gap de cobertura detectado en research.md §4 para
  `reduce_installment_amount`).
- **V. Persistencia Offline-First** — PASS. Todo cambio queda detrás de las interfaces de
  repositorio existentes; el fix de sync (FR-015) hace que `installment_loans`/`installment_payments`
  respeten el mismo modelo pull-based que ya usan las demás tablas, sin introducir tiempo real.
- **VI. Idioma** — PASS. Código/tests en inglés; copy de UI en español, sin librería de i18n nueva.
- **VII. Simplicidad** — PASS. Se reutiliza el patrón de refresh-key ya existente en vez de agregar
  una librería reactiva nueva (research.md §2).
- **VIII. Dinero como Enteros** — PASS. El `Movement` generado usa el mismo campo `amount` en
  centavos que ya trae `InstallmentPayment`.
- **X. Liquidaciones Informales Son Contables; Pagos de Préstamo Son Gasto Real** (v2.0.0) — PASS,
  este plan es precisamente lo que la enmienda de la constitución (ver `constitution.md`) habilitó:
  `Debt` sigue sin generar `Movement`; `InstallmentPayment` (cualquier `kind`) ahora sí.
- **XIII. Conceptos de Dominio Distintos** — PASS. No se fusiona ninguna entidad; el fix de
  `HabitList` cambia un filtro de visualización, no el modelo de `Habit`.

Sin violaciones. No aplica Complexity Tracking.

**Post-Design re-check** (tras Phase 1 / data-model.md): los dos campos opcionales nuevos
(`InstallmentLoan.distribution_category_id`, `Movement.installment_payment_id`) son altas de campo
Dexie sin migración de datos destructiva, consistentes con Principio V (repositorio como única
puerta a persistencia) y VIII (sin tocar representación de dinero). Sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/003-fixes-criticos/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` — esta feature no expone ninguna interfaz nueva hacia fuera del propio Next.js app
(no hay API routes propias en juego); el único "contrato" relevante son las interfaces de
repositorio ya existentes en `src/core/domain/repositories/IRepositories.ts`, sin cambios de forma.

### Source Code (repository root)

Proyecto único Next.js existente, arquitectura en capas ya establecida. Archivos que este plan
toca (sin crear ninguna carpeta nueva):

```text
src/
├── components/ui/select.tsx                                    # fix 1: alignItemWithTrigger
├── core/
│   └── use-cases/
│       ├── recordInstallmentPayment.ts                         # fix 4: describe el Movement
│       └── recordPrincipalPayment.ts                           # fix 4: describe el Movement
├── infrastructure/
│   ├── db/db.ts                                                 # sin cambios de schema
│   ├── repositories/local/
│   │   └── LocalInstallmentLoanRepository.ts                    # fix 4: persiste el Movement
│   └── sync/CustomSyncLayer.ts                                   # fix 4b: agrega tablas a pull
└── presentation/
    ├── components/
    │   ├── MainFlow.tsx                                          # fix 2: refreshKey de Movement
    │   ├── MovementList.tsx                                      # fix 2: refetch por key
    │   ├── CreatePage.tsx                                        # fix 2: refresh cross-route de Habit/Task
    │   ├── HabitList.tsx                                         # fix 3: no ocultar por día
    │   └── InstallmentLoanList.tsx                                # fix 4c: disabled + separar controles
    └── components/*Form.tsx (MovementForm, SharedMovementForm,   # fix 1: heredan el fix del Select
        DebtForm, SettingsScreen)                                  #        compartido, sin tocarlos
```

**Structure Decision**: no hay reestructuración — todos los cambios caen dentro de las carpetas ya
existentes de la arquitectura por capas (`core/use-cases` para lógica, `infrastructure` para
persistencia/sync, `presentation` para wiring de UI), respetando el Principio III.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No aplica — el Constitution Check no registró violaciones.
