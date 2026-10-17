# 011 — Verificación

Fecha: 2026-10-16. Registro de lo ejecutado y de lo que NO se verificó.

## Línea base (antes de tocar código)

- `pnpm test`: 86 archivos, 412 tests, todos en verde.
- `pnpm lint`: sin avisos ni errores.
- `npx tsc --noEmit`: sin errores.

## Resultado final (ejecutado)

- `pnpm test`: 93 archivos, 484 tests, todos en verde (+72 tests, +7 archivos).
- `pnpm test` repetido con `TZ=America/Lima` (UTC−5, offset 300 confirmado) y `TZ=Asia/Tokyo`: 484/484 en verde en ambas zonas.
- `pnpm lint`: sin avisos ni errores.
- `npx tsc --noEmit`: sin errores.
- `pnpm build`: compilación de producción correcta.

## Cobertura por historia

- Cuentas: `calculateAccountBalances`, `defaultPaymentAccount`, `validatePaymentAccount`, `LocalPaymentAccountRepository` (aislamiento por usuario, cola de sync, archivar vs borrar, `ensureDefault` idempotente).
- Transferencias: `validateTransfer` + validaciones de pertenencia en `LocalMovementRepository.save`; exclusión de TRANSFER con tests de regresión en `compareMonthlyPeriods`, `calculateCategoryBreakdown` (`calculateSpentByBucket` y desglose), `calculateSavingsGoalProgress` y `evaluateAchievements`.
- Hora: `combineDateAndTime` / `timeKey` (ida y vuelta, tardes en UTC−5), `MovementForm` (hora conservada al editar, cuenta por defecto "Efectivo"), `MovementList` (hora visible), `exportMovements` (columnas `Fecha;Hora;Tipo;Cuenta;Categoria;Monto;Descripcion`), recurrencias a las 12:00 con cuenta copiada.
- Prioridad: `sortTasksByPriority`, `TaskForm` (prioridad, etiqueta), `TaskList` (orden y día local).
- Fecha de tareas: `TaskForm` guarda con `parseCalendarDate` y lee con `calendarKey`; `TaskList.isDueToday` compara claves locales; test de sync que verifica que `due_date` viaja como `YYYY-MM-DD` local.
- Sync: orden de pull (`payment_accounts` antes de `movement_recurrences`/`movements`), push de cuentas y movimientos con cuenta, pull de cuentas, `repairOrphanedRows`.

## NO verificado

- La migración `supabase/migrations/20261016120000_payment_accounts_time_priority.sql` está escrita pero NO se aplicó en remoto (no se ejecutó `supabase db push`, ni MCP, ni SQL crudo) y tampoco se probó contra un Postgres local: su sintaxis y el comportamiento de los CHECK/FK compuestos no están validados. Falta correr `mvp-lab-infra/audit/fleet-auth-audit.sql` y obtener confirmación explícita del usuario antes del `db push`.
- Hasta que la migración esté aplicada en remoto, un cliente con este código fallaría al empujar los campos nuevos (`sync_record` rechaza campos desconocidos): no desplegar el cliente antes.
- No hubo verificación en navegador (ni Chrome ni dispositivo real): selector de cuenta, campo de hora y formulario de tareas solo se probaron con Testing Library.
- No se probó el sync contra Supabase real; los tests usan un cliente simulado.
- La UI de cuentas (gestión, saldos) y de transferencias (`TransferForm`) no existe todavía: corresponde a la spec 010.
- Las tareas guardadas antes de esta corrección con `new Date('YYYY-MM-DD')` (UTC) pueden seguir mostrando un día de diferencia en zonas UTC−N; no se migraron datos existentes.
