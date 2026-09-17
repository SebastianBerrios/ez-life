# Spec 003 — Onboarding Wizard & Expense Categories

> [!NOTE]
> Entrega histórica — ver `specs/001-ezlife-mvp/spec.md` para el estado
> vigente de requisitos.

## Contexto

Esta entrega unifica los bugs pendientes de la spec 002 (nunca implementados) con dos features nuevos que el usuario requiere: un wizard de onboarding multi-step completo y la gestión de categorías/subcategorías de gasto en el formulario de movimientos.

> [!IMPORTANT]
> La spec 002 queda **supersedida y cerrada** por esta entrega. Todos los ítems de 002 que no se implementaron se absorben aquí. Los ítems de 002 ya resueltos en código se marcan como `[RESUELTO]`.

---

## Problemas que resuelve

### Bugs de la spec 002 pendientes

1. **[OPEN] UUID visible en el Select de «Categoría (50/30/20)» en `MovementForm`** — El Select de base-ui/react renderiza antes de que los datos asincrónicos estén disponibles, mostrando el ID en vez del nombre.
2. **[OPEN] Layout tablet/desktop roto** — `main` con `md:ml-56 lg:ml-64` no corresponde al ancho real del sidebar en breakpoints intermedios. Los nav links no tienen consistencia visual en tablet.
3. **[OPEN] FAB mobile** — El FAB existe en código pero no tiene visibilidad correcta (z-index, posición, tamaño).
4. **[RESUELTO] `calculateMonthlyCycle` sin import** — Verificado que ya está importado en `Dashboard.tsx`. No requiere acción.
5. **[OPEN] Foto de perfil OAuth no se muestra** — `avatar_url` se lee pero no se muestra en el header mobile; solo aparece "U" hardcodeado.
6. **[OPEN] `MovementList` usa clases hardcodeadas** — `bg-white`, `text-gray-*` rompen el dark mode. Deben reemplazarse por tokens CSS del sistema.
7. **[OPEN] `OnboardingStep1` usa clases hardcodeadas** — `bg-white`, `text-blue-*`; no usa el design system.

### Features nuevos

8. **[NEW] Wizard de onboarding multi-step** — Reemplazar el flujo actual (`onboarding-1` → `onboarding-2` como pantallas independientes) por un wizard unificado de 3 pasos:
   - Step 1: Ingresos
   - Step 2: Distribución 50/30/20
   - Step 3: Categorías de gasto con subcategorías

   Características:
   - Progress indicator visual (numerado con línea conectora, estados activo/completado).
   - Reanudar si el usuario cierra a mitad: el sistema detecta en qué paso quedó y retoma desde ahí.
   - El wizard se reutiliza desde Ajustes (entrada directa al step que corresponda).

9. **[NEW] Categorías y subcategorías de gasto en `MovementForm`** — Al registrar un gasto, mostrar selectores de categoría de gasto (ej. Comida) y subcategoría (ej. Almuerzo) debajo del selector de distribución. Comportamiento:
   - Selectores cascadeados: cambiar categoría limpia y recarga subcategoría.
   - `expense_category_id` y `expense_subcategory_id` ya existen en el tipo `Movement` y en `LocalMovementRepository`; solo se conecta la UI.

10. **[NEW] Gestión de categorías en el wizard (Step 3)** — UI para:
    - Ver categorías existentes con sus subcategorías como cards.
    - Crear categorías de gasto con nombre (input inline + botón «Agregar»).
    - Agregar subcategorías a cada categoría inline.
    - Eliminar categorías (con validación: si tiene movimientos asociados vía `countByExpenseCategory`, bloquear con mensaje de error).
    - Eliminar subcategorías (validación con `countByExpenseSubcategory`).
    - **Seed inicial**: si no existen categorías al llegar al step 3, pre-popular automáticamente:
      - Alimentación → Desayuno, Almuerzo, Cena, Snack
      - Ocio → Deporte, Cine, Fiesta, Restaurante
      - Transporte → Combustible, Taxi/Uber, Transporte público

---

## Restricciones

- Sin nuevas dependencias runtime.
- No se toca lógica de negocio ni repositorios (ya están completos).

  > [!NOTE]
  > Esto resultó ser falso: `specs/004-category-hierarchy-and-analysis/spec.md`
  > encontró que la relación categoría de gasto ↔ categoría de distribución
  > nunca existió en el modelo de datos, y requirió cambios de modelo y
  > repositorio en esa entrega siguiente.

- Todos los tests existentes deben seguir pasando (`pnpm test`).
- `pnpm lint` sin errores al terminar.
- No se escriben tests unitarios para los nuevos componentes UI del wizard (costo alto, ROI bajo para UI de onboarding).

---

## Archivos modificados y nuevos

| Archivo | Estado | Descripción |
|---|---|---|
| `specs/003-onboarding-wizard-and-categories/spec.md` | NEW | Este archivo |
| `src/presentation/components/OnboardingWizard.tsx` | NEW | Wizard unificado de 3 pasos |
| `src/presentation/components/OnboardingStep1.tsx` | MODIFY | Aplicar design system tokens; mantener lógica |
| `src/presentation/components/MovementForm.tsx` | MODIFY | Agregar selectores de `expense_category_id` y `expense_subcategory_id`; fix UUID bug |
| `src/presentation/components/MovementList.tsx` | MODIFY | Reemplazar clases hardcodeadas por tokens del sistema |
| `src/presentation/components/MainFlow.tsx` | MODIFY | Reemplazar flujo `onboarding-1`/`onboarding-2` con `OnboardingWizard`; gate de onboarding también detecta ausencia de `expense_categories` |
| `src/presentation/components/SettingsScreen.tsx` | MODIFY | Botón «Editar Categorías» lleva al wizard completo; mejorar copy |
| `src/presentation/components/Layout.tsx` | NO CHANGE | Solo passthrough de props; no requiere cambios |
