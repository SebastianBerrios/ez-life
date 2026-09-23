---

description: "Task list template for feature implementation"
---

# Tasks: Ajuste Manual de Balance Mensual

**Input**: Design documents from `/specs/006-ajuste-de-balance-mensual/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: incluidos (Strict TDD Mode + Principio IV).

## Format: `[ID] [P?] [Story] Description`

Una sola historia: US1 = Registrar un ajuste manual de balance (P1).

## Phase 1: Setup

No aplica.

## Phase 2: Foundational

No aplica — spec de una sola historia.

---

## Phase 3: User Story 1 - Registrar un ajuste manual de balance (Priority: P1) 🎯 MVP

**Goal**: crear un ajuste (positivo o negativo) con motivo obligatorio, que afecta el balance
total, queda excluido de la distribución 50/30/20, y aparece marcado en Movimientos.

**Independent Test**: crear un ajuste positivo y uno negativo, verificar balance y exclusión de la
distribución; intentar crear uno sin motivo y verificar que se bloquea.

### Tests for User Story 1

- [x] T001 [P] [US1] Crear `src/core/use-cases/validateBalanceAdjustment.test.ts`: falla sin `description`; falla si trae `distribution_category_id`/`expense_category_id`/`expense_subcategory_id`; pasa con motivo y sin categoría.
- [x] T002 [P] [US1] Extender `src/presentation/components/MovementForm.test.tsx`: activar el modo "ajuste" oculta los selectores de categoría/subcategoría y exige motivo antes de poder guardar.
- [x] T003 [P] [US1] Extender `src/presentation/components/MovementList.test.tsx`: un movimiento con `is_adjustment: true` muestra el badge "Ajuste"; uno regular no lo muestra.

### Implementation for User Story 1

- [x] T004 [US1] En `src/core/domain/models/types.ts`, agregar `is_adjustment?: boolean` a `Movement`.
- [x] T005 [US1] En `src/infrastructure/db/db.ts`, dar de alta el campo en el schema de Dexie (bump de versión). Depende de T004.
- [x] T006 [US1] Crear `src/core/use-cases/validateBalanceAdjustment.ts` (reglas en data-model.md). Depende de T004. Hace pasar T001.
- [x] T007 [US1] En `src/presentation/components/MovementForm.tsx`, agregar el toggle "Es un ajuste de balance": oculta categoría/subcategoría cuando está activo, corre `validateBalanceAdjustment` antes de guardar. Depende de T006. Hace pasar T002.
- [x] T008 [US1] En `src/presentation/components/MovementList.tsx`, renderizar el badge "Ajuste" cuando `movement.is_adjustment`. Hace pasar T003.

**Checkpoint**: US1 funciona de forma independiente (quickstart.md §2).

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T009 [P] Correr `pnpm lint`.
- [x] T010 Correr `pnpm test` completo, cero regresiones.
- [ ] T011 Ejecutar manualmente `specs/006-ajuste-de-balance-mensual/quickstart.md`.

---

## Dependencies & Execution Order

T004 → T005/T006 → T007/T008. Los tres tests (T001-T003) se escriben antes y en paralelo.

## Implementation Strategy

Historia única — no hay incrementos que ordenar: T001-T003 (tests) → T004-T008 (implementación) →
Polish.
