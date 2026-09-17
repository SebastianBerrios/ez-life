# Spec 005 — Labels en selects, alta de metas de ahorro, densidad de UI

## Contexto

Usuario reportó tres problemas al probar la app en el navegador (screenshot de
`MovementForm` adjunto en la sesión): los `<Select>` muestran el UUID crudo en
vez del nombre, no hay forma de registrar una meta de ahorro, y la UI se
siente apretada en toda la app. Los tres se investigaron y confirmaron contra
el código fuente antes de escribir este spec — no son hipótesis.

---

## Problemas confirmados y decisiones (por interrogatorio con el usuario)

### 1. UUID visible en los `<Select>`

**Causa raíz**: `@base-ui/react`'s `Select.Value` (ver
`node_modules/@base-ui/react/select/value/SelectValue.js`) solo resuelve un
label automáticamente si `Select.Root` recibe una prop `items` (array/record
value→label) — si no, cae a `stringifyAsLabel(value)`, que para un string
simple (nuestro `c.id`) devuelve el valor crudo. `src/components/ui/select.tsx`
nunca pasa `items` a `SelectPrimitive.Root`, y ningún call site pasa una
función `children` a `SelectValue` tampoco. Esto **no es específico de
`MovementForm`** — es un bug estructural del wrapper compartido, afecta a
cualquier `<Select>` presente o futuro en la app.

**Decisión**: arreglar una sola vez en `src/components/ui/select.tsx`, no por
cada call site. La forma más simple compatible con la API de base-ui: hacer
que el wrapper `Select` (el `SelectPrimitive.Root` re-exportado) acepte y
reenvíe una prop `items`, y que cada call site actual (`MovementForm.tsx`)
construya ese `items` array (`{value: c.id, label: c.name}[]`) a partir de los
datos que ya tiene cargados. Alternativa aceptable si es más prolija dado el
API real de base-ui: que `SelectValue` internamente use `children` con función
de mapeo recibiendo la lista de opciones vía contexto — elegir lo que sea más
simple de mantener sin romper la API pública de los componentes ya usados en
el resto de la app.

**Archivos afectados**: `src/components/ui/select.tsx` (fix),
`src/presentation/components/MovementForm.tsx` (pasar los `items`/labels en
sus 4 selects: bucket, categoría, subcategoría, meta de ahorro).

---

### 2. No se puede registrar una meta de ahorro

**Causa raíz**: `SavingsGoalForm.tsx` existe y es funcional (usa
`LocalSavingsGoalRepository` correctamente), pero **no está conectado a
ningún botón ni ruta** — `SavingsGoalList.tsx` es de solo lectura/borrado, y
`MainFlow.tsx` nunca importa ni renderiza `SavingsGoalForm`. Además, tanto
`SavingsGoalForm.tsx` como `SavingsGoalList.tsx` siguen con clases
hardcodeadas pre-design-system (`bg-white`, `text-gray-*`, `text-blue-*`,
`border-gray-*`) — nunca pasaron por la migración a tokens que sí tuvo el
resto de la app en `specs/003`.

**Decisión**: conectar el formulario Y migrar el estilo en la misma pasada
(el usuario lo pidió explícitamente así, para no volver a tocar estos
archivos después).

**Criterios**:
- Agregar un botón "+ Nueva meta" en la pantalla de Metas (`currentRoute === 'goals'` en `MainFlow.tsx`), mismo patrón de modal que ya usa el FAB de "Nuevo movimiento" (`showMovementForm` en `MainFlow.tsx:180-202`) — no hace falta un FAB fijo nuevo, un botón dentro del header de la sección alcanza (la pantalla de Metas no tiene FAB hoy y no se pidió agregar uno).
- `SavingsGoalForm.tsx` y `SavingsGoalList.tsx`: reemplazar clases hardcodeadas por los tokens ya establecidos en el resto de la app (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, `rounded-xl`/`rounded-2xl` según el patrón de cada tipo de elemento — mirar `MovementForm.tsx` y `SettingsScreen.tsx` como referencia de estilo ya migrado).

**Archivos afectados**: `src/presentation/components/SavingsGoalForm.tsx` (MODIFY — estilo),
`src/presentation/components/SavingsGoalList.tsx` (MODIFY — estilo),
`src/presentation/components/MainFlow.tsx` (MODIFY — wiring del botón + modal).

---

### 3. Densidad de UI apretada en toda la app

Usuario confirmó que es una combinación de los tres factores. Causa raíz
confirmada en los componentes base (`src/components/ui/`):

- **Controles táctiles chicos**: `Button` (`buttonVariants` en `button.tsx`)
  usa `h-8` (32px) como tamaño `default`; `Input` (`input.tsx`) es `h-8`;
  `SelectTrigger` (`select.tsx`) es `data-[size=default]:h-8`. Todos por
  debajo del mínimo recomendado de 44px (WCAG 2.5.5 / Apple HIG) para tocar
  cómodo en mobile, que es el target primario de esta app (RNF-02).
- **Espaciado ajustado**: patrones repetidos de `space-y-2`/`gap-2` y
  `p-4` en cards/formularios donde otras partes de la app ya usan `p-5`/`p-6`
  — inconsistente y en general angosto.
- **Tipografía chica**: uso pervasivo de `text-sm` (14px) para contenido
  primario (labels, valores, texto de botones) y `text-xs` (12px) incluso
  para texto no-decorativo.

**Decisión**: auditoría completa de las tres dimensiones, aplicada a los
componentes base de `src/components/ui/` primero (para que el fix se
propague a toda la app sin tocar cada pantalla una por una), más ajustes
puntuales en componentes de `src/presentation/` que definan tamaños propios
fuera de esos primitivos (ej. el `w-14 h-14` del FAB no es un problema — ya
es táctil; los `h-16` items del bottom nav tampoco).

**Criterios concretos**:
- `Button`: tamaño `default` sube de `h-8` a `h-11` (44px); `lg` de `h-9` a
  `h-12`; `sm` de `h-7` a `h-9`; `xs` se mantiene en `h-6` (uso explícito para
  controles secundarios muy compactos, ej. el `×` de borrar subcategoría en
  `Step3Categories` — no es un tap target primario). `icon`/`icon-sm`/`icon-lg`
  ajustar en la misma proporción que sus contrapartes no-icon.
- `Input`: `h-8` → `h-11`.
- `SelectTrigger`: `data-[size=default]:h-8` → `h-11`; `data-[size=sm]:h-7` → `h-9`.
- Tipografía: texto primario (labels de formulario, texto de botones, nombres
  en listas/cards) de `text-sm` a `text-base`; texto secundario/metadata
  (timestamps, helper text, contadores) se queda en `text-sm` como piso — no
  bajar nada a `text-xs` salvo elementos genuinamente decorativos (badges,
  contadores de progreso muy chicos).
- Espaciado: estandarizar `space-y-2`/`gap-2` a `space-y-3`/`gap-3` en
  formularios y listas de items; `p-4` a `p-5` en cards de contenido
  (dashboard, listas, settings) donde hoy conviven con otras que ya usan
  `p-5`/`p-6`.
- No se toca el layout/grid general (sidebar, bottom nav, FAB) — esos ya
  cumplen tamaño táctil adecuado.

**Archivos afectados**: `src/components/ui/button.tsx`, `input.tsx`,
`select.tsx` (MODIFY — tokens base); barrido de `src/presentation/components/*`
donde se usen `text-sm`/`text-xs` para contenido primario o `space-y-2`/`gap-2`/`p-4`
en contenedores de contenido (no en elementos ya intencionalmente compactos).

---

## Restricciones

- Sin nuevas dependencias runtime (constitución, regla 7).
- No se toca lógica de negocio — estos tres ítems son de UI/estilo y de
  wiring de un componente ya existente, no de `core/use-cases`.
- `AnalysisScreen.tsx`, `Dashboard.tsx` y demás componentes ya migrados a
  tokens en `specs/004` no deberían necesitar cambios de color, solo de
  tamaño/spacing si les aplica el criterio de arriba.
- Al terminar: `pnpm test` en verde, `pnpm lint` sin errores, `npx tsc --noEmit`
  sin errores nuevos.
- No se escriben tests unitarios nuevos para estos cambios (son de estilo/UI,
  mismo criterio de bajo ROI ya usado en `specs/003`) — excepto si el wiring
  de `SavingsGoalForm` requiere lógica nueva no cubierta, que no es el caso
  (reutiliza el repositorio ya testeado).

---

## Archivos modificados

| Archivo | Estado | Descripción |
|---|---|---|
| `specs/005-select-labels-goals-density/spec.md` | NEW | Este archivo |
| `src/components/ui/select.tsx` | MODIFY | Fix de label resolution (`items`) |
| `src/components/ui/button.tsx` | MODIFY | Tamaños táctiles (`h-8`→`h-11` default, etc.) |
| `src/components/ui/input.tsx` | MODIFY | `h-8` → `h-11` |
| `src/presentation/components/MovementForm.tsx` | MODIFY | Pasar `items` a los 4 selects |
| `src/presentation/components/SavingsGoalForm.tsx` | MODIFY | Migrar a tokens del design system |
| `src/presentation/components/SavingsGoalList.tsx` | MODIFY | Migrar a tokens del design system |
| `src/presentation/components/MainFlow.tsx` | MODIFY | Botón + modal para crear meta |
| Resto de `src/presentation/components/*` | MODIFY | Ajuste de spacing/tipografía según criterios de la sección 3 |
