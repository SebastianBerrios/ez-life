# spec.md — 006-qa-remediation

## Contexto

Esta spec nace de una auditoría de QA que contrastó las specs `001-ezlife-mvp`
a `005-select-labels-goals-density` contra `docs/constitution.md` y, en un
segundo paso, contrastó los hallazgos de esa auditoría contra el código real
del repositorio. El resultado se consolidó en un plan de remediación completo,
aprobado por el usuario, ejecutado en fases:

- **Fase 0** (esta spec): autoriza el trabajo de código de las fases 3-5,
  conforme a `docs/constitution.md` regla 2 ("código sin spec no está
  autorizado").
- **Fase 1**: correcciones de gobernanza en `docs/constitution.md` y
  `AGENTS.md`.
- **Fase 2**: consolidación del corpus de specs — `specs/001-ezlife-mvp/spec.md`
  pasa a ser la fuente de verdad vigente de requisitos; `002`-`005` quedan
  marcadas como entregas históricas.
- **Fases 3-5**: implementación de código (fuera del alcance de esta spec;
  ejecutadas por otro writer). Ver la sección "Fases 3-5" más abajo para la
  referencia de qué habilita esta spec.

> [!NOTE]
> Esta spec es puramente de gobernanza/habilitación documental. No se
> modificó ningún archivo bajo `src/` como parte de su redacción.

---

## Alcance

Esta spec habilita los siguientes requisitos funcionales nuevos o enmendados,
todos derivados de decisiones ya cerradas durante la auditoría de QA:

**RF-22 — Validación estricta de monto en movimientos**
Implementa el criterio agregado a `specs/001-ezlife-mvp/spec.md` RF-09: el
monto de un movimiento debe ser un entero mayor a 0 (céntimos); el sistema
debe rechazar valores `NaN`, negativos o cero, tanto en la UI (`MovementForm`)
como en la capa de use-case/repositorio.

**RF-23 — Desempate determinista en el redondeo de distribución**
Implementa el criterio agregado a `specs/001-ezlife-mvp/spec.md` RF-07:
cuando el céntimo sobrante del reparto porcentual empata entre dos o más
categorías de distribución en el porcentaje más alto, gana la categoría con
el `id` menor en orden lexicográfico.

**RF-24 — Toggle editable de `is_savings` en Step 2 del onboarding**
El usuario puede marcar/desmarcar qué bucket de distribución tiene
`is_savings: true` desde el editor dinámico de Step 2. Invariante: debe
existir en todo momento exactamente un bucket activo con `is_savings: true`;
el sistema debe impedir borrar o desmarcar el último bucket de ahorro
restante.

**RF-25 — Borrado de bucket de distribución valida también movimientos**
`specs/004-category-hierarchy-and-analysis/spec.md` decisión 5 bloqueaba el
borrado de un bucket solo por categorías de gasto asociadas
(`countExpenseCategoriesByDistribution`). Esta spec extiende la validación
para bloquear también cuando existen movimientos asociados a las categorías
de gasto de ese bucket, no solo cuando existen las categorías en sí.

**RF-26 — Semántica de tombstone en la capa de sync**
`CustomSyncLayer` resuelve conflictos por `last-write-wins` basado en
`updated_at` (RF-18). Esta spec agrega un caso explícito: cuando el conflicto
es entre un borrado local (tombstone) y una edición remota con timestamp más
reciente, gana el tombstone — el borrado se respeta.

**RF-27 — Idempotencia de generación de movimientos recurrentes**
Implementa el criterio agregado a `specs/001-ezlife-mvp/spec.md` RF-12: si el
proceso de generación de movimientos recurrentes se interrumpe a mitad de
camino, un reintento no debe duplicar movimientos ya generados para el mismo
ciclo.

**RF-28 — Relocalización del fix de labels de `<Select>` al primitivo**
`specs/005-select-labels-goals-density/spec.md` decidió arreglar el bug de
labels UUID una sola vez en `src/components/ui/select.tsx`. La implementación
real terminó resolviéndolo en el call site (`MovementForm.tsx`), dejando el
primitivo sin el fix — ver nota agregada en `specs/005/spec.md` sección 1.
Esta spec mueve el fix al primitivo, como se decidió originalmente, para que
cubra cualquier `<Select>` presente o futuro en la app.

**RF-29 — Extracción de la exportación CSV/PDF a un use-case puro**
La lógica de exportación (RF-17) vive hoy dentro de `SettingsScreen.tsx`,
violando la regla 3 de la constitución (lógica de negocio fuera de
componentes React). Esta spec extrae la construcción de filas/columnas y el
armado del documento a un use-case puro en `core/use-cases`, dejando en el
componente solo la invocación y el trigger de descarga.

---

## Justificación retroactiva de dependencias

`jspdf` y `jspdf-autotable` ya están presentes en `package.json` y en uso en
`SettingsScreen.tsx` desde antes de esta spec, implementando la exportación a
PDF de RF-17. Ninguna spec anterior (001-005) las declaró ni las justificó
explícitamente, incumpliendo las reglas 1 y 7 de la constitución (toda nueva
dependencia runtime requiere justificación en spec). Esta spec cierra ese
incumplimiento de forma retroactiva:

- **Justificación**: generar PDF con tablas formateadas a mano (sin librería)
  supera ampliamente el umbral de "menos de 50 líneas de valor" de la regla 7
  — maquetación de página, paginación, tablas con estilos y saltos de página
  no son razonables de reimplementar a mano.
- **Alcance de uso**: exclusivamente en el use-case de exportación extraído
  por RF-29; no se introducen usos adicionales de estas dependencias.

---

## Restricciones

- Sin nuevas dependencias runtime más allá de `jspdf`/`jspdf-autotable`, ya
  justificadas arriba (constitución, regla 7).
- Lógica de negocio en `core/use-cases`, cero lógica en componentes React
  (constitución, regla 3).
- Cada nuevo use-case con al menos un test unitario (Vitest) (constitución,
  regla 4).
- Todos los montos en céntimos enteros (constitución, regla 8).
- Al terminar: `pnpm test` en verde, `pnpm lint` sin errores, verificar que el
  flujo completo funciona sin conexión (offline-first, constitución regla 5 /
  RNF-01).

---

## Fases 3-5 (para referencia, no las implementás en esta tarea)

Tabla de archivos que el plan aprobado identifica para las fases de código.
Esta tabla es referencial — la ejecuta un writer distinto en una tarea
separada.

| Archivo | Estado | RF relacionado | Descripción |
|---|---|---|---|
| `specs/006-qa-remediation/spec.md` | NEW | — | Este archivo |
| `src/core/use-cases/validateMovementAmount.ts` | NEW | RF-22 | Pure function: valida monto entero > 0, rechaza `NaN`/negativos/cero |
| `src/core/use-cases/validateMovementAmount.test.ts` | NEW | RF-22 | Tests unitarios |
| `src/presentation/components/MovementForm.tsx` | MODIFY | RF-22 | Usa el use-case de validación antes de guardar |
| `src/core/use-cases/calculateBudgets.ts` | MODIFY | RF-23 | Desempate por `id` lexicográfico menor en vez de heurística implícita |
| `src/core/use-cases/calculateBudgets.test.ts` | MODIFY | RF-23 | Test de empate agregado |
| `src/presentation/components/OnboardingStep2.tsx` | MODIFY | RF-24 | Toggle de `is_savings` por bucket, con invariante de único activo |
| `src/core/use-cases/validateDeletion.ts` | MODIFY | RF-25 | Bloquear borrado de bucket también por movimientos asociados a sus categorías |
| `src/core/use-cases/validateDeletion.test.ts` | MODIFY | RF-25 | Test del nuevo caso |
| `src/infrastructure/sync/CustomSyncLayer.ts` | MODIFY | RF-26 | Semántica de tombstone: borrado local gana sobre edición remota más reciente |
| `src/infrastructure/sync/CustomSyncLayer.test.ts` | MODIFY | RF-26 | Test del caso de conflicto tombstone vs. edición |
| `src/core/use-cases/evaluateRecurrence.ts` | MODIFY | RF-27 | Idempotencia ante reintento tras interrupción |
| `src/core/use-cases/evaluateRecurrence.test.ts` | MODIFY | RF-27 | Test de reintento sin duplicados |
| `src/components/ui/select.tsx` | MODIFY | RF-28 | Fix de resolución de labels (`items`) movido al primitivo |
| `src/presentation/components/MovementForm.tsx` | MODIFY | RF-28 | Deja de armar `items` a mano; usa el fix del primitivo |
| `src/core/use-cases/exportMovements.ts` | NEW | RF-29 | Pure function: arma filas/columnas para CSV y estructura de documento para PDF |
| `src/core/use-cases/exportMovements.test.ts` | NEW | RF-29 | Tests unitarios |
| `src/presentation/components/SettingsScreen.tsx` | MODIFY | RF-29 | Delega armado de datos al use-case; solo invoca `jspdf`/descarga |
