# Contrato: reglas del Balance del mes

Fuente de verdad de `calculateMonthBalance` y del ahorro neto. Es el contrato que los tests de tabla
(`calculateMonthBalance.test.ts`) deben cubrir fila por fila. Decisiones de fondo en
[research.md](../research.md) R1–R5.

## Entradas

```ts
calculateMonthBalance(input: {
  month: Date;                       // cualquier día del mes; el mes lo fija calculateMonthlyCycle
  accounts: PaymentAccount[];        // incluye archivadas (se filtran adentro) y eliminadas (se ignoran)
  movements: Movement[];             // HISTORIAL COMPLETO del usuario (no solo el mes); deleted_at se ignora
  distributionCategories: DistributionCategory[]; // para saber cuál bucket es is_savings
  balanceSince?: string;             // profiles.balance_since 'YYYY-MM'; undefined = sin tarjetas rastreadas
}): MonthBalance
```

Puro, sin efectos, determinista. Todo en céntimos enteros.

## Notación

`S` = cuenta gastable (`debit`, `cash`, o movimiento sin cuenta). `V` = `savings`. `C` = `credit`.
`a` = monto. "Ahorro" = bucket con `is_savings`. `t = min(a, deudaPrevia restante de la tarjeta)`.
Una cuenta archivada **no** cuenta como `S`/`V` en el Balance (edge case de la spec); sus movimientos se
conservan.
Los movimientos de una cuenta con `opening_date` anteriores a esa fecha se ignoran (R2).

## Tabla de clasificación (movimientos del mes, no ajustes)

| # | Movimiento | Entró | Salió | Ahorraste | Sacaste | Notas |
|---|---|---|---|---|---|---|
| 1 | INGRESO a `S` | +a | | | | |
| 2 | INGRESO a `V` | +a | | +a | | aporte implícito (Q3) |
| 3 | INGRESO a `C` | +a | | | | reduce deuda corriente (devolución); caso límite |
| 4 | GASTO desde `S`, bucket normal | | +a | | | |
| 5 | GASTO desde `S`, bucket Ahorro | | | +a | | aporte a meta (R5) |
| 6 | GASTO desde `V`, bucket normal | | +a | | +a | retiro implícito (Q3) |
| 7 | GASTO desde `V`, bucket Ahorro | | | | | sin flujos |
| 8 | GASTO desde `C`, bucket normal | | +a | | | solo si el mes ≥ `balance_since`; si no, deuda previa: sin flujos |
| 9 | GASTO desde `C`, bucket Ahorro | | | +a | | solo si el mes ≥ `balance_since` |
| 10 | CUOTA / ABONO de préstamo (GASTO con `installment_payment_id`) | | +a | | | igual que 4 o 6 según su cuenta (R13) |
| 11 | TRANSFERENCIA `S→S` o `V→V` | | | | | |
| 12 | TRANSFERENCIA `S→V` | | | +a | | |
| 13 | TRANSFERENCIA `V→S` | | | | +a | |
| 14 | TRANSFERENCIA `S→C` (pago de tarjeta) | | +t | | | solo el tramo de deuda previa baja el Balance (FR-005/006) |
| 15 | TRANSFERENCIA `V→C` | | +t | | +a | retiro de ahorros + pago |
| 16 | TRANSFERENCIA `C→S` (adelanto) | | | | | efectivo +a, deuda +a: Balance neto 0 |
| 17 | TRANSFERENCIA `C→V` | | | +a | | aporte financiado con tarjeta |
| 18 | TRANSFERENCIA `C→C` | | | | | |

Antes de `balance_since` toda la deuda de tarjeta es previa: las filas 14 y 15 usan `t = a`.

## Ajustes manuales (`is_adjustment`)

| Cuenta | Efecto |
|---|---|
| `S` | `ajuste` ± a (INGRESO suma, GASTO resta). No cuenta en Entró/Salió ni en el 50/30/20. |
| `V`, `C` | Sin efecto en el Balance. |

## Forma cerrada (independiente de las filas)

```text
efectivoGastable(M) = Σ saldo(S no archivadas, hasta el cierre de M) + neto de movimientos sin cuenta
deudaCorriente(M)   = Σ por tarjeta ( compras − pagos que exceden la deuda previa )   // puede quedar < 0 por sobrepago; no se recorta
Balance(M)          = efectivoGastable(M) − deudaCorriente(M)
Arranque(M)         = Balance(cierre de M − 1)        // M posterior al primer mes rastreado M0 (mes de balance_since)
Arranque(M0)        = Σ saldo al inicio de M0 de las cuentas S no archivadas con apertura ≤ M0 + neto sin cuenta anterior a M0   // deuda corriente inicial = 0
```

`deudaPrevia inicial` de una tarjeta = `max(0, −(opening_balance + movimientos de esa tarjeta anteriores al
inicio de balance_since))`, respetando `opening_date`. Un pago consume primero la deuda previa restante.

**Saldo inicial de cuentas `S` y cuentas creadas tarde.** El `opening_balance` de una cuenta `S` cuenta en el
Arranque si la cuenta no tiene `opening_date` o su mes de apertura es ≤ el mes de `balance_since`. Si su mes
de apertura es posterior, no está en el Arranque: entra en ese mes como `ajuste` (`+opening_balance`), sin
contar en Entró/Salió ni en el 50/30/20, y los meses anteriores no cambian. Las cuentas `V` y `C` no mueven el
Balance por su saldo inicial (en `C` es deuda previa).

**Meses anteriores a `balance_since`.** Para un mes M anterior al mes de `balance_since`, una cuenta `S` aporta al Balance solo si no tiene `opening_date` o su mes de apertura es ≤ M; las compras con tarjeta son deuda previa (sin flujos, fila 8). M0 es el mes de `balance_since`. `Arranque(M0)` usa la fórmula especial de arriba: incluye las cuentas del onboarding (apertura en M0) y por diseño puede diferir de `Balance(M0 − 1)` (para usuarios existentes, sin `opening_date`, coincide); el invariante se verifica dentro de cada mes.

**Invariante (test obligatorio, también por propiedad sobre secuencias generadas):**

```text
balance == opening + entro − salio − ahorraste + sacaste + ajuste
savingsNet == ahorraste − sacaste
```

## 50/30/20 compacto (`buildCompactRule`)

- Base: ingreso declarado (suma de `income_sources`) × porcentaje del bucket (FR-010). El ingreso declarado
  **no** suma a "Entró".
- Necesidades/Deseos: `spent` = gastos (`EXPENSE`, sin ajustes ni transferencias) del bucket en el mes,
  desde cualquier cuenta, **incluida** la tarjeta el día de la compra (FR-004) y los gastos desde ahorros.
  Una cuota de préstamo cuenta en el bucket de su préstamo (Principio X).
- Ahorro: `spent` = `savingsNet` (puede ser negativo). Frase informativa cuando es negativo: "Este mes sacaste
  más de lo que ahorraste" (nunca color de error). Barra con piso en 0.
- Frases: "Te quedan S/ 885 para necesidades"; si `spent > budget`: "Te pasaste S/ 120 en deseos" (tono neutro).
- `buildRuleView` (Finanzas) **no cambia** en esta spec; su ajuste es de la spec 014.

## Casos de referencia mínimos (SC-001: ≥ 12, todos con el invariante)

1. Arranque 1000, ingreso 500, gasto 300 en efectivo → balance 1200, entró 500, salió 300 (US1-S1).
2. Cuenta de ahorros con 2000 → no entra al balance (S2).
3. Compra con tarjeta 100 → balance −100 ese día y cuenta en el 50/30/20 (S3).
4. Pagar esa tarjeta con débito 100 → balance sin cambio, ni salió ni 50/30/20 (S4).
5. Deuda previa 400; pagar 400 desde débito → balance −400, salió +400 (S5).
6. Pago parcial mixto: previa 400 + compra 100; pago 300 → tramo 300, balance −300; pago de 200 más → tramo 100 +
   100 a compras: balance −100 más.
7. Cuota de préstamo 250 → salió +250, balance −250 (S6).
8. Transferencia 200 débito→ahorros → ahorraste 200, balance −200, savingsNet +200 (S7).
9. Retiro 300 ahorros→débito → sacaste 300, balance +300, savingsNet −300 (S8); neto negativo si se sacó más (S9).
10. Mes nuevo: arranque = cierre del anterior (S10); primer mes de usuario nuevo = saldo declarado.
11. Ingreso declarado 3000 sin registrar → entró 0 (S11).
12. Mes sin movimientos → balance = arranque, entró 0, salió 0.
13. Cuenta archivada → no entra al balance.
14. Balance negativo → se calcula con signo (la frase la pone la UI).
15. Gasto desde ahorros 50 → salió 50, sacaste 50, balance sin cambio, savingsNet −50 (Q3).
16. Ingreso depositado en ahorros 80 → entró 80, ahorraste 80, balance sin cambio (Q3).
17. Pago de tarjeta desde ahorros (previa 0, compra previa de 100, pago 100) → el pago: sacaste +100, salió 0, balance +100 (la compra ya había restado 100: neto 0).
18. Ajuste manual +40 en débito → ajuste +40, balance +40, entró/salió sin cambio (Q5).
19. Movimiento con fecha anterior a `opening_date` → ignorado.
20. Mes anterior a `balance_since` → compras con tarjeta sin flujos; pagos de tarjeta como salió.
21. Cuenta de débito creada en el mes M+2 con saldo 500 → `ajuste +500`, balance +500 en M+2; el balance de M+1
    no cambia; entró/salió sin cambio.
22. Cuenta de ahorros creada tarde con saldo 2000 → sin efecto en el Balance ni en los flujos.
23. Usuario nuevo (registro en el mes M0) consulta el mes M0−1 → balance 0, entró 0, salió 0 (sus cuentas no existían).
24. Usuario existente (sin `opening_date`) consulta dos meses antes de `balance_since` → compras con tarjeta sin flujos (deuda previa), balance = efectivo gastable al cierre de ese mes, invariante cumplido.
