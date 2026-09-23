---

description: "Task list template for feature implementation"
---

# Tasks: SEO, Favicon y Metadata al Compartir

**Input**: Design documents from `/specs/007-seo-y-metadata/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: incluidos donde aplica. Los cambios puramente de assets estáticos (favicon, imagen OG)
no requieren test nuevo (Principio IV: "los cambios puramente de estilo visual... no requieren
test nuevo") — solo el `useEffect` de título por ruta es wiring de UI real y sí lo requiere.

## Format: `[ID] [P?] [Story] Description`

US1 = Favicon real (P1), US2 = Vista previa de Open Graph (P1), US3 = Títulos por página (P2)

## Phase 1: Setup

No aplica.

## Phase 2: Foundational

No aplica.

---

## Phase 3: User Story 1 - Logo real en la pestaña del navegador (Priority: P1) 🎯 MVP

**Goal**: la pestaña del navegador muestra el logo de ez-life.

**Independent Test**: abrir la app y ver el logo en la pestaña, no un ícono genérico.

### Implementation for User Story 1

- [x] T001 [US1] Reemplazar `src/app/favicon.ico` con el logo real de ez-life (convención Next.js App Router — research.md §2).
- [x] T002 [US1] Verificar si `public/favicon.ico` está referenciado desde algún lado (grep de `favicon` fuera de `src/app`); si es un duplicado obsoleto, eliminarlo.

**Checkpoint**: US1 funciona de forma independiente (quickstart.md §2 paso 1-2).

---

## Phase 4: User Story 2 - Vista previa rica al compartir el link (Priority: P1)

**Goal**: compartir el link de la app muestra título, descripción e imagen.

**Independent Test**: pegar la URL en una herramienta de vista previa de Open Graph o compartirla
por mensajería y verificar la vista previa.

### Implementation for User Story 2

- [x] T003 [US2] Agregar `src/app/opengraph-image.png` (convención Next.js — research.md §4) con una imagen representativa de ez-life.
- [x] T004 [US2] En `src/app/layout.tsx`, extender `export const metadata` con `openGraph: { title, description, images }` y `twitter: { card: 'summary_large_image', title, description, images }`.

**Checkpoint**: US2 funciona de forma independiente (quickstart.md §2 paso 3-4).

---

## Phase 5: User Story 3 - Títulos y descripciones específicos por página (Priority: P2)

**Goal**: el título de la pestaña cambia según la sección de la app.

**Independent Test**: navegar entre secciones y ver el título de pestaña cambiar.

### Tests for User Story 3

- [x] T005 [P] [US3] Extender `src/presentation/components/MainFlow.test.tsx`: `document.title` cambia según `currentRoute` (mapa ruta→título).

### Implementation for User Story 3

- [x] T006 [US3] En `src/presentation/components/MainFlow.tsx`, agregar un mapa `currentRoute → título` y un `useEffect` que actualice `document.title` al cambiar de ruta (research.md §1). Hace pasar T005.

**Checkpoint**: US3 funciona de forma independiente (quickstart.md §2 paso 5).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T007 [P] Correr `pnpm lint`.
- [x] T008 Correr `pnpm test` completo, cero regresiones.
- [ ] T009 Ejecutar manualmente `specs/007-seo-y-metadata/quickstart.md`. **No ejecutado**: requiere un navegador real (ver la pestaña, agregar a pantalla de inicio) y una herramienta externa de vista previa de Open Graph (o compartir el link real por WhatsApp/Slack) — ninguno disponible en este entorno de agente sin GUI. `pnpm build` sí confirma que `/icon` y `/opengraph-image` compilan y se generan correctamente (paso automatizable de este checklist); los pasos 1, 2, 4 y 5 de quickstart.md quedan pendientes de verificación manual por una persona.

---

## Dependencies & Execution Order

US1, US2, US3 son completamente independientes — se pueden hacer en cualquier orden o en
paralelo.

---

## Phase 7: Convergence

Generado por `/speckit-converge` tras verificar el código real contra spec.md. 3/4 FR
satisfechos completamente; el restante queda acá.

- [x] T010 Agregar `metadataBase` a `export const metadata` en `src/app/layout.tsx`, resuelto contra la URL real de deploy (ej. `process.env.NEXT_PUBLIC_SITE_URL` o `VERCEL_URL` de Vercel) con fallback a `http://localhost:3000`, para que la imagen de Open Graph generada por `opengraph-image.tsx` resuelva correctamente cuando el link se comparte fuera de localhost per FR-003 (partial)

## Implementation Strategy

Feature chica: T001-T002 (US1) → T003-T004 (US2) → T005-T006 (US3) → Polish. No hay MVP parcial
significativo — las tres historias son igual de rápidas de entregar.
