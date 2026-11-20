# Implementation Plan: Minimalismo en el resto de la app

**Branch**: `014-minimalismo-resto-app` (trabajo sobre `main`; no hay hook `before_specify`) | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-minimalismo-resto-app/spec.md`

## Summary

Extender el lenguaje visual cálido y minimalista introducido en la spec 013 (paleta crema/ciruela, verde pastel,
Fredoka + Figtree, radios grandes, sombras suaves, sin estilos "terminal") al resto de la aplicación: navegación y
pantallas de sistema, Finanzas, Control y Hábitos, Espacio Compartido, Mi Progreso, Ajustes y todos los formularios
principales.

Es una entrega **estrictamente de presentación**: **0 cambios** en reglas de negocio, modelo de datos, migraciones o
sincronización, y **0 dependencias runtime nuevas**. El enfoque técnico combina:
1. **Layout unificado mobile-first extremo (PWA)**: columna centrada `max-w-[720px]` en toda la app; barra inferior
   fija en celular y tablet vertical (`< 1024px`) con zonas seguras (`env(safe-area-inset-*)`); barra lateral en tablet
   horizontal y escritorio (`>= 1024px`); sincronización de `theme-color` con el tema activo.
2. **Primitivas compartidas y funciones puras de frases**: `CollapsibleSection` y `EmptyState` en `src/components/ui/`,
   extensión de `Sheet` con footer fijo al alcance del pulgar en móvil, y 4 módulos puros en `src/core/use-cases/` con
   tests unitarios para construir cifras protagonistas, frases de estado y conteo de campos avanzados.
3. **Rediseño por pantallas**: Finanzas con 3 pestañas y 1 dato protagonista por pestaña (sin KPIs ni tablas);
   formularios con `"Más opciones"` plegado (con contador de activas en edición y auto-expansión ante error); Control y
   Hábitos centrado en puntaje + `"Foco de Hoy"` + selector segmentado + analítica plegada; Espacio Compartido con
   frases naturales y lista limpia de movimientos; Mi Progreso en cuadrícula ligera y Ajustes en 5 secciones
   colapsables con `"Completar configuración"` y `"Ver tutorial"` visibles arriba.

## Technical Context

**Language/Version**: TypeScript (strict), React 18, Next.js 14.2 App Router

**Primary Dependencies**: Tailwind CSS 3.4, `@base-ui/react`, `lucide-react`, `framer-motion`, `next-themes` 0.4,
Dexie 4 (solo lectura vía repositorios/hooks existentes). **Ninguna dependencia runtime nueva** (Principios I y VII).

**Storage**: N/A para cambios (reutiliza IndexedDB local `EzLifeDB` y sync custom existentes sin alteraciones ni
migraciones).

**Testing**: Vitest + jsdom + `fake-indexeddb/auto` + Testing Library (`pnpm test`); guardias automáticas
(`src/voseoGuard.test.ts`, `src/typographyGuard.test.ts`, `src/tokens.contrast.test.ts`).

**Target Platform**: PWA mobile-first en navegador (360 px en adelante, zonas seguras iOS/Android), tablet vertical
(768–1023 px), tablet horizontal y escritorio (≥ 1024 px).

**Project Type**: web-app (Next.js App Router, capas `core` / `infrastructure` / `presentation`).

**Performance Goals**: Renderizado instantáneo sobre datos locales (`useLocalQuery`), cero desbordamiento horizontal en
360 px, respeto a `prefers-reduced-motion` y montaje diferido de gráficos pesados en `AnalyticsSection` solo cuando se
despliega.

**Constraints**: Cero cambios de reglas de negocio, modelo de datos, migraciones o sync (FR-024); offline-first intacto
(Principios V y XII); dinero en céntimos enteros PEN (Principio VIII); lógica de frases en funciones puras fuera de
componentes (Principio III); copy en español latinoamericano neutro con tuteo y sin voseo (Principio VI); contraste
WCAG AA en claro y oscuro y controles táctiles ≥ 44 px (FR-028).

**Scale/Scope**: 4 módulos puros nuevos (+ tests unitarios), 2 primitivas UI nuevas (`CollapsibleSection`, `EmptyState`),
actualización de `Sheet` y shell (`Layout`, `BottomNav`, `AppTopbar`, `MobileHeader`, `MainFlow`, `LoginScreen`,
`error.tsx`), rediseño de 5 pantallas principales (`FinancesScreen`, `ControlPage`, `SharedSpaceScreen`,
`PersonalProgress`, `SettingsScreen`) y 6 formularios (`QuickRecordSheet`, `MovementForm`, `TransferForm`,
`PaymentAccountForm`, `InstallmentLoanForm`, `DebtForm`), más actualización de tests de presentación afectados.

## Constitution Check

*GATE: Evaluado pre-Phase 0 y re-evaluado post-Phase 1.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Stack y Dependencias | ✅ | 0 dependencias runtime nuevas. Se usan Tailwind, `@base-ui/react`, `lucide-react` y `framer-motion` ya instalados. |
| II. Spec Antes de Código | ✅ | `specs/014-minimalismo-resto-app/spec.md` completa con 7 clarificaciones resueltas antes de planificar/implementar. |
| III. Lógica ≠ UI | ✅ | Toda construcción de frases, cifras protagonistas y conteo de opciones avanzadas vive en `src/core/use-cases/` puros (`buildFinancesHero`, `formatFinancesPhrases`, `formatSharedSpacePhrases`, `formAdvancedFields`). |
| IV. Tests | ✅ | Tests unitarios para las 4 funciones puras nuevas + tests de Testing Library para el cableado nuevo (`CollapsibleSection`, `"Más opciones"`, 5 secciones de Ajustes, selector de Control, pestañas de Finanzas, frases de Espacio Compartido). Sin e2e. |
| V. Persistencia Offline-First | ✅ | Sin cambios a IndexedDB ni sync; todas las pantallas siguen leyendo/escribiendo en repositorios locales y operando 100% offline. |
| VI. Idioma | ✅ | Código/tipos/commits en inglés; copy en español latinoamericano neutro con tuteo y 0 voseo (`voseoGuard.test.ts` + revisión manual). |
| VII. Simplicidad | ✅ | `CollapsibleSection` y `EmptyState` escritos a mano (~40 líneas cada uno); retiro de código muerto (`FinancesKpis`, `MovementTable`). |
| VIII. Dinero como Enteros | ✅ | Todos los montos en céntimos enteros PEN vía `formatMoney` / `<Money>` / `parseMoney`. |
| IX. Membership Explícita | ✅ | Espacio Compartido solo rediseña presentación; mantiene intactas invitaciones, canje y permisos. |
| X. Liquidaciones vs Pagos de Préstamo | ✅ | `DebtList` y `InstallmentLoanList` conservan exactamente sus llamadas de repositorio (`recordSettlement` vs `recordInstallmentPayment` / `recordPrincipalPayment`). |
| XI. Un Solo Sistema de Recordatorios | ✅ | No se crea ningún mecanismo paralelo; Ajustes solo agrupa controles de notificación existentes. |
| XII. Offline-First No Negociable | ✅ | `SharedSpaceBalances` mantiene `useSharedSpaceRealtime` best-effort sobre datos locales. |
| XIII. Conceptos de Dominio Distintos | ✅ | En Control y Hábitos, `Habit`, `Task`, `Goal` y `SavingsGoal` permanecen entidades y paneles separados detrás del selector segmentado. |

**Re-evaluación post-diseño**: sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/014-minimalismo-resto-app/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones R1–R8 y alternativas
├── data-model.md        # Phase 1: modelos derivados de vista (0 cambios persistidos)
├── quickstart.md        # Phase 1: guía de validación automatizada y manual
├── contracts/
│   └── ui-contracts.md  # Phase 1: firmas puras, primitivas UI, breakpoints y copy
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NO creado por /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── error.tsx                                        # NUEVO: pantalla de error cálida (FR-008)
│   ├── layout.tsx                                       # Verificar safe-area y themeColor
│   └── globals.css                                      # Utilidades menores si aplica (sin romper tokens.contrast)
├── components/
│   ├── theme-provider.tsx                               # Sincronizar <meta name="theme-color"> con tema activo
│   └── ui/
│       ├── collapsible-section.tsx                      # NUEVO: bloque colapsable accesible (+ test)
│       ├── empty-state.tsx                              # NUEVO: estado vacío accionable
│       ├── sheet.tsx                                    # Safe-area inferior y footer fijo en móvil
│       └── stat-card.tsx                                # Retirar si queda sin consumidores (grep antes)
├── core/
│   └── use-cases/                                       # NUEVOS (puros, cada uno + .test.ts)
│       ├── buildFinancesHero.ts                         # Protagonistas de las 3 pestañas de Finanzas
│       ├── formatFinancesPhrases.ts                     # Frases 50/30/20, préstamos, deudas y tarjetas
│       ├── formatSharedSpacePhrases.ts                  # Saldo neto, frases por par y división de movimientos
│       └── formAdvancedFields.ts                        # Conteo de opciones activas y etiqueta "Más opciones"
└── presentation/
    ├── hooks/
    │   ├── useMediaQuery.ts                             # Solo verificar que no queden consumidores acoplados a md
    │   └── useFinancesData.ts                           # Exponer tarjetas/préstamos/deudas para buildFinancesHero
    └── components/
        ├── Layout.tsx                                   # Breakpoint lg (1024px) + columna max-w-[720px] + safe-area
        ├── BottomNav.tsx                                # Sentence case, pill CTA único, breakpoint lg
        ├── AppTopbar.tsx · MobileHeader.tsx             # Breakpoint lg, safe-area superior
        ├── MainFlow.tsx                                 # Loading cálido, sentence case, Sheet para SharedSpace
        ├── LoginScreen.tsx                              # Pulido final de tarjetas/botones píldora
        ├── FinancesScreen.tsx                           # 3 pestañas con Segmented en todos los viewports, sin KPIs
        ├── MovementList.tsx                             # Lista agrupada por día (sin MovementTable), edición en Sheet
        ├── finances/
        │   ├── FinancesHeader.tsx                       # Simplificado sin competir con "Nuevo registro"
        │   ├── FinancesKpis.tsx                         # ELIMINADO (FR-002, FR-009)
        │   ├── MovementRows.tsx                         # MovementCard cálida; retirar MovementTable
        │   ├── RuleSection.tsx                          # Hero % gastado + tarjetas con píldoras pastel y frases
        │   └── LoansSection.tsx                         # Hero total deuda + bloque "Te deben" + tarjetas + préstamos + deudas
        ├── InstallmentLoanList.tsx · DebtList.tsx       # Tarjetas redondeadas con frases de estado, edición en Sheet
        ├── ControlPage.tsx                              # Columna única: Hero + Foco de Hoy + Segmented + Analítica
        ├── control/
        │   ├── ControlHeader.tsx                        # Hero de puntaje + WeekStrip limpio (sin "SCORE" ni mayúsculas)
        │   ├── TodayFocusCard.tsx                       # NUEVO: bloque "Foco de Hoy" con acción rápida
        │   ├── HabitsPanel.tsx · TasksPanel.tsx · GoalsPanel.tsx  # Tarjetas cálidas y estados vacíos accionables
        │   └── AnalyticsSection.tsx                     # CollapsibleSection plegada por defecto
        ├── SharedSpaceScreen.tsx · SharedSpaceBalances.tsx        # Hero saldo neto, frases por miembro, lista de movimientos
        ├── SharedSpaceCreate.tsx · SharedSpaceJoin.tsx · SharedSpaceSettings.tsx · SharedMovementForm.tsx  # Flujo simple, copiar código, ajustes plegados y movimiento en Sheet
        ├── PersonalProgress.tsx                         # Cuadrícula ligera 6 logros (Logrado / En curso)
        ├── SettingsScreen.tsx                           # Accesos fijos arriba + 5 CollapsibleSection independientes
        ├── QuickRecordSheet.tsx                         # Título "Nuevo registro", footer fijo en Sheet
        ├── MovementForm.tsx · TransferForm.tsx          # Esenciales + "Más opciones" con contador y auto-expansión
        ├── PaymentAccountForm.tsx · PaymentAccountSettings.tsx · InstallmentLoanForm.tsx · DebtForm.tsx  # Esenciales + "Más opciones" en Sheet
        └── dialogChrome.ts                              # Verificar consumidores y retirar si queda sin uso
```

**Structure Decision**: se respeta estrictamente la arquitectura en capas existente (`core/use-cases` → `presentation/hooks` → `presentation/components` y `components/ui`), sin crear nuevas capas ni modificar `infrastructure/`.

## Orden de implementación sugerido (insumo para /speckit-tasks)

1. **Fundaciones puras y primitivas compartidas**: implementar `buildFinancesHero`, `formatFinancesPhrases`,
   `formatSharedSpacePhrases` y `formAdvancedFields` (con sus tests unitarios), más `CollapsibleSection`,
   `EmptyState` y mejoras de `Sheet` (safe-area + footer fijo).
2. **US1 — Shell, navegación y sistema**: actualizar `Layout` (`lg` + `max-w-[720px]` + safe-area), `BottomNav`
   (sentence case + píldora), `AppTopbar`, `MobileHeader`, `ThemeProvider` (`theme-color`), `MainFlow` (loading +
   sentence case), `LoginScreen` y `src/app/error.tsx`.
3. **US3 — Formularios con "Más opciones"**: actualizar `QuickRecordSheet`, `MovementForm`, `TransferForm`,
   `PaymentAccountForm`, `InstallmentLoanForm` y `DebtForm` (todos en `Sheet` con contador de activas y
   auto-expansión ante error) + tests de cableado.
4. **US2 — Finanzas**: ampliar `useFinancesData` (solo lectura), reescribir `FinancesScreen`, `RuleSection`,
   `LoansSection`, `MovementList`, `MovementRows`, `InstallmentLoanList` y `DebtList`; retirar `FinancesKpis` y
   `MovementTable` + tests.
5. **US4 — Control y Hábitos**: simplificar `ControlHeader`, añadir `TodayFocusCard`, reorganizar `ControlPage` con
   `Segmented` (Hábitos / Tareas / Metas), pulir paneles y `AnalyticsSection` + tests.
6. **US5 — Espacio Compartido**: actualizar `SharedSpaceScreen`, `SharedSpaceBalances` (incl. lista de movimientos
   compartidos), `SharedSpaceCreate`, `SharedSpaceJoin` y `SharedSpaceSettings` + tests.
7. **US6 — Mi Progreso y Ajustes**: actualizar `PersonalProgress` y reorganizar `SettingsScreen` en 5
   `CollapsibleSection` + accesos fijos arriba + deep-link automático + tests.
8. **Limpieza y verificación integral**: verificar consumidores de `StatCard` (retirar si sin uso), correr `pnpm test`,
   `pnpm lint`, `pnpm build`, revisar manualmente `quickstart.md` (360 px, tablet vertical/horizontal, escritorio,
   claro/oscuro, movimiento reducido, offline).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Tests existentes que aserten copy anterior (`"Nuevo Registro"`, `"Control & Hábitos"`, `"EGRESO"`, `"Opciones adicionales"`) o la tabla de escritorio en `MovementList` | Actualizar únicamente las aserciones de presentación acopladas al layout antiguo junto con cada pantalla, preservando todas las aserciones de comportamiento y datos. |
| Deep-links desde ⌘K o Resumen (`editAccountId`, `focus` de tarea/meta/movimiento) apuntando a una sección colapsada o pestaña inactiva | Auto-seleccionar la pestaña correspondiente en `FinancesScreen` / `ControlPage` y auto-abrir `'accounts'` en `SettingsScreen` cuando exista `focus` o `editAccountId`, cubierto con tests dedicados. |
| Teclado móvil tapando campos o botón de guardar dentro de `Sheet` | `SheetContent` limita altura con `max-h-[92dvh]`, usa scroll interno (`overscroll-contain`) y mantiene el botón de guardar en un bloque sticky inferior con `env(safe-area-inset-bottom)`. |
| Contraste insuficiente en píldoras pastel o badges nuevos en claro/oscuro | Reutilizar exclusivamente tokens verificados por `src/tokens.contrast.test.ts` y ampliar las pruebas si se agrega algún par nuevo. |
| Regresión de voseo o tipografía monoespaciada/mayúsculas en copy nuevo | Ejecutar `voseoGuard.test.ts` y `typographyGuard.test.ts` + revisión manual de conjugaciones no cubiertas por regex. |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
