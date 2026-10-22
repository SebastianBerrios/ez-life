# Implementation Plan: Pulido del onboarding

**Branch**: `012-pulido-onboarding` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-pulido-onboarding/spec.md`

## Summary

Cinco cambios sobre el wizard de onboarding y la gestión de categorías, sin migración de BD ni
dependencias nuevas:

1. **Saldo actual** en el paso 1 → se guarda como `opening_balance` de la cuenta "Efectivo", que ahora
   se crea dentro de la misma transacción que guarda el sueldo (`saveStartingPoint`).
2. **Tuteo neutro** en toda la app: reemplazo manual guiado por una tabla de equivalencias, más una
   prueba automática "guardia de voseo" que hace cumplir la constitución v2.1.0.
3. **Ahorro fijo**: se quita el radio del paso 2; el 0% pasa a ser válido **solo** para la categoría de
   ahorro; los fallos de guardado dejan de ser silenciosos.
4. **Orden por creación + sin "General"**: función pura `sortByCreation` aplicada en el repositorio, reloj
   monótono para que las semillas creadas en el mismo milisegundo conserven su orden, y la validación de
   "≥1 subcategoría inicial" se retira de la creación.
5. **Avisos transitorios**: hook `useTransientMessages` (4 s, por clave, se limpia al actuar o desmontar)
   usado en los pasos 2 y 3.

## Technical Context

**Language/Version**: TypeScript (strict), React 18, Next.js 14 App Router

**Primary Dependencies**: Dexie (IndexedDB), Supabase JS, shadcn/ui, `uuidv7`. **Ninguna dependencia nueva.**

**Storage**: IndexedDB local (Dexie `EzLifeDB`) como fuente de verdad + sync custom a Supabase. **Sin
cambios de esquema Dexie ni migraciones Supabase** (`payment_accounts.opening_balance` ya existe por spec 011).

**Testing**: Vitest + jsdom + `fake-indexeddb/auto` + Testing Library (`pnpm test`)

**Target Platform**: PWA móvil-first en navegador (Vercel)

**Project Type**: web-app (Next.js, capas `core` / `infrastructure` / `presentation`)

**Performance Goals**: sin requisitos nuevos; el ordenamiento opera sobre decenas de filas por usuario.

**Constraints**: offline-first (Principio V); dinero en enteros (VIII); lógica fuera de componentes (III);
copy hardcodeado en español sin i18n lib (VI).

**Scale/Scope**: ~8 archivos funcionales, ~43 archivos de copy (solo texto), ~15 archivos de test.

## Constitution Check

*GATE: Debe pasar antes de Phase 0. Re-evaluado tras Phase 1.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Stack y Dependencias | ✅ | Sin dependencias nuevas; hook y utilidades escritos a mano. |
| II. Spec Antes de Código | ✅ | Spec 012 existe antes de tocar código. |
| III. Lógica ≠ UI | ✅ | `parseCurrentBalance`, `sortByCreation`, `validateDistribution` viven en `core/use-cases`; los componentes solo renderizan y delegan. El hook de avisos es un hook de presentación sin reglas de negocio. |
| IV. Tests | ✅ | Cada caso de uso nuevo/modificado tiene test Vitest; cambios de wiring (paso 1, paso 2, paso 3) con Testing Library. Ver quickstart. |
| V. Offline-First | ✅ | Todo opera sobre IndexedDB; la cuenta y el saldo viajan por la cola de sync existente. |
| VI. Idioma | ✅ | Esta feature es la que lo hace cumplir (v2.1.0). Código en inglés, copy en español neutro. |
| VII. Simplicidad | ✅ | Hook ≈ 30 líneas, reloj monótono ≈ 8 líneas; sin librería de toasts. |
| VIII. Dinero en enteros | ✅ | El saldo se parsea a céntimos con `parseMoney`. |
| IX–XIII | N/A | No se tocan membresías, liquidaciones, recordatorios (los avisos transitorios de UI no son `Notification`), tiempo real ni entidades de dominio. |

**Re-evaluación post-diseño**: sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/012-pulido-onboarding/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones y alternativas
├── data-model.md        # Phase 1: cambios de entidades/invariantes
├── quickstart.md        # Phase 1: guía de validación
├── contracts/
│   ├── repositories.md  # Firmas de repositorios y casos de uso que cambian
│   └── ui-copy.md       # Copy exacto, tabla de voseo→tuteo y guardia
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── domain/models/types.ts                      # sin cambios
│   └── use-cases/
│       ├── parseCurrentBalance.ts (+ .test.ts)     # NUEVO: saldo del paso 1 → céntimos
│       ├── sortByCreation.ts (+ .test.ts)          # NUEVO: orden estable por created_at, desempate id
│       ├── defaultPaymentAccount.ts (+ test)       # buildDefaultCashAccount(userId, now, openingBalance = 0)
│       └── validateDistribution.ts (+ test)        # 0% válido solo si is_savings; tuteo
├── infrastructure/
│   └── repositories/local/
│       ├── creationClock.ts (+ .test.ts)           # NUEVO: nextCreatedAt() monótono
│       ├── LocalOnboardingRepository.ts (+ test)   # saveStartingPoint (reemplaza saveIncome)
│       └── LocalCategoryRepository.ts (+ test)     # orden, sin ≥1 sub inicial, 0% ahorro
└── presentation/
    ├── hooks/useTransientMessages.ts (+ .test.tsx) # NUEVO
    └── components/
        ├── OnboardingWizard.tsx                    # stepper "Inicio"
        ├── OnboardingStep1.tsx (+ test)            # 2 campos, nuevo copy
        ├── OnboardingStep2.tsx (+ test)            # sin radio, "Ahorro · fija", errores
        ├── OnboardingStep3.tsx (+ test)            # sin 'General', hint de vacía, avisos
        └── (≈40 archivos más: solo reemplazo de copy voseo→tuteo)
src/voseoGuard.test.ts                              # NUEVO: falla si hay voseo en src/
```

**Structure Decision**: se respeta la arquitectura en capas existente. La lógica nueva va en
`core/use-cases` (pura, con test colocado); lo que toca Dexie va en `infrastructure/repositories/local`;
el hook y los componentes en `presentation`. No se crean carpetas nuevas.

## Orden de implementación sugerido (insumo para /speckit-tasks)

1. **Fundaciones puras** (sin UI): `parseCurrentBalance`, `sortByCreation`, `creationClock`,
   `buildDefaultCashAccount`, `validateDistribution`. Independientes entre sí → paralelizables.
2. **Repositorios**: orden y reloj en `LocalCategoryRepository`; `saveStartingPoint`; relajar ≥1 sub inicial.
3. **Hook** `useTransientMessages`.
4. **UI por historia**: US1 paso 1 → US3 paso 2 (ahorro fijo) → US4 paso 3 (sin General, hint).
5. **Voseo (US2)**: reemplazo por lotes (dominio → repos → componentes → tests) y, al terminar el lote,
   activar la guardia `voseoGuard.test.ts` (si se activa antes, falla hasta terminar). Va **antes** de los
   avisos para no reescribir copy dos veces; todo texto nuevo se escribe ya en tuteo.
6. **Avisos (US5)**: cablear `useTransientMessages` en los pasos 2 y 3 (la guardia ya protege el copy nuevo).
7. **Verificación**: `pnpm test`, `pnpm lint`, `pnpm build` y recorrido manual de `quickstart.md`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Reemplazo masivo de copy introduce errores de acentuación ("archivala" → "archívala", "agregalas" → "agrégalas") | Tabla de equivalencias en `contracts/ui-copy.md`; sin `sed` ciego; revisión del diff por lotes. |
| La guardia de voseo da falsos positivos (ej. "Superaste" es pretérito válido en tuteo) | Lista de formas explícita (no heurística por tilde); se afina al implementar. |
| Presupuesto 0% de ahorro | Verificado: `buildRuleView`, `DesktopKpis`, `buildFinancesKpis` y `evaluateNotifications` ya protegen división por 0; se agrega test de regresión. |
| Semillas con el mismo `created_at` pierden su orden | `nextCreatedAt()` monótono en la creación; datos ya existentes con empate caen al desempate por id (comportamiento actual, aceptado). |
| `MainFlow.ensureDefault` pise el saldo | `ensureDefault` ya retorna si existe la fila con id estable; test de regresión en el flujo wizard → app. |
| Sync inicial falla en un usuario que ya existía en remoto: `observeAccountSession` traga el error (`observeAccountSession.ts:34-36`), `progress()` puede dar 0 y el wizard crearía "Efectivo" (id estable, `updated_at` = ahora), que podría ganar por LWW al saldo remoto | **Riesgo aceptado** (probabilidad baja). Es el mismo patrón que ya usan la fuente `initial-income` y `ensureDefault`; ahora el dato es dinero, por eso se documenta. No se agrega mitigación en esta feature; si se materializa, abrir una spec aparte (p. ej. no ofrecer el wizard hasta que el pull inicial haya terminado con éxito). |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
