# Quickstart: validar la feature end-to-end

Guía manual para probar que la feature funciona de punta a punta. No reemplaza los tests unitarios
de cada use-case (esos van en `tasks.md`/implementación) — esto es la validación de flujo completo.

## Prerrequisitos

- `pnpm install` ya corrido.
- `pnpm dev` corriendo.
- Un dispositivo/viewport mobile (o DevTools en modo responsive) para las User Stories 1 y 2.

## 1. Navegación mobile reducida (User Story 1)

1. Abrir la app en viewport mobile → contar los destinos visibles en la barra inferior: deben ser
   como máximo 5 (Resumen, Movimientos, Control, Préstamos + "Más").
2. Tocar "Más" → verificar que se abre como un drawer/bottom-sheet sobre la pantalla actual (no
   navega a una página nueva) y lista Análisis, Metas (ahorro), Espacio, Crear, Ajustes.
3. Desde "Más", entrar a cualquiera de esas secciones → verificar que se llega con normalidad y que
   nada dejó de funcionar respecto a antes.
4. Abrir la app en viewport desktop/tablet → verificar que la navegación ahí es la misma de siempre,
   sin el límite de 5 ni el drawer.

## 2. Crear vs. Control para metas, tareas y hábitos (User Story 2)

1. Ir a "Crear" → crear una `Task` con fecha de hoy, un `Goal` numérico, y un `Habit` en modo días
   fijos que incluya hoy.
2. Desde "Crear", abrir cualquiera de los tres recién creados y editarlo (cambiar el título/nombre)
   → verificar que guarda el cambio (esta capacidad no existía antes de esta feature).
3. Ir a "Control" → verificar que la tarea de hoy y el hábito de hoy aparecen arriba, pendientes de
   marcar, y el progreso del `Goal` aparece más abajo — y que no hay ningún botón para crear algo
   nuevo en esta pantalla.
4. Marcar la tarea como hecha y el hábito como cumplido desde "Control" → verificar que ambos
   desaparecen de la lista de pendientes de hoy.
5. Con un usuario sin ningún `Goal`/`Task`/`Habit`, entrar a "Control" → verificar que se ve un
   estado vacío que invita a ir a "Crear", no una pantalla en blanco.
6. Ir a la sección de meta de ahorro (`SavingsGoal`) → verificar que sigue exactamente donde estaba,
   sin relación con "Crear"/"Control".

## 3. Préstamo con cuotas (User Story 3)

1. Ir a "Préstamos" → registrar un `InstallmentLoan`: prestamista "BCP", monto S/2000, 12 cuotas,
   cuota S/187 (o el número real que dé el ejemplo), tasa informativa opcional → verificar que la
   app guarda exactamente esos cuatro valores, sin recalcular ni ajustar ninguno.
2. Registrar el pago de 2 cuotas → verificar que `remaining_installments` baja de 12 a 10.
3. Intentar registrar el pago de más cuotas de las que quedan (ej. 15 cuando quedan 10) → verificar
   que la acción se **bloquea** con un error, y que no queda parcialmente aplicada.
4. Registrar un abono a capital de S/300 → verificar que el sistema pregunta si reduce plazo o
   cuota; elegir "reducir plazo" e ingresar el nuevo número de cuotas restantes a mano (el que daría
   el banco) → verificar que se guarda tal cual, sin que la app proponga un cálculo propio.
5. Intentar un abono a capital mayor al saldo pendiente → verificar que se **rechaza**.
6. Revisar el historial de pagos del préstamo → verificar que aparecen, con fecha, tanto los pagos
   de cuota como el abono a capital, cada uno como su propio registro.
7. Seguir pagando cuotas hasta llegar a 0 restantes → verificar que el préstamo pasa a
   "Pagado/Saldado", sigue visible en la lista (no desaparece ni se borra), y que `Debt` (si hay
   alguno cargado) sigue funcionando exactamente igual que antes, en la misma sección "Préstamos".
8. Corregir un término original del préstamo (ej. la tasa informativa) sin registrar ningún pago →
   verificar que el cambio se guarda independientemente del historial de pagos.

## 4. Dropdown unificado (User Story 4)

1. Abrir el selector de dirección en el formulario de `Debt`, el selector de hora en Ajustes, y el
   selector de tipo (gasto/ingreso) en el formulario de movimiento compartido → verificar que los
   tres se ven y se comportan igual que el selector de categoría en el formulario de movimiento
   normal (mismo componente shadcn `Select`, ningún `<select>` nativo del navegador).

## 5. Regresión post-integración: `SavingsGoal` y `Debt` sin cambios (FR-010, FR-018)

Ejecutar **después** de integrar las 4 historias juntas (no de forma aislada) — US1/US2 reestructuran
`BottomNav.tsx`/`MainFlow.tsx` (donde vive la ruta `goals` → `SavingsGoal`) y US3 conecta
`InstallmentLoanList` en la misma rama `currentRoute === 'debts'` que `DebtList`, así que el riesgo
de regresión accidental sobre estas dos entidades "sin cambios" es real, no una formalidad:

1. Con la navegación ya reducida (US1) y las rutas `create`/`control` ya wireadas (US2), entrar a
   "Metas" (ahorro, dentro de "Más") → verificar que `SavingsGoalForm`/`SavingsGoalList` funcionan
   exactamente igual que antes de esta feature: crear una meta de ahorro, ver su progreso derivado de
   movimientos, sin ningún elemento de `Goal`/`Task`/`Habit` mezclado ahí (FR-010).
2. Con `InstallmentLoanForm`/`InstallmentLoanList` ya conectados (US3) en la sección "Préstamos",
   cargar (o usar uno ya existente) un `Debt` simple en ambas direcciones (`lent` y `borrowed`) →
   verificar que crear, registrar una devolución parcial, y marcar como saldado funcionan igual que
   antes, sin que la presencia de `InstallmentLoanList` en la misma pantalla interfiera (FR-018,
   FR-019).

## Comandos de referencia

- `pnpm test` — corre toda la suite (los nuevos use-cases de `InstallmentLoan` deben tener sus
  tests unitarios acá).
- `pnpm test -- -t "installment"` — para iterar rápido sobre la validación de pagos mientras se
  implementa.
- `pnpm lint` / `pnpm build` — verificación estándar antes de dar por terminada la feature.

Ver `data-model.md` para los campos exactos de cada entidad y `contracts/repositories.md` para las
interfaces de repositorio.
