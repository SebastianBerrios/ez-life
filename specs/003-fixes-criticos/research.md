# Research: 003-fixes-criticos

Investigación de causa raíz realizada en dos pasadas de exploración de código más una
reproducción de persistencia (test descartable, borrado tras la corrida). Ver plan.md §Constitution
Check para cómo cada decisión respeta la constitución v2.0.0.

## 1. Dropdown/select se superpone a la opción actual

- **Decision**: el fix va en el componente compartido `src/components/ui/select.tsx`
  (`SelectContent`), no en cada formulario. Cambiar el comportamiento por defecto de
  `alignItemWithTrigger` (hoy `true`) para que el menú se ancle debajo del trigger (`side="bottom"`)
  en vez de superponer el ítem seleccionado sobre el trigger.
- **Rationale**: la librería de base es `@base-ui/react` (no Radix — `components.json` usa el
  estilo `base-nova`; no hay ningún paquete `@radix-ui/*` en `package.json`). Su `Select` soporta
  `alignItemWithTrigger` como comportamiento "estilo `<select>` nativo" (el ítem actual se posiciona
  exactamente sobre el trigger) — eso es precisamente la superposición reportada, no un bug de
  z-index (ya usa `isolate z-50` correctamente). El componente es compartido por las 9 instancias de
  Select de la app (`MovementForm.tsx` x4, `SharedMovementForm.tsx` x2, `DebtForm.tsx` x1,
  `InstallmentLoanList.tsx` x1, `SettingsScreen.tsx` x1), así que corregir el default ahí resuelve
  el problema transversal de una sola vez, sin tocar cada formulario.
- **Alternatives considered**: parchear cada sitio de uso individualmente (rechazado: 9 sitios,
  mismo fix repetido, viola Principio VII/DRY); migrar a Radix (rechazado: reemplazo de librería
  entera sin relación con el bug real, altísimo costo/riesgo para este fix).

## 2. Reactividad tras crear un registro

- **Decision**: extender el patrón de refresh-por-key ya usado y probado para `SavingsGoal`
  (`goalsRefreshKey` en `MainFlow.tsx:284`, `key={goalsRefreshKey}` remonta `SavingsGoalList`) a
  Movement, Habit y Task. Cada creación exitosa incrementa un contador de estado en el componente
  padre que controla esa vista, pasado como `key` al componente de lista correspondiente para
  forzar remount + refetch inmediato.
- **Rationale**: no existe `dexie-react-hooks`/`useLiveQuery` en el proyecto (confirmado: ausente en
  `package.json`, cero usos en el código). Agregarlo sería una dependencia nueva que requiere
  justificación explícita (Principio I) y un refactor más amplio (envolver cada repo read en un
  observable) para un problema que el patrón ya existente resuelve con líneas de estado triviales
  (Principio VII, Simplicidad — el patrón ya probado en Goals es <10 líneas por sitio).
  Confirmado que `MovementList` (`MainFlow.tsx:262-264`) no tiene ningún key/refreshKey — bug real,
  sin wiring. `InstallmentLoanList` ya se refresca sola (`loadLoans()` tras cada pago, correcto, sin
  cambios necesarios ahí).
- **Alternatives considered**: adoptar `dexie-react-hooks` (`useLiveQuery`) en todo el proyecto
  (rechazado para el alcance de este fix: dependencia nueva + refactor mayor, desproporcionado
  frente al bug puntual; queda como mejora futura si se justifica en una spec propia).

## 3. Hábitos invisibles en Control

- **Decision**: `HabitList` ya está montado en `ControlPage` (`ControlPage.tsx:74`, desde spec 002)
  — el fix NO es "montar la lista", es cambiar el filtro de `isHabitScheduledToday` para que nunca
  oculte un hábito por completo: un hábito no programado para hoy se muestra igual, con una marca
  visual de "no corresponde hoy" en vez de desaparecer de la lista.
- **Rationale**: `HabitList.tsx:39` descarta (`return null`) cualquier hábito no programado para el
  día actual según su `schedule_mode`. Esto explica el síntoma reportado sin requerir ningún cambio
  de reactividad adicional — un hábito con `fixed_days: ['sat']` es literalmente invisible de lunes
  a viernes, lo que se percibe como "no veo mis hábitos".
- **Alternatives considered**: ninguna — es un fix de una condición de filtrado puntual.

## 4. Préstamos: cuotas y Movement

- **Decision**:
  - `recordInstallmentPayment.ts` y `recordPrincipalPayment.ts` (pure use-cases) pasan a devolver,
    además de los campos que ya devuelven, una descripción del `Movement` de egreso a crear (monto,
    fecha, referencia al préstamo) — sin importar nada de infraestructura, seguimiento del patrón ya
    usado para `remaining_installments`/`installment_amount`.
  - `LocalInstallmentLoanRepository.recordInstallmentPayment`/`recordPrincipalPayment` pasan a
    escribir el `InstallmentPayment` (bookkeeping) Y el `Movement` nuevo dentro de la misma
    transacción Dexie, usando `IMovementRepository`/la tabla `movements` ya existente.
  - `remaining_installments`/`installment_amount` NO cambian de lógica — ya son correctos (ver
    hallazgo abajo).
- **Rationale — el bug de "cada registro resta cuotas" NO se reprodujo**: trace estático completo
  (use-case puro → método de repositorio → escritura Dexie → UI) más un test de integración
  descartable contra el repositorio real (mismo motor `fake-indexeddb` que usa la suite del
  proyecto) cubriendo pago simple, secuencia mixta cuota+abono, y doble-submit concurrente — los
  tres escenarios preservaron `remaining_installments` correctamente para `reduce_installment_amount`.
  El código actual (post spec 002, commit `8d6fb89`) ya es correcto en este punto.
- **Hardening incluido en el alcance (FR-014/FR-016) en vez de un fix de lógica**: deshabilitar el
  botón de confirmación de abono durante el submit (previene doble-clic accidental, aunque no se
  haya podido reproducir un efecto real) y separar visualmente los controles "Pagar cuota(s)" vs
  "Registrar abono a capital" (hoy adyacentes en la misma tarjeta, fuente plausible de confusión).
- **Hallazgo adicional (FR-015)**: `installment_loans`/`installment_payments` están en la lista de
  tablas que empujan cambios a Supabase (`SYNCED_TABLES` en `db.ts:38-43`) pero faltan en
  `tablesToSync` de `CustomSyncLayer.ts:28-33` — nunca se traen cambios remotos para estas tablas.
  Bug real de sync multi-dispositivo, descubierto durante esta investigación; se incluye en el
  alcance de 003 por ser del mismo dominio (préstamos) aunque no esté directamente pedido por el
  usuario.
- **Alternatives considered**: recalcular `remaining_installments` en la UI en vez de en el
  use-case (rechazado: violaría Principio III, Lógica ≠ UI); modelar el pago como parte de un nuevo
  tipo de entidad en vez de generar un `Movement` estándar (rechazado: innecesario, `Movement` ya
  modela egresos genéricos y es lo que consume Movimientos/Resumen).
