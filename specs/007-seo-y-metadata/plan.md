# Implementation Plan: SEO, Favicon y Metadata al Compartir

**Branch**: `007-seo-y-metadata` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-seo-y-metadata/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

La app tiene una sola ruta real de Next.js (`src/app/page.tsx`); el resto es ruteo client-side
dentro de `MainFlow`. Por eso: favicon e imagen de Open Graph usan las convenciones de archivo
nativas de Next.js App Router (`src/app/favicon.ico`, `src/app/opengraph-image.png`), el metadata
de compartir se extiende en `layout.tsx`, y los "títulos por página" (FR-004) se resuelven
mutando `document.title` client-side desde `MainFlow` — no con `generateMetadata` por ruta, porque
no existen rutas de archivo por sección.

## Technical Context

**Language/Version**: TypeScript, Next.js 14 (App Router), React 18

**Primary Dependencies**: ninguna nueva — solo la API `Metadata` nativa de `next`.

**Storage**: N/A (sin datos persistidos).

**Testing**: Vitest + Testing Library para el efecto de `document.title` en `MainFlow`; validación
manual para favicon/Open Graph (no hay forma útil de testear metadata de compartir con Vitest).

**Target Platform**: Web.

**Project Type**: Web app de un solo proyecto Next.js, ruteo client-side de una sola página real.

**Performance Goals**: sin impacto — archivos estáticos + un `useEffect` mínimo.

**Constraints**: sin librerías nuevas (Principio VII); la app vive en `mvp-lab` (demo/localhost,
ver `mvp-lab-infra/OPERATIONS.md`) — el beneficio inmediato es compartir el link con testers, no
indexación pública masiva.

**Scale/Scope**: trivial.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stack y Dependencias** — PASS. Cero dependencias nuevas (research.md §3).
- **II. Spec Antes de Código** — PASS.
- **III. Lógica ≠ UI** — PASS/N/A. No hay lógica de negocio involucrada; el título de pestaña es
  un efecto de presentación puro, no una regla de dominio.
- **IV. Tests** — PASS. El único wiring de UI real (cambio de `document.title` al navegar) lleva
  test de Testing Library; el resto son archivos estáticos sin lógica que testear.
- **V. Persistencia Offline-First** — N/A, no hay datos.
- **VI. Idioma** — PASS.
- **VII. Simplicidad** — PASS. Se usan las convenciones nativas de Next.js en vez de cualquier
  librería de SEO/metadata de terceros.
- **VIII. Dinero como Enteros** — N/A.

Sin violaciones. No aplica Complexity Tracking.

**Post-Design re-check**: sin cambios de modelo de datos (no aplica data-model.md para esta
feature — spec.md no tiene sección de Key Entities). Sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/007-seo-y-metadata/
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md
```

No `data-model.md` (sin entidades — spec.md no la incluye) ni `contracts/`.

### Source Code (repository root)

```text
src/app/
├── layout.tsx              # metadata: openGraph, twitter
├── favicon.ico              # reemplazar con el logo real (convención Next.js App Router)
└── opengraph-image.png      # NUEVO — convención Next.js para la imagen de Open Graph

src/presentation/components/
└── MainFlow.tsx             # useEffect: document.title según currentRoute

public/
└── favicon.ico              # verificar si es duplicado obsoleto; eliminar si no se referencia
```

**Structure Decision**: sin reestructuración; se usan convenciones de archivo ya soportadas por
Next.js App Router.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No aplica — sin violaciones.
