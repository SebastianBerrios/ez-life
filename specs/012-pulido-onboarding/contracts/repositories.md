# Contrato — Casos de uso y repositorios (spec 012)

Contrato interno entre capas (`core` → `infrastructure` → `presentation`). Solo se listan firmas que
**cambian o se agregan**; todo lo demás permanece igual.

## core/use-cases

### `parseCurrentBalance(raw: string): number` — NUEVO
Saldo actual del paso 1 → céntimos enteros.

| Entrada | Resultado |
|---------|-----------|
| `''`, `'  '` | `0` |
| `'800'`, `'800.5'`, `'800,50'`, `'1,200.00'` | `80000`, `80050`, `80050`, `120000` (vía `parseMoney`) |
| `'-5'`, `'-0.01'` | `DomainError('El saldo actual no puede ser negativo.')` |
| `'abc'`, `'1.234'` | `DomainError` de `parseMoney` (monto con hasta dos decimales) |
| `> Number.MAX_SAFE_INTEGER` en céntimos | `DomainError('El monto es demasiado grande.')` |

> `-0` o `'-0'` se rechaza igual (empieza con `-`): evita ambigüedad.

### `sortByCreation<T extends { id: string; created_at: Date | string | number }>(rows: T[]): T[]` — NUEVO
Devuelve una **copia** ordenada por `created_at` ascendente; desempate por `id` (`localeCompare`). No muta la entrada.
Tolera `created_at` como `Date`, ISO string o número (filas que vienen del sync).

### `buildDefaultCashAccount(userId, now, openingBalance = 0): PaymentAccount` — MODIFICADO
Parámetro opcional nuevo. Con el valor por defecto el resultado es idéntico al actual (compatibilidad).

### `validateDistribution(rows)` — MODIFICADO
- `percentage`: entero; **`>= 1`**, salvo filas con `is_savings` que admiten **`>= 0`**; `<= 100`.
- Mensaje de nombres/porcentajes en tuteo: `'Completa los nombres y porcentajes enteros (de 1 a 100; el ahorro puede ser 0).'`
- Suma exacta 100 y exactamente una `is_savings`: sin cambios (mensajes en tuteo).

## infrastructure/repositories/local

### `creationClock.nextCreatedAt(): Date` — NUEVO
Devuelve una `Date` estrictamente mayor que la anterior devuelta por la misma sesión
(`max(Date.now(), last + 1)`). Solo para ordenar altas; no sustituye `updated_at`.

### `LocalOnboardingRepository.saveStartingPoint(userId, input)` — NUEVO (reemplaza `saveIncome`)
```ts
saveStartingPoint(userId: UUID, input: { income: number; openingBalance: number }): Promise<void>
```
Una transacción `rw` sobre `profiles`, `income_sources`, `payment_accounts`, `sync_queue`:
1. `validateMovementAmount(income)` (como hoy). `openingBalance` con chequeo **explícito**:
   `openingBalance < 0 || !Number.isSafeInteger(openingBalance)` ⇒ `DomainError`. (`validatePaymentAccount`
   no sirve para esto: solo valida entero y permite negativos; úsese únicamente para nombre/tipo.)
2. Guarda/actualiza la fuente "Sueldo Base" y el perfil (`onboarding_step: 1`) — lógica actual de `saveIncome`.
3. Si **no existe** la fila `defaultCashAccountId(userId)`, inserta `buildDefaultCashAccount(userId, now, openingBalance)`.
   Si existe, **no la modifica** (idempotente; no pisa saldo ni resucita cuentas borradas).
4. Cualquier fallo revierte todo (no queda sueldo sin cuenta ni a la inversa).

`saveIncome` se elimina; se migran sus llamadas y tests (`OnboardingStep1`, `LocalOnboardingRepository.test`).

### `LocalCategoryRepository` — MODIFICADO
| Método | Cambio |
|--------|--------|
| `getExpenseCategories(userId)` | Resultado ordenado con `sortByCreation` |
| `getSubcategories(categoryId)` | Resultado ordenado con `sortByCreation` |
| `saveExpenseCategory(data, initialSubcategories?)` | Ya **no** exige ≥1 subcategoría inicial; `created_at` de filas nuevas = `nextCreatedAt()`; nombres vacíos en `initialSubcategories` siguen rechazándose; mensajes sin «bucket» (p. ej. "La categoría requiere nombre y una categoría de distribución propia.") |
| `saveSubcategory(data)` | `created_at` de filas nuevas = `nextCreatedAt()` |
| `deleteSubcategory(id)` | Sin cambio funcional (mantiene "al menos una"); mensaje en tuteo |
| `saveDistributionCategory(data)` | Misma regla de porcentaje que `validateDistribution` (0 solo ahorro) |
| `deleteDistributionCategory(id)` | Sin cambio de regla (ya rechaza la de ahorro y la única categoría); mensaje en tuteo y sin «bucket»: "No se puede eliminar la categoría de ahorro ni la única categoría de distribución." |

`seedDefaults` no cambia de interfaz; al pasar por `saveExpenseCategory`/`saveSubcategory` las semillas
quedan con `created_at` crecientes y conservan el orden definido en `defaultCategorySeeds`.

## presentation/hooks

### `useTransientMessages(ttlMs = 4000)` — NUEVO
```ts
const { messages, show, clear, clearAll } = useTransientMessages();
// messages: Record<string, string>
// show(key, text): muestra y (re)inicia el temporizador de esa clave
// clear(key): oculta una clave;  clearAll(): oculta todas y cancela los temporizadores
```
- Un temporizador por clave en `useRef<Map<string, ReturnType<typeof setTimeout>>>`.
- Limpia todos los temporizadores al desmontar.
- No contiene reglas de negocio (Principio III).

## Contratos de UI observables (resumen; el copy exacto está en `ui-copy.md`)

| Pantalla | Contrato |
|----------|----------|
| Paso 1 | Campo `income` (requerido) y campo `openingBalance` (opcional); envía `saveStartingPoint`; error de dominio visible y persistente |
| Paso 2 | Sin `input[type=radio]`; fila de ahorro con etiqueta "Ahorro · fija" y **sin** botón "Eliminar categoría" (no hay acción que avisar; la capa de datos la rechaza igualmente); error de guardado visible y persistente |
| Paso 3 | Alta de categoría sin subcategorías; hint "Agrega al menos una subcategoría" en categorías vacías; avisos de eliminación transitorios |
| Selector de movimientos | Solo categorías con ≥1 subcategoría (comportamiento existente, ahora con test) |
