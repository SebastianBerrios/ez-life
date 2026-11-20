# Research: Balance del mes, cuentas y deudas, tutorial y Resumen minimalista

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Cada decisión resuelve una incógnita del *Technical Context* o uno de los "puntos a vigilar" de
`checklists/requirements.md`. Ninguna queda como `NEEDS CLARIFICATION`.

---

## R1. Cómo se calcula el Balance del mes (forma cerrada + flujos)

**Decisión.** El Balance se calcula con una **forma cerrada** sobre el estado al cierre del mes, y los flujos
("Entró", "Salió", "Ahorraste", "Sacaste", "Ajuste") se calculan aparte clasificando cada movimiento. Un test
de invariante exige que ambos caminos coincidan:

```text
Balance(M)  = efectivo gastable al cierre de M  −  deuda corriente de tarjetas al cierre de M
Arranque(M) = Balance(M − 1)      (M posterior al primer mes rastreado M0; Arranque(M0): ver contracts/balance-rules.md)
invariante:   Balance(M) = Arranque(M) + Entró − Salió − Ahorraste + Sacaste + Ajuste
```

- *Efectivo gastable* = saldo de cuentas `debit` + `cash` no archivadas (opening + movimientos hasta el cierre
  de M, respetando `opening_date`, ver R2) + neto de movimientos sin cuenta (filas anteriores a la spec 011,
  igual que `calculateUnassignedBalance`).
- *Deuda corriente de tarjeta* = lo que se debe en la tarjeta **menos** lo que queda de la deuda previa (R3).
  Es lo único de las tarjetas que resta del Balance: compras del periodo todavía sin pagar.
- Las cuentas `savings` nunca entran en el Balance (FR-003).

**Por qué.** Reproduce todos los escenarios de la spec sin casos especiales por escenario:
compra con tarjeta de 100 → deuda corriente +100 → Balance −100 (US1 S3); pagar con débito → efectivo −100 y
deuda corriente −100 → Balance sin cambio (S4); pagar deuda previa de 400 → efectivo −400, deuda corriente 0 →
Balance −400 (S5). Retirar de ahorros para pagar la tarjeta da "retiro (+a) seguido del pago (no lo mueve)"
sin código extra. Calcular el Balance de dos formas independientes convierte el invariante en un detector de
errores de clasificación (SC-001).

**Alternativas.**
- Sumar solo los flujos desde un saldo de arranque guardado: obliga a persistir el cierre de cada mes y se
  desincroniza al editar o borrar movimientos viejos. Rechazada: el Balance es *derivado* (spec, Key Entities).
- Reutilizar `calculateAvailableCapital`: suma tarjetas, ahorros y archivadas; es justo lo que el usuario
  desaprobó (FR-011). Se conserva sin cambios para el indicador de Finanzas (Assumptions, spec 014).

## R2. Saldo declarado vs movimientos anteriores al registro → `PaymentAccount.opening_date`

**Decisión.** Campo opcional nuevo `opening_date` (fecha local del día de creación) en `payment_accounts`. Si
existe, `calculateAccountBalances` ignora los movimientos de esa cuenta con fecha anterior a ese día. Las
cuentas creadas por el onboarding nuevo lo llevan; las existentes quedan en `null` (se cuenta todo su
historial, que es lo que ya hacen hoy).

**Por qué.** La Assumption "Movimientos anteriores al registro" exige que un movimiento retroactivo no se
cuente dos veces (el saldo declarado ya lo refleja). Un único mecanismo por cuenta mantiene coherentes el
saldo mostrado en "Cuentas", el de Finanzas y el Balance. Para usuarios existentes no se reescribe ningún
dinero.

**Cuentas creadas después del primer mes** (Clarificación 2026-11-11). El `opening_balance` de una cuenta de
débito/efectivo cuenta en el *Arranque* solo si no tiene `opening_date` o su mes de apertura es ≤ el mes de
`balance_since` (cuentas del onboarding y cuentas existentes). Si su mes de apertura es posterior, entra en ese
mes como **ajuste** (`+opening_balance`), sin contar en Entró/Salió. Así el invariante de R1 se mantiene y el
Balance de meses pasados no cambia al agregar una cuenta. Las cuentas de ahorros no mueven el Balance por su
saldo inicial y, en tarjetas, el consumo inicial es deuda previa.

**Alternativas.** Fecha de baseline en el perfil (rechazada: obliga a que cada función de saldos la conozca y
no distingue cuentas creadas después). Reescribir `opening_balance` de las cuentas existentes (rechazada:
muta dinero del usuario).

## R3. Deuda previa de tarjeta y orden de aplicación de pagos

**Decisión.** Estado por tarjeta calculado en una sola pasada cronológica:

1. `deuda previa inicial` = lo adeudado justo antes de `balance_since` (R4), con `opening_date` respetada.
2. Cada pago (transferencia hacia la tarjeta) se aplica **primero** a la deuda previa restante (el "tramo"),
   el resto reduce la deuda corriente. Solo el tramo es salida de dinero para el Balance (se cuenta en "Salió",
   ver R5).
3. Cada compra con tarjeta sube la deuda corriente.

**Por qué.** Es la Assumption "Pagos a tarjeta" (más antigua primero) y evita doble conteo: una compra ya
restó del Balance el día que ocurrió, pagarla no vuelve a restar.

## R4. Desde cuándo rigen las reglas nuevas → `profiles.balance_since`

**Decisión.** Campo `balance_since` (`'YYYY-MM'`) en el perfil. Onboarding nuevo: el mes del registro. Usuario
existente: se fija **una vez** al abrir la app tras actualizar (mes en curso, idempotente, vía
`LocalProfileRepository.save` si falta). Compras con tarjeta anteriores a ese mes son deuda previa (R3): no
restan del Balance ni cuentan como "Salió" en meses anteriores a `balance_since` (siguen contando en el
50/30/20, que no cambia para gastos).

**Por qué.** Implementa la Assumption "Posición de la deuda de tarjeta previa" y "Saldo de arranque de
usuarios existentes" sin pedirle nada al usuario, y sin que el historial viejo cambie de significado de forma
retroactiva y silenciosa. Viaja con el perfil (sync) para que dos dispositivos coincidan.

**Riesgo aceptado.** Dos dispositivos offline podrían fijar meses distintos si actualizan en meses distintos;
gana el último (LWW). Impacto: solo qué compras antiguas se consideran deuda previa. Se documenta, no se mitiga.

## R5. Clasificación de movimientos (decisiones que la spec deja implícitas)

Tabla completa en [contracts/balance-rules.md](./contracts/balance-rules.md). Decisiones no triviales:

- **Gasto en la categoría de ahorro (`is_savings`) = "Ahorraste", no "Salió".** Es un aporte a una meta, no un
  gasto real (FR-001, FR-008; **confirmado** en la Clarificación 2026-11-11). Sube el ahorro neto igual que una transferencia a una cuenta de ahorros. Pagado *desde*
  una cuenta de ahorros no genera flujos (el dinero no salió del colchón de ahorro).
- **Retiro/aporte implícito** (Clarificación Q3): un gasto pagado desde ahorros suma a "Salió" *y* a "Sacaste"
  (retiro implícito); un ingreso depositado en ahorros suma a "Entró" *y* a "Ahorraste". Así el invariante
  de R1 se cumple y el ahorro neto (`Ahorraste − Sacaste`) refleja ambos casos.
- **El tramo de deuda previa pagado se cuenta en "Salió"** (no en el 50/30/20: no es una categoría de gasto).
  Sin esto la fórmula de FR-001 no cierra. **Confirmado** (Clarificación 2026-11-11, FR-005/FR-006); la
  alternativa descartada era una línea aparte "Pagaste deuda anterior S/ X".
- **Doble conteo ahorro (punto 2 del checklist).** El 50/30/20 mantiene `EXPENSE` por categoría para
  Necesidades/Deseos y reemplaza el "gastado" del bucket de ahorro por el **ahorro neto del mes**
  (`Ahorraste − Sacaste`). Un gasto de la categoría de ahorro y una transferencia a una cuenta de ahorros son
  dos registros distintos del usuario: no se deduplican (no hay vínculo entre ellos); se documenta como
  responsabilidad del usuario no registrar el mismo aporte dos veces.
- **Ajuste manual** (spec 006): afecta solo al efectivo gastable (sube/baja el Balance) y se muestra aparte;
  un ajuste sobre cuenta de ahorros no afecta el Balance.
- **Transferencia desde una tarjeta** (adelanto de efectivo): fuera del alcance de la spec; se trata como
  entrada de efectivo con deuda corriente equivalente (Balance neto 0). Caso límite, cubierto por un test.

## R6. "Nada se registra solo": retirar la generación, conservar el historial

**Decisión.** `useRecurrenceEvaluator` se elimina de `MainFlow`. `LocalMovementRecurrenceRepository.generate`
se reemplaza por `adoptLegacySources` (solo conserva el primer bucle: convierte movimientos antiguos con
`is_recurring` sin regla en reglas, sin crear ocurrencias). `evaluateMonthlyRecurrences` y su test se
eliminan. Las ocurrencias ya generadas permanecen intactas (FR-018): no se tocan filas existentes.

**Por qué.** FR-014 prohíbe crear ingresos/gastos sin acción explícita. Mantener la conversión de legado evita
perder reglas de datos antiguos. Las reglas siguen existiendo (`movement_recurrences`) y alimentan "Por
registrar".

**Impacto en tests (punto 4 del checklist).** Se eliminan `evaluateMonthlyRecurrences.test.ts` y
`useRecurrenceEvaluator.test.tsx`; `LocalMovementRecurrenceRepository.test.ts` se **crea** (no existía ningún
test de `generate`) y verifica que no se genera nada; la prueba de simulación a 3 meses (SC-004) vive en
`evaluateNotifications.test.ts` (0 movimientos creados, 1 notificación por ítem y mes).

## R7. "Por registrar" es derivado; solo las omisiones se persisten

**Decisión.** La lista se calcula con la función pura `buildPendingRegistrations` a partir de reglas,
fuentes de ingreso, préstamos, pagos de cuota, cuentas, movimientos del mes y omisiones. No se guarda un
registro por ítem. Lo único persistido es la omisión (`reminder_skips`, tabla nueva, R8).

**Cobertura por vínculo estructurado** (FR-019, sin mirar monto ni texto): sueldo = ingreso con
`income_source_id` de esa fuente en el mes; recurrencia = movimiento con `recurrence_rule_id` de esa regla y
`recurrence_month` = mes; cuota = movimiento con `installment_payment_id` cuyo pago pertenece a ese préstamo
en el mes; tarjeta = `TRANSFER` con `to_account_id` = esa tarjeta en el mes. El botón **Registrar** de una
recurrencia guarda el movimiento con `recurrence_rule_id` + `recurrence_month`, de modo que reutiliza el
vínculo y el índice único `[recurrence_rule_id+recurrence_month]` de Dexie impide duplicados.

**Ventana de aparición** (Assumptions + FR-015): sueldo y recurrencia el día que toca; cuota y tarjeta
3 días antes (`REGISTRATION_LEAD_DAYS`). Si el día no existe en el mes cae en el último día; si el adelanto
cruza al mes anterior se recorta al día 1 del mes. No hay día de pago → no hay ítem. Solo el mes en curso
real; el selector de mes no muestra "Por registrar" en otros meses.

**Decisión (confirmada, Clarificación 2026-11-11).** Las cuotas de préstamo usan el mismo adelanto de 3 días
que las tarjetas; FR-015, FR-017 y US3-S4 ya lo dicen. La notificación `register_due` sale cuando el ítem pasa
a la lista (el día que toca para sueldo y recurrencias; 3 días antes para cuotas y tarjetas).

## R8. Omisiones = tabla `reminder_skips`; estado de checklist/tour = campos de perfil

**Decisión.**
- `reminder_skips` (tabla nueva): una fila por (usuario, ítem, mes), id determinista
  `stableId('skip:<userId>:<itemKey>')` donde `itemKey = <kind>:<refId>:<YYYY-MM>`. Idempotente entre
  dispositivos, sincroniza por la capa existente.
- Perfil: `checklist_dismissed`, `checklist_not_applicable` (lista de claves), `tour_seen`, `onboarding_version`,
  `balance_since`. Viajan con el perfil (FR-033) y sincronizan sin tabla nueva.

**Por qué.** Una lista de omisiones dentro del perfil crecería sin límite y haría que cada omisión reescriba
el perfil entero (conflictos LWW con preferencias). Una fila por omisión es independiente y barata.
Checklist/tour son pocos campos escalares: caben en el perfil.

**Alternativas.** Guardar omisiones en `localStorage` (rechazada: no sincroniza, contradice FR-046).

## R9. Notificaciones de "Por registrar" por el sistema existente

**Decisión.** Un tipo nuevo `register_due` en `NotificationType`. `evaluateNotifications` recibe
`pendingRegistrations` y emite una notificación por ítem visible no omitido ni cubierto, con
`related_id = itemKey` y `cycle_key = 'YYYY-MM'` (el mismo patrón `hasEquivalent` que ya evita duplicados →
una sola vez por ítem y mes, SC-004). Respeta `inapp_enabled` / `push_enabled` / permiso del navegador tal
como lo hace hoy `useNotificationEvaluator`. Requiere ampliar el `CHECK` de `notifications.type` (migración).

**Por qué.** Principio XI: un solo sistema de recordatorios. La lectura de datos común a la lista y a las
notificaciones vive en un único repositorio (`LocalRegistrationRepository.getInputs`) para no duplicar
consultas.

## R10. Onboarding de 6 pasos y compatibilidad con la numeración anterior

**Decisión.** `profiles.onboarding_step` pasa a `0..6` con `onboarding_version = 2`. Perfiles sin versión (antes
de esta spec) se interpretan con una tabla fija en la función pura `resolveOnboardingProgress`:

| Antes (v1) | Significado | Ahora |
|---|---|---|
| 0 | nada | 0 |
| 1 | ingresos listos | 1 (retoma en "¿Dónde tienes tu dinero?", Efectivo ya existe) |
| 2 | + distribución | 5 (retoma en categorías; tarjetas/préstamos quedan pendientes en el checklist) |
| 3 | completo | 6 (completo: no se repite; ve tour una vez + checklist, FR-032) |

Cada paso guarda sus datos **y** avanza `onboarding_step` en una sola transacción Dexie, y cada fila de borrador
lleva un id generado en el cliente al crearla: reenviar un paso es idempotente (FR-026, sin duplicados). Ajustes
abre los pasos de distribución/categorías con los números 5 y 6.

## R11. Checklist y tour

- **Checklist** (`buildSetupChecklist`, pura): 4 ítems. *Ingresos* completo con ≥1 fuente de ingreso con
  monto > 0. *Cuentas* completo con ≥1 cuenta `debit`/`savings` **o** `accounts` en `checklist_not_applicable`
  (se registra al pulsar "Solo uso efectivo" en el paso 2). *Tarjetas* / *Préstamos*: completos
  con datos **o** declarados "No tengo" (`cards`/`loans`); "Omitir" no los completa (US2-S7, US5-S3).
- **Tour**: componente a mano `GuidedTour` (~100 líneas, sin librería: Principios I y VII) con 4 pasos que
  apuntan a elementos con `data-tour="balance|accounts|add|setup|settings"` mediante `getBoundingClientRect`. El
  paso 4 apunta a la tarjeta de checklist si existe y, si no, a la entrada "Ajustes". Se muestra mientras
  `tour_seen` sea falso (cubre usuarios nuevos y existentes, FR-030/FR-032) y se marca visto al terminar u
  omitir. Respeta "reducir movimiento".

## R12. Lenguaje visual: tokens, fuentes locales, tema y guardias

- **Fuentes locales.** Fredoka y Figtree (OFL) se agregan como archivos variables `.woff2` en `src/app/fonts/`
  y se cargan con `next/font/local` (mismo patrón que Geist hoy), sin dependencia npm nueva. Se retira
  `JetBrains_Mono` de `next/font/google`. Se evita `next/font/google` para cumplir "cargadas de forma local" y
  que el build no dependa de la red.
- **Tokens** (`globals.css` + `tailwind.config.ts`): crema/ciruela/verde pastel, radio base 28 px para tarjetas,
  píldoras, sombras cálidas, sin líneas duras. Propuesta inicial en [data-model.md](./data-model.md#tokens-visuales);
  el contraste AA lo comprueba un test unitario que lee los pares de `globals.css` (SC-007).
- **Tema.** `ThemeProvider` pasa a `defaultTheme="system"` + `enableSystem`; se elimina `SystemThemeReset` (hoy
  reescribe "system" como "dark"). `next-themes` solo persiste cuando se llama a `setTheme`, así quien nunca
  eligió sigue al sistema y quien eligió conserva su valor. `ThemeToggle` pasa a selector de tres opciones en
  Ajustes. *Verificar en el quickstart* que una sesión limpia no tenga clave `theme` en `localStorage`.
- **Guardia tipográfica.** Test `typographyGuard.test.ts` (patrón de `voseoGuard.test.ts`) que falla si `src/`
  contiene `font-mono`, `label-mono`, `JetBrains` o etiquetas con `uppercase` como estilo; protege SC-006 y se
  activa al terminar el barrido (ver orden de implementación).
- **Corrección de copy**: "Recibí alertas…" → "Recibe alertas…" (FR-045).

## R13. Cuenta de origen de cuotas y abonos (FR-020)

**Decisión.** `recordInstallmentPayment` y `recordPrincipalPayment` (repositorio) reciben `accountId`; el
`Movement` de egreso que ya crean (Principio X) guarda `account_id`. La cuenta por defecto es la "cuenta
principal" = primera cuenta `debit` activa, si no hay, "Efectivo" (función pura `pickPrimaryAccount`). Sin
esta cuenta el pago no bajaría el saldo de ninguna cuenta y la forma cerrada de R1 no coincidiría con el dinero
real.

## R14. Despliegue y reglas de la flota

- La migración nueva (`supabase/migrations/20261110120000_...sql`) se **escribe** en el repo; **no se aplica**:
  solo con `supabase db push`, tras `mvp-lab-infra/audit/fleet-auth-audit.sql` y con confirmación explícita
  del dueño (CLAUDE.md de la flota, reglas 2–4; FR-047). Nunca por MCP ni `execute_sql`.
- Debe quedar viva **antes** de publicar el cliente: `sync_record` rechaza campos desconocidos.
- Lección de `20261017120000_restrict_new_table_grants.sql`: el esquema `ez_life` concede `ALL` por defecto a
  `authenticated`; la tabla nueva debe hacer `revoke all ... from public, anon, authenticated` y luego
  `grant select, insert, update` (sin `delete`/`truncate`).
- Principio IX: ninguna política de auto-inserción ni trigger sobre `auth.users`; `reminder_skips` usa la misma
  política "own rows only" (con fila de `profiles` existente) que `payment_accounts`.
