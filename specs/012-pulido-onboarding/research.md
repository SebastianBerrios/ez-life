# Research — Spec 012: Pulido del onboarding

No quedaron `NEEDS CLARIFICATION` tras el spec. Esta investigación del código fija las decisiones
técnicas y registra hallazgos que corrigen supuestos previos.

## Hallazgos del código (hechos verificados)

- El wizard **no muestra el paso 1 más de una vez**: `progress()` avanza el perfil a `onboarding_step=1`
  y `MainFlow` retoma en el paso 2. Aun así `saveIncome` ya está escrito de forma idempotente.
- La cuenta "Efectivo" la crea `MainFlow` (`ensureDefault`) recién cuando `step === 'app'`
  (`MainFlow.tsx:99-102`), siempre con saldo 0. `ensureDefault` **retorna si ya existe la fila** con el id
  estable (`defaultCashAccountId`), incluso archivada o borrada.
- `validateDistribution` y `saveDistributionCategory` exigen `percentage >= 1`: **hoy el 0% no es válido**,
  aunque el input ya tiene `min="0"`. El spec (FR-011) lo pide para la categoría de ahorro.
- `saveExpenseCategory` rechaza crear una categoría sin subcategorías iniciales
  (`LocalCategoryRepository.ts:81`) y el paso 3 pasa `['General']` (`OnboardingStep3.tsx:89`).
- `getExpenseCategories` / `getSubcategories` no ordenan; Dexie devuelve por clave primaria. Las semillas
  usan `stableId` (hash) y las filas del usuario `uuidv7`, por eso el orden "nuevo" es arbitrario.
- Las semillas se crean en un bucle dentro de una transacción con `new Date()` por fila → pueden compartir
  milisegundo, así que ordenar solo por `created_at` + desempate por id **las desordenaría**.
- `MovementForm.tsx:140-142` **ya excluye** categorías sin subcategorías del selector → FR-018 ya se cumple;
  solo falta una prueba de regresión.
- Los divisores por presupuesto ya protegen el 0 (`buildRuleView.ts:70`, `evaluateNotifications.ts:88`,
  `buildFinancesKpis.ts:49`, `DesktopKpis.tsx:70`) → el 0% de ahorro no rompe cálculos.
- No hay librería de toasts. Patrones de timer existentes: `TasksPanel.tsx:137-139` (2.5 s, un solo aviso).
- "Superaste" (`evaluateNotifications.ts:100`) es pretérito de tuteo válido: la guardia de voseo no debe
  marcarlo.

## Decisiones

### D1 — Dónde se guarda el saldo y cómo se evita pisarlo
- **Decisión**: nuevo `LocalOnboardingRepository.saveStartingPoint(userId, { income, openingBalance })` que,
  en **una sola transacción** Dexie (`profiles`, `income_sources`, `payment_accounts`, `sync_queue`), guarda
  el sueldo (lógica actual de `saveIncome`) y crea la cuenta "Efectivo" con `opening_balance` **solo si la
  fila con id estable no existe**. Si existe, no la modifica.
- **Rationale**: atómico (no queda sueldo sin cuenta), idempotente ante reintentos y compatible con
  `ensureDefault`, que seguirá siendo no-op para este usuario. Reutiliza `defaultCashAccountId` y
  `buildDefaultCashAccount` (ahora con parámetro `openingBalance = 0`).
- **Alternativas**: (a) dos llamadas separadas (`saveIncome` + `ensureDefault` con saldo) — no atómico;
  (b) movimiento de ajuste "Saldo inicial" — exige motivo y ensucia el historial; (c) actualizar el saldo si
  la cuenta ya existe — arriesga pisar un saldo que ya cambió.
- **Nota**: `saveIncome` se **reemplaza** (no se mantiene como alias) para no dejar un método engañoso;
  se migran sus llamadas y tests.

### D2 — Validación del saldo
- **Decisión**: `core/use-cases/parseCurrentBalance(raw): number` → vacío ⇒ 0; empieza con `-` ⇒
  `DomainError('El saldo actual no puede ser negativo.')`; resto por `parseMoney` (centavos enteros).
  El repositorio vuelve a validar con un chequeo explícito (`openingBalance < 0 || !Number.isSafeInteger(...)`
  ⇒ `DomainError`) como defensa en profundidad. **No** se apoya en `validatePaymentAccount`: ese caso de
  uso solo valida entero seguro y permite negativos (válidos para tarjetas de crédito), por lo que no
  garantiza `>= 0`.
- **Rationale**: `parseOpeningBalance` permite negativos solo para crédito y su mensaje habla de "cuenta de
  crédito", poco claro para onboarding; un caso de uso propio mantiene el mensaje correcto y la regla fuera
  del componente (Principio III).

### D3 — 0% solo para la categoría de ahorro
- **Decisión**: en `validateDistribution` y `saveDistributionCategory`, `percentage` entero en `[0,100]`;
  `0` solo si `is_savings`; el resto exige `>= 1`. La suma sigue siendo exactamente 100 y debe haber
  exactamente una categoría de ahorro.
- **Rationale**: cumple FR-011 sin permitir categorías "fantasma" de 0% en el resto. Cambio mínimo y local.
- **Alternativa rechazada**: permitir 0% en todas — habilita filas sin función y confunde el total.

### D4 — Orden por creación
- **Decisión**: función pura `sortByCreation(rows)` (orden por `created_at` ascendente, desempate por `id`)
  usada por `getExpenseCategories` y `getSubcategories`. Para garantizar orden en filas nuevas creadas en el
  mismo milisegundo, `creationClock.nextCreatedAt()` devuelve una `Date` estrictamente creciente
  (≥ último valor + 1 ms) y se usa al crear categorías y subcategorías.
- **Rationale**: el orden vive en el repositorio ⇒ aplica en toda la app (paso 3, formulario de movimientos,
  paleta, exportes) sin tocar cada pantalla. Sin migración: `created_at` ya existe. Los empates históricos
  conservan el comportamiento actual (por id), aceptado en el spec.
- **Alternativas**: campo `sort_order` + migración (rechazado: fuera de alcance, requeriría reordenar a
  mano); ordenar en cada componente (rechazado: duplica lógica).

### D5 — Retirar "General" sin perder la regla de "≥1 subcategoría"
- **Decisión**: `saveExpenseCategory` deja de exigir subcategorías iniciales; `initialSubcategories`
  sigue siendo opcional (lo usan las semillas). `deleteSubcategory` mantiene la protección de la última.
  El paso 3 crea la categoría vacía y muestra un hint persistente "Agrega al menos una subcategoría"
  (estado, no aviso transitorio); `canFinish` ya exige ≥1 subcategoría por categoría.
- **Rationale**: es la opción 1 de la sesión de grilling: la menor modificación al flujo actual.
- **Impacto en tests**: `LocalCategoryRepository.test.ts:11` (esperaba rechazo sin subcategorías) y
  `OnboardingStep3.test.tsx:84-102` (esperaba `['General']`) se invierten.

### D6 — Categoría de ahorro fija en la UI
- **Decisión**: se elimina el radio y `handleSetSavingsBucket`; la fila `is_savings` muestra la etiqueta
  "Ahorro · fija" y no tiene botón de eliminar; las filas nuevas siempre `is_savings: false`. El error de
  guardado deja de ser `console.error` y se muestra en un mensaje de formulario **persistente**.
- **Rationale**: los datos y las guardas del repositorio ya imponen "exactamente una de ahorro" y
  "no eliminar la de ahorro" (`LocalCategoryRepository.ts:30,40`, `validateDistribution`); solo se quita el
  control de UI. Al no existir botón de eliminar en la fila de ahorro, **no hay acción que bloquear con un
  aviso**: FR-013 se cumple por ausencia de la acción en la UI + rechazo en la capa de datos (probado en
  el repositorio). Los fallos de guardado sí se muestran (FR-014).

### D7 — Avisos transitorios
- **Decisión**: `presentation/hooks/useTransientMessages(ttlMs = 4000)` → `{ messages, show(key, text),
  clear(key), clearAll() }`, con un temporizador por clave guardado en `useRef`, limpieza al desmontar y
  `clearAll()` al iniciar otra acción. Se usa en el paso 2 (errores de eliminar) y paso 3 (eliminar
  categoría/subcategoría). **No** aplica a `errors.seed`, al aviso de total ≠ 100% ni a errores de guardado
  (persisten hasta corregirse).
- **Rationale**: Principio VII (≈30 líneas, sin dependencia) y consistente con `TasksPanel`. En el spec se
  habló de `useTransientMessage`; se implementa la versión por clave (`…Messages`) porque ambos pasos
  muestran varios avisos a la vez; un uso de un solo aviso pasa una clave fija.
- **Fuera de alcance deliberado**: `TasksPanel` conserva su aviso de éxito de 2.5 s (no es un error
  bloqueante y cambiarlo altera otro comportamiento); el resto de `role="alert"` del app son errores de
  validación de formulario, que persisten por FR-021.

### D8 — Estrategia para el tuteo
- **Decisión**: reemplazo manual por lotes con la tabla de `contracts/ui-copy.md` (incluye casos con
  clítico y tilde) + `src/voseoGuard.test.ts`, una prueba que escanea `src/**/*.{ts,tsx}` y falla si
  encuentra formas de voseo de una lista explícita. La prueba se habilita al final del reemplazo.
- **Rationale**: un `sed` ciego rompe acentos y casos como "archivala" → "archívala"; una prueba
  automática convierte la regla constitucional en algo verificable (SC-003) y evita regresiones futuras.
- **Alternativa**: regla ESLint personalizada — rechazada por complejidad (Principio VII); la prueba
  Vitest cumple lo mismo con menos código.

### D9 — Copy del paso 1 y stepper
- **Decisión**: eyebrow "Paso 1 de 3"; título "Tu punto de partida"; etiquetas "Sueldo o ingreso mensual"
  y "Saldo actual (opcional)" con ayuda asociada por `aria-describedby`; `STEPS[0].label = 'Inicio'`
  (se muestra en mayúsculas por CSS). El campo de saldo es `type="number" min="0" step="0.01"`, no
  `required`.
