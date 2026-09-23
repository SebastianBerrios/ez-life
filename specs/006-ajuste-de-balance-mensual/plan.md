# Implementation Plan: Ajuste Manual de Balance Mensual

**Branch**: `006-ajuste-de-balance-mensual` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-ajuste-de-balance-mensual/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Un ajuste de balance es un `Movement` normal marcado con `is_adjustment: true` y sin categoría de
distribución — el cálculo de balance total ya lo cuenta automáticamente (suma por `type`) y el
cálculo de distribución 50/30/20 ya lo excluye automáticamente (filtra por
`distribution_category_id`), sin tocar ninguna lógica existente. El trabajo real es: un campo
nuevo, un validador de motivo obligatorio, un badge visual, y extender `MovementForm` con un modo
de ajuste — reusando toda la infraestructura de `Movement` ya construida.

## Technical Context

**Language/Version**: TypeScript (strict), Next.js 14 (App Router), React 18

**Primary Dependencies**: ninguna nueva — Dexie, `@supabase/supabase-js`, `@base-ui/react`, Tailwind.

**Storage**: IndexedDB (Dexie); un campo opcional nuevo en `movements` (`is_adjustment`).

**Testing**: Vitest + Testing Library, mismo patrón de mocks ya usado en la suite.

**Target Platform**: Web.

**Project Type**: Web app de un solo proyecto Next.js.

**Performance Goals**: sin impacto — mismo volumen de datos, ninguna consulta nueva.

**Constraints**: dinero en centavos enteros (sin cambios); Principio III (validación de motivo
obligatorio vive en `core/use-cases`, no en el formulario).

**Scale/Scope**: app personal/familiar.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stack y Dependencias** — PASS. Cero dependencias nuevas.
- **II. Spec Antes de Código** — PASS. `spec.md` validado.
- **III. Lógica ≠ UI** — PASS. La regla "motivo obligatorio" vive en
  `validateBalanceAdjustment.ts` (core/use-cases), no en `MovementForm.tsx`.
- **IV. Tests** — PASS. Test unitario para el validador nuevo; test de Testing Library para el
  modo de ajuste en `MovementForm` y el badge en `MovementList`.
- **V. Persistencia Offline-First** — PASS. Todo sigue detrás de `IMovementRepository`.
- **VI. Idioma** — PASS.
- **VII. Simplicidad** — PASS. Se reusa `Movement`/`MovementForm`/`MovementList` en vez de crear
  una entidad y un formulario nuevos (research.md §1, §5).
- **VIII. Dinero como Enteros** — PASS. Mismo campo `amount` en centavos que ya usa `Movement`.

Sin violaciones. No aplica Complexity Tracking.

**Post-Design re-check**: el único campo nuevo (`Movement.is_adjustment?: boolean`) es un booleano
opcional, sin impacto en Principio VIII ni en la lógica de balance/distribución ya validada en
research.md §1. Sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/006-ajuste-de-balance-mensual/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

No `contracts/` — mismo motivo que 003/004.

### Source Code (repository root)

```text
src/
├── core/
│   ├── domain/models/types.ts                 # Movement.is_adjustment?: boolean
│   └── use-cases/
│       └── validateBalanceAdjustment.ts        # NUEVO
└── presentation/
    └── components/
        ├── MovementForm.tsx                    # modo "ajuste": oculta categoría, exige motivo
        └── MovementList.tsx                    # badge "Ajuste"
```

**Structure Decision**: sin reestructuración; todo dentro de la arquitectura por capas existente.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No aplica — sin violaciones.
