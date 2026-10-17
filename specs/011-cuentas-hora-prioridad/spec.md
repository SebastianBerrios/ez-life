# 011 — Cuentas de pago, hora del movimiento y prioridad de tareas

Estado: aprobada por el usuario junto con el plan de rediseño (2026-10-16).
Prerrequisito de la spec 010 (rediseño Obsidian): los formularios nuevos dependen de estos datos.
Sin dependencias runtime nuevas. Constitución 2.0.0 aplicable (dinero en enteros, offline-first, RLS).

## Historias

1. **Cuentas de pago.** El usuario administra cuentas (`debit`, `credit`, `cash`, `savings`) con saldo
   inicial en céntimos, y asocia cada movimiento a una cuenta. Cada usuario tiene una cuenta
   "Efectivo" por defecto (id estable por usuario). Saldo por cuenta = saldo inicial + ingresos −
   gastos ± transferencias. Una cuenta con movimientos no se elimina: se archiva.
2. **Transferencias.** `Movement.type = 'TRANSFER'` entre dos cuentas propias distintas
   (`account_id` origen, `to_account_id` destino). No tiene categoría, bucket, fuente de ingreso ni
   meta de ahorro. **Nunca** cuenta como ingreso ni gasto en: totales del ciclo, comparación mensual,
   presupuesto 50/30/20, progreso de metas de ahorro ni logros de "registro".
3. **Hora del movimiento.** El formulario captura fecha **y hora** (por defecto: ahora). Editar un
   movimiento conserva su hora. Las recurrencias siguen generándose a las 12:00. La lista y el
   export muestran la hora. Sin cambio de BD: `movements.date` ya es `timestamptz`.
4. **Prioridad de tareas.** `Task.priority` (`high|medium|low`, ausente = medium) y `Task.tag`
   opcional (contexto, p. ej. "Maestría / Estudio"). Las listas ordenan por prioridad y luego por fecha.
5. **Corrección de fecha de tareas.** `TaskForm` guardaba `new Date('YYYY-MM-DD')` (UTC) y el sync
   empuja `calendarKey` local: en UTC−5 una tarea del día 16 llegaba como día 15. Se guarda con
   `parseCalendarDate` y se lee con `calendarKey`; `TaskList.isDueToday` compara claves locales.

## Dominio

- `PaymentAccount { id, user_id, name, kind, opening_balance (cents), archived?, sort_order? }`.
- `Movement.account_id?`, `Movement.to_account_id?`; `MovementRecurrence` hereda ambos.
- Validación (en `LocalMovementRepository.save`): `account_id`/`to_account_id` pertenecen al usuario;
  TRANSFER exige ambos, distintos, y prohíbe categorías/ingreso/meta/ajuste.
- Casos de uso puros nuevos: `calculateAccountBalances`, `sortTasksByPriority`,
  `combineDateAndTime`. Ajustados: `exportMovements` (etiqueta "Transferencia", columnas
  `Fecha;Hora;Tipo;Cuenta;Categoría;Monto;Descripcion`), `evaluateMonthlyRecurrences` (copia cuentas),
  `evaluateAchievements` (excluye TRANSFER).

## Persistencia y sync

- Migración aditiva en `ez_life`: tabla `payment_accounts` con RLS por propietario;
  `movements` y `movement_recurrences` ganan `account_id`, `to_account_id` y el CHECK de `type`
  admite `TRANSFER` (con CHECK de coherencia); `tasks` gana `priority` y `tag`;
  `ez_life.sync_record` incorpora `payment_accounts` a su lista blanca.
- La migración debe estar aplicada en remoto **antes** de que un cliente empuje campos nuevos
  (`sync_record` rechaza campos desconocidos). Aplicación solo con `supabase db push`, tras correr
  `mvp-lab-infra/audit/fleet-auth-audit.sql` y con confirmación explícita del usuario.
- Dexie versión 18 (`payment_accounts: 'id, user_id'`), tabla sincronizada y ordenada antes de
  `movement_recurrences`/`movements` en `CustomSyncLayer`. Registrar la tabla en
  `repairOrphanedRows` y en las listas `onLocalChanges`/`progressTables` relevantes.
- Compartidos: los movimientos creados por `create_shared_movement` quedan sin cuenta.

## Verificación

Unitarios: saldos por cuenta, exclusión de TRANSFER en cada agregado, orden por prioridad, hora
conservada al editar, claves de fecha en UTC−5. Repositorio: aislamiento por usuario, validación de
TRANSFER, archivado vs borrado, cola de sync. Testing Library: selector de cuenta y de hora en el
formulario. Tests, lint, TypeScript y build en verde. Registrar resultados y límites en
`verification.md` sin afirmar lo no ejecutado.
