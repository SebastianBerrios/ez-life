# Spec 004 — Jerarquía real de categorías y vista de Análisis

## Contexto

Auditoría del código actual (ver sesión de grilling previa a este spec) encontró que
la relación que el producto siempre asumió — categoría de distribución (%) →
categoría de gasto → subcategoría — **nunca existió en el modelo de datos**.
`ExpenseCategory` y `DistributionCategory` son hoy dos tablas independientes,
unidas solo porque un `Movement` guarda ambos IDs por separado, sin ninguna
validación cruzada. Esto contradice `specs/001-ezlife-mvp/spec.md` RF-08
("Cada categoría de gasto debe estar asociada a exactamente una categoría de
distribución") y es la causa raíz de que el usuario pueda clasificar un gasto
bajo un bucket de % distinto al que realmente le corresponde.

Esta entrega también incorpora RF-15 (vista "Análisis"), que nunca se
implementó, porque depende de la misma relación jerárquica para tener sentido.

> [!NOTE]
> Los 6 ítems "OPEN" listados en `specs/003-onboarding-wizard-and-categories/spec.md`
> (flash de UUID, layout tablet, FAB, avatar OAuth, clases hardcodeadas en
> `MovementList` y `OnboardingStep1`) fueron verificados contra el código actual
> y ya están resueltos — el spec.md de 003 quedó desactualizado. No requieren
> trabajo; se puede optimizar al pasar por esos archivos si surge la oportunidad,
> pero no es un objetivo de esta entrega.

---

## Decisiones (cerradas por interrogatorio con el usuario)

1. **Modelo de datos**: `ExpenseCategory` gana `distribution_category_id: UUID`
   (obligatorio). `DistributionCategory` gana `is_savings: boolean` (reemplaza
   el detection por nombre `.includes('ahorro')` que existe hoy en
   `MovementForm.tsx`).
2. **Sin migración de datos reales**: no hay usuarios en producción todavía.
   Bump de versión de Dexie (`db.ts`), reset limpio permitido — no hace falta
   escribir un `.upgrade()` que preserve filas viejas de `expense_categories`.
3. **Distribución (Step 2) pasa a ser dinámica**: agregar/quitar/renombrar
   buckets de %, no solo los 3 fijos (Necesidades/Gustos/Ahorro). Validación
   de suma = 100% se mantiene igual que hoy.
4. **Seed de buckets default**: al entrar por primera vez a Step 2, los 3
   buckets default se crean como filas reales en la DB inmediatamente (no solo
   estado local de React) — el bucket "Ahorro e Inversión" con
   `is_savings: true`. Sus IDs quedan fijos para que el seed de categorías del
   Step 3 los referencie directamente, sin buscar por nombre (que ya no es
   confiable una vez que el usuario puede renombrar/borrar buckets).
5. **Borrado de bucket de distribución**: bloqueado si (a) es el último bucket
   restante (mínimo 1 siempre), o (b) tiene categorías de gasto asociadas
   (`countExpenseCategoriesByDistribution(id) > 0`).
6. **Borrado de última subcategoría**: bloqueado, igual patrón que el bloqueo
   existente por movimientos asociados — una categoría de gasto no puede
   quedar con cero subcategorías.
7. **`MovementForm` — selector cascada de 3 niveles real**: bucket → categoría
   (filtrada por `distribution_category_id`, excluyendo categorías sin
   subcategorías) → subcategoría (filtrada por categoría). El selector de
   bucket se queda (no se retira) porque filtra la lista y evita que el
   usuario tenga que buscar entre todas las categorías de todos los buckets.
8. **Picker de meta de ahorro**: se habilita por `is_savings === true` del
   bucket elegido, no por string-match del nombre.
9. **Dashboard**: sin cambios visuales, pero gana navegación entre ciclos
   pasados/futuros reutilizando `calculateMonthlyCycle(fecha)` con fecha
   variable (ya soportado, solo falta la UI de navegación y el estado).
10. **Nueva vista "Análisis" (RF-15)**: nuevo ítem de navegación
    (`dashboard`, `movements`, `analysis`, `goals`, `settings` — 5 íconos).
    Árbol bucket → categoría → subcategoría con montos reales gastados,
    colapsado por default (categorías visibles con su total; se expande para
    ver subcategorías). Misma navegación de ciclos que el Dashboard. Sin
    cálculo de presupuesto a nivel categoría — solo desglose de gasto real
    (el presupuesto/advertencia de exceso es exclusivo del nivel bucket, por
    RF-07/RF-11, y ya vive en `Dashboard`).
11. **`SettingsScreen`**: dos botones separados — "Editar distribución (%)"
    (abre el wizard en Step 2) y "Gestionar categorías de gasto" (abre el
    wizard en Step 3).
12. **Subcategoría opcional en `MovementForm`**: `specs/001-ezlife-mvp/spec.md`
    RF-09 pedía subcategoría obligatoria al registrar un egreso. Decisión
    explícita del usuario en esta entrega: **queda opcional**. Un gasto puede
    registrarse con categoría pero sin subcategoría específica (ej. un gasto
    de "Alimentación" sin desglosar en Almuerzo/Cena). RF-09 queda
    modificado por este spec — la subcategoría es dato enriquecedor, no
    bloqueante.

---

## Requisitos funcionales de esta entrega

**RF-19 — Integridad categoría↔distribución**
Toda categoría de gasto pertenece a exactamente un bucket de distribución.
Criterios: no se puede crear una categoría de gasto sin bucket; no se puede
borrar un bucket que tiene categorías asociadas; `MovementForm` nunca permite
seleccionar una combinación categoría/bucket inconsistente porque el segundo
nivel del selector filtra por el primero.

**RF-20 — Gestión dinámica de buckets de distribución**
El usuario puede agregar, renombrar y eliminar categorías de distribución
desde Step 2 del wizard (y desde Ajustes → "Editar distribución").
Criterios: suma debe ser exactamente 100% para guardar; no se permite bajar de
1 bucket; no se permite borrar un bucket con categorías de gasto asociadas.

**RF-21 — Vista de Análisis**
El sistema debe ofrecer una pantalla de Análisis con desglose de gasto real
por bucket → categoría → subcategoría del ciclo seleccionado, con navegación
a ciclos anteriores.

---

## Restricciones

- Sin nuevas dependencias runtime (constitución, regla 7).
- Lógica de negocio en `core/use-cases`, cero lógica en componentes React
  (constitución, regla 3).
- Cada nuevo use-case con al menos un test unitario (Vitest) (constitución,
  regla 4).
- Todos los montos en céntimos enteros (constitución, regla 8).
- Al terminar: `pnpm test` en verde, `pnpm lint` sin errores, verificar que el
  flujo completo funciona sin conexión (offline-first, constitución regla 5 /
  RNF-01).

---

## Archivos modificados y nuevos

| Archivo | Estado | Descripción |
|---|---|---|
| `specs/004-category-hierarchy-and-analysis/spec.md` | NEW | Este archivo |
| `src/core/domain/models/types.ts` | MODIFY | `ExpenseCategory.distribution_category_id`; `DistributionCategory.is_savings` |
| `src/core/domain/repositories/IRepositories.ts` | MODIFY | `ICategoryRepository.countExpenseCategoriesByDistribution(id)` |
| `src/infrastructure/db/db.ts` | MODIFY | Bump versión Dexie, índice `distribution_category_id` en `expense_categories` |
| `src/infrastructure/repositories/local/LocalCategoryRepository.ts` | MODIFY | Persistir `distribution_category_id` / `is_savings`; nuevo método de conteo |
| `src/core/use-cases/validateDeletion.ts` | MODIFY | Mensaje parametrizable (movimientos vs. categorías asociadas) |
| `src/core/use-cases/calculateCategoryBreakdown.ts` | NEW | Pure function: movimientos + categorías → árbol bucket/categoría/subcategoría con totales |
| `src/presentation/components/OnboardingStep2.tsx` | MODIFY | Editor dinámico de buckets (agregar/renombrar/eliminar) |
| `src/presentation/components/OnboardingWizard.tsx` | MODIFY | `Step3Categories` agrupado por bucket; seed por ID real |
| `src/presentation/components/MovementForm.tsx` | MODIFY | Cascada de 3 niveles real; `is_savings` en vez de string-match |
| `src/presentation/components/Dashboard.tsx` | MODIFY | Navegación entre ciclos |
| `src/presentation/components/AnalysisScreen.tsx` | NEW | Árbol de desglose por bucket/categoría/subcategoría |
| `src/presentation/components/BottomNav.tsx` | MODIFY | Nuevo ítem "Análisis" |
| `src/presentation/components/SettingsScreen.tsx` | MODIFY | Dos botones (distribución / categorías) |
| `src/presentation/components/MainFlow.tsx` | MODIFY | Ruta `analysis`; `onEditDistribution` → wizard Step 2 |
| Tests existentes afectados | MODIFY | `OnboardingStep2.test.tsx`, `MovementForm.test.tsx`, `LocalRepositories.test.ts` — actualizar al nuevo comportamiento |
