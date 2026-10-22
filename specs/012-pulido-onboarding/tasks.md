---

description: "Lista de tareas — Spec 012: Pulido del onboarding"
---

# Tasks: Pulido del onboarding

**Input**: Documentos de diseño en `/specs/012-pulido-onboarding/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/ (`repositories.md`, `ui-copy.md`), quickstart.md

**Tests**: **Incluidos** — la constitución (Principio IV) exige un test por caso de uso y Testing Library para
cambios de wiring de UI. Escribir cada test **antes** de su implementación y comprobar que falla.

**Organización**: agrupadas por historia de usuario para implementarse y probarse de forma independiente.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1…US5 según `spec.md`
- Todas las rutas son relativas a la raíz del repo (`D:\Programming\Frontend\ez-life`)
- Comandos: `pnpm test -- <ruta>` para un archivo; `pnpm test`, `pnpm lint`, `pnpm build` para el conjunto

## Orden de las fases (nota)

Las historias P2 se ordenan **US3 → US4 → US2** a propósito: US3 y US4 reescriben `OnboardingStep2/3.tsx`, y
US2 (tuteo masivo) termina activando la guardia `voseoGuard.test.ts`; hacerla al final evita reescribir
copy dos veces y que la guardia falle a medias. Todo texto **nuevo** se escribe ya en tuteo (ver
`contracts/ui-copy.md`). **Sin migraciones**: no ejecutar `supabase db push`.

---

## Phase 1: Setup

**Propósito**: línea base verificable antes de tocar código.

- [X] T001 Ejecutar `pnpm test` y `pnpm lint` sobre `main` limpio y anotar en `specs/012-pulido-onboarding/verification.md` (crear) cuántas pruebas pasan y cualquier fallo previo, para distinguirlo luego de regresiones propias.

---

## Phase 2: Foundational

**Propósito**: prerrequisitos bloqueantes compartidos por todas las historias.

Ninguno. Cada historia trae sus propias piezas puras (`parseCurrentBalance`, `sortByCreation`, `useTransientMessages`, …) y los archivos compartidos (`OnboardingStep2/3.tsx`) se tocan en fases separadas y secuenciales. Se puede pasar directo a la Fase 3.

---

## Phase 3: User Story 1 — Registrar mi saldo actual al empezar (Prioridad: P1) 🎯 MVP

**Goal**: el paso 1 captura sueldo + saldo actual opcional; el saldo se guarda como saldo inicial de la cuenta "Efectivo", creada en el wizard.

**Independent Test**: usuario nuevo con sueldo S/ 3,000 y saldo S/ 800 → "Capital disponible" = S/ 800.00 y presupuesto al 50% = S/ 1,500.00; saldo vacío = 0; saldo negativo bloquea; reabrir la app no duplica ni pisa la cuenta.

### Tests for User Story 1

- [X] T002 [P] [US1] Crear `src/core/use-cases/parseCurrentBalance.test.ts`: `''`/`'  '` → `0`; `'800'` → `80000`; `'800.5'` y `'800,50'` → `80050`; `'1,200.00'` → `120000`; `'-5'`, `'-0'`, `'-0.01'` → `DomainError('El saldo actual no puede ser negativo.')`; `'abc'` y `'1.234'` → `DomainError` de `parseMoney`; monto > `Number.MAX_SAFE_INTEGER` en céntimos → `DomainError('El monto es demasiado grande.')`.
- [X] T003 [P] [US1] Extender `src/core/use-cases/defaultPaymentAccount.test.ts`: `buildDefaultCashAccount(userId, now)` sigue devolviendo `opening_balance: 0` (compatibilidad) y `buildDefaultCashAccount(userId, now, 80000)` devuelve `opening_balance: 80000` con el mismo id estable.
- [X] T004 [P] [US1] Reescribir/ampliar `src/infrastructure/repositories/local/LocalOnboardingRepository.test.ts` (hoy usa `saveIncome` en L7, L13, L17) para `saveStartingPoint(userId, { income, openingBalance })`: crea la fuente "Sueldo Base" y la cuenta "Efectivo" con `opening_balance` indicado; llamarlo dos veces no duplica fuente ni cuenta; **no modifica** una cuenta ya existente (saldo previo se conserva, incluso archivada o borrada); `openingBalance` negativo o no entero → `DomainError` sin escribir nada; si falla el ingreso (`income` inválido) no queda cuenta (rollback); el perfil queda con `onboarding_step: 1`.
- [X] T005 [P] [US1] Extender `src/infrastructure/repositories/local/LocalPaymentAccountRepository.test.ts` (bloque `ensureDefault`, L75+): tras `saveStartingPoint` con saldo 80000, `ensureDefault(userId)` es no-op y el saldo sigue en 80000.
- [X] T006 [P] [US1] Actualizar `src/presentation/components/OnboardingStep1.test.tsx` (el mock hoy es `saveIncome`, L16): título "Tu punto de partida"; etiquetas "Sueldo o ingreso mensual" y "Saldo actual (opcional)"; ayuda "Lo que tienes hoy entre efectivo y cuentas. Puedes ajustarlo después en Ajustes → Cuentas."; saldo vacío → llama `saveStartingPoint` con `openingBalance: 0`; sueldo `3000` + saldo `800` → `{ income: 300000, openingBalance: 80000 }`; saldo `-5` → muestra "El saldo actual no puede ser negativo." y **no** llama al repositorio.
- [X] T007 [P] [US1] Actualizar `src/presentation/components/OnboardingWizard.test.tsx`: la etiqueta del primer paso del stepper es "Inicio" (ya no "Ingresos").
- [X] T008 [P] [US1] Crear `src/infrastructure/repositories/local/onboardingStartingBalance.test.ts` (prueba de integración con `fake-indexeddb`): tras `saveStartingPoint('A', { income: 300000, openingBalance: 80000 })` y los movimientos vacíos, `calculateAvailableCapital`/`calculateAccountBalances` dan 80000 y `calculateBudgets(300000, [{50%}])` da 150000 (el saldo **no** altera el presupuesto, FR-006).

### Implementation for User Story 1

- [X] T009 [P] [US1] Crear `src/core/use-cases/parseCurrentBalance.ts`: vacío ⇒ `0`; si empieza con `-` ⇒ `DomainError('El saldo actual no puede ser negativo.')`; el resto por `parseMoney` (céntimos enteros). Hace pasar T002.
- [X] T010 [P] [US1] Modificar `src/core/use-cases/defaultPaymentAccount.ts`: `buildDefaultCashAccount(userId, now, openingBalance = 0)`; sin otros cambios. Hace pasar T003.
- [X] T011 [US1] Reemplazar `saveIncome` por `saveStartingPoint(userId, { income, openingBalance })` en `src/infrastructure/repositories/local/LocalOnboardingRepository.ts` (depende de T010): una sola transacción `rw` sobre `db.profiles, db.income_sources, db.payment_accounts, db.sync_queue`; conserva la lógica actual de la fuente "Sueldo Base" y del perfil; inserta `buildDefaultCashAccount(userId, now, openingBalance)` **solo si no existe** la fila `defaultCashAccountId(userId)`; valida `openingBalance` con un chequeo **explícito** `openingBalance < 0 || !Number.isSafeInteger(openingBalance)` ⇒ `DomainError` (no basta `validatePaymentAccount`: solo valida entero y permite negativos; usarlo únicamente para nombre/tipo de la cuenta). Eliminar `saveIncome` y actualizar sus llamadas. Hace pasar T004, T005, T008.
- [X] T012 [US1] Modificar `src/presentation/components/OnboardingStep1.tsx` (depende de T009, T011): título "Tu punto de partida" (eyebrow "Paso 1 de 3" intacto), campo `income` con etiqueta "Sueldo o ingreso mensual", nuevo campo `openingBalance` (`type="number" min="0" step="0.01"`, **no** `required`, placeholder `0.00`, ayuda enlazada con `aria-describedby`); en el envío `saveStartingPoint(profileId, { income: parseMoney(income), openingBalance: parseCurrentBalance(balance) })`; error visible y persistente (`role="alert"`), mensaje genérico "No se pudo guardar tu punto de partida." Hace pasar T006.
- [X] T013 [P] [US1] Modificar `src/presentation/components/OnboardingWizard.tsx`: `STEPS[0].label` de `'Ingresos'` a `'Inicio'`. Hace pasar T007.

**Checkpoint**: US1 funciona y se prueba sola (`pnpm test -- src/core/use-cases/parseCurrentBalance.test.ts src/infrastructure/repositories/local/LocalOnboardingRepository.test.ts src/presentation/components/OnboardingStep1.test.tsx`).

---

## Phase 4: User Story 3 — Categoría de ahorro fija, sin selector (Prioridad: P2)

**Goal**: el paso 2 no tiene selector "AHORRO"; la de ahorro es fija (renombrable, admite 0%, sin eliminar, etiqueta "Ahorro · fija"); los fallos de guardado se ven.

**Independent Test**: paso 2 sin radios; "Ahorro e Inversión" con "Ahorro · fija" y sin papelera; categorías nuevas nunca de ahorro; ahorro al 0% y total 100% se guarda; un fallo de guardado muestra mensaje.

### Tests for User Story 3

- [X] T014 [P] [US3] Actualizar `src/core/use-cases/validateDistribution.test.ts`: `percentage` `0` válido **solo** si `is_savings`; `0` en no-ahorro → `DomainError('Completa los nombres y porcentajes enteros (de 1 a 100; el ahorro puede ser 0).')`; `101` y no enteros siguen rechazados; suma ≠ 100 y ≠ 1 ahorro siguen rechazadas (mensajes en tuteo).
- [X] T015 [P] [US3] Extender `src/infrastructure/repositories/local/LocalCategoryRepository.test.ts`: `saveDistributionCategory` acepta `percentage: 0` con `is_savings: true` y lo rechaza con `is_savings: false`; `deleteDistributionCategory` sigue rechazando la de ahorro y la única categoría de distribución (mensaje sin jerga: "No se puede eliminar la categoría de ahorro ni la única categoría de distribución."); `saveDistributionSet` con ahorro 0% y total 100 persiste.
- [X] T016 [P] [US3] Actualizar `src/presentation/components/OnboardingStep2.test.tsx`: no existe ningún `input[type=radio]`; la fila `is_savings` muestra "Ahorro · fija" y no tiene el botón "Eliminar categoría …"; una fila de ahorro que **no** es la sugerida (datos heredados) también muestra la etiqueta; "+ Nueva categoría de distribución" crea con `is_savings: false`; renombrar la de ahorro y ponerla en 0% (resto sumando 100) guarda; si `saveDistributionSet` lanza, se muestra el mensaje de error en pantalla (`role="alert"`) y no solo `console.error`; la descripción y el tutorial ya en tuteo (textos de `contracts/ui-copy.md`).

### Implementation for User Story 3

- [X] T017 [P] [US3] Modificar `src/core/use-cases/validateDistribution.ts`: porcentaje entero `<= 100`; `>= 1` salvo filas `is_savings` (`>= 0`); mensajes en tuteo. Hace pasar T014.
- [X] T018 [P] [US3] Modificar `src/infrastructure/repositories/local/LocalCategoryRepository.ts` (`saveDistributionCategory`, L25, y `deleteDistributionCategory`, L40): misma regla de porcentaje que T017 (0 solo ahorro); mensajes de dominio de estos métodos en tuteo y **sin la palabra «bucket»** (usar «categoría de distribución»: "No se puede desmarcar la única categoría de ahorro.", "No se puede eliminar la categoría de ahorro ni la única categoría de distribución."). Hace pasar T015. *(Mismo archivo que T027: T018 va antes.)*
- [X] T019 [US3] Modificar `src/presentation/components/OnboardingStep2.tsx` (depende de T017, T018): eliminar `<input type="radio">` y `handleSetSavingsBucket`; mostrar la etiqueta `Ahorro · fija` en filas `is_savings` y **ocultar** el botón de eliminar en ellas; `handleAddBucket` conserva `is_savings: false`; no se agrega ninguna guarda ni mensaje de "no se puede eliminar" para la de ahorro (sin botón no hay acción que bloquear; la capa de datos ya la rechaza, probado en T015); reemplazar el `console.error` de `handleSubmit` por un estado `saveError` **persistente** ("No se pudo guardar la distribución." + mensaje del dominio si existe); escribir en tuteo los textos de L98, L165 y L199 según `contracts/ui-copy.md`. Hace pasar T016.

**Checkpoint**: US1 y US3 funcionan de forma independiente.

---

## Phase 5: User Story 4 — Categorías y subcategorías al final, sin "General" (Prioridad: P2)

**Goal**: orden de creación en toda la app; categorías nuevas nacen vacías; "Finalizar" bloqueado hasta que todas tengan ≥1 subcategoría; selector de movimientos solo con categorías completas.

**Independent Test**: crear 3 categorías seguidas → al final, en orden, sin subcategorías, con "Agrega al menos una subcategoría" y "Finalizar" deshabilitado; al completar cada una se habilita.

### Tests for User Story 4

- [X] T020 [P] [US4] Crear `src/core/use-cases/sortByCreation.test.ts`: ordena por `created_at` ascendente; empate → por `id`; acepta `Date`, ISO string y número; devuelve **copia** (no muta la entrada); lista vacía y de un elemento.
- [X] T021 [P] [US4] Crear `src/infrastructure/repositories/local/creationClock.test.ts`: llamadas consecutivas devuelven `Date` estrictamente crecientes aun dentro del mismo milisegundo (usar `vi.useFakeTimers` con `Date.now` fijo); nunca retrocede si el reloj del sistema retrocede.
- [X] T022 [P] [US4] Actualizar `src/infrastructure/repositories/local/LocalCategoryRepository.test.ts` (L10-18 hoy espera rechazo sin subcategorías): crear una categoría **sin** subcategorías es válido; con nombres vacíos en `initialSubcategories` sigue rechazándose; `getExpenseCategories` y `getSubcategories` devuelven por `created_at` ascendente (categoría/subcategoría nueva al final aunque su id sea menor); tras `seedDefaults` el orden es el de `defaultCategorySeeds` (Alimentación, Ocio, Transporte, Ahorro y sus subcategorías en el orden definido); `deleteSubcategory` de la última sigue lanzando; una categoría **heredada** que ya tiene la subcategoría "General" se lista tal cual, sin modificarse ni reordenarse respecto a sus demás subcategorías (FR-012 / SC-007).
- [X] T023 [P] [US4] Actualizar `src/presentation/components/OnboardingStep3.test.tsx` (L84-102 esperaba `['General']`): crear categoría → `getSubcategories` devuelve `[]`; la categoría nueva aparece **después** de las existentes; muestra "Agrega al menos una subcategoría." (`role="status"`, no `alert`) y "Finalizar configuración" está deshabilitado; agregar una subcategoría la deja al final de su categoría y habilita "Finalizar" cuando todas están completas; mantener los tests de última subcategoría (L160-170).
- [X] T024 [P] [US4] Extender `src/presentation/components/MovementForm.test.tsx`: una categoría de gasto sin subcategorías **no** aparece en el selector (regresión del comportamiento de `MovementForm.tsx:140-142`, FR-018) y sí aparece al agregarle una.

### Implementation for User Story 4

- [X] T025 [P] [US4] Crear `src/core/use-cases/sortByCreation.ts`: genérico `<T extends { id: string; created_at: Date | string | number }>`, copia ordenada por `new Date(created_at).getTime()` y desempate `id.localeCompare`. Hace pasar T020.
- [X] T026 [P] [US4] Crear `src/infrastructure/repositories/local/creationClock.ts`: `nextCreatedAt(): Date` = `max(Date.now(), last + 1)` con `last` a nivel de módulo (≈ 8 líneas). Hace pasar T021.
- [X] T027 [US4] Modificar `src/infrastructure/repositories/local/LocalCategoryRepository.ts` (depende de T025, T026; **después de T018**): `getExpenseCategories` (L69-71) y `getSubcategories` (L107-109) devuelven `sortByCreation(...)`; `saveExpenseCategory` (L81) deja de exigir ≥1 subcategoría inicial (mantener el rechazo de nombres vacíos en `initialSubcategories`) y usa `nextCreatedAt()` para `created_at` de filas nuevas; `saveSubcategory` usa `nextCreatedAt()` para filas nuevas; mensajes de dominio de estos métodos en tuteo y sin «bucket» (p. ej. "La categoría requiere nombre y una categoría de distribución propia." en lugar de "…un bucket propio."; ajustar las pruebas que verifiquen el texto). Hace pasar T022.
- [X] T028 [US4] Modificar `src/presentation/components/OnboardingStep3.tsx` (depende de T027): `handleAddCategory` (L89) llama `saveExpenseCategory({...})` **sin** `['General']`; en cada categoría con 0 subcategorías mostrar el hint persistente "Agrega al menos una subcategoría." (`role="status"`); `canFinish` ya exige ≥1 subcategoría por categoría (mantener); ayuda de "Finalizar" en tuteo ("Necesitas al menos una categoría con una subcategoría para continuar."); descripción en tuteo (L161). Hace pasar T023 (y T024 sin cambios de código).

**Checkpoint**: US1, US3 y US4 funcionan de forma independiente.

---

## Phase 6: User Story 2 — Español latinoamericano neutro en toda la app (Prioridad: P2)

**Goal**: cero formas de voseo en `src/`, incluidos mensajes de dominio y textos que verifican las pruebas, con una guardia automática que lo hace cumplir.

**Independent Test**: `pnpm test` pasa con `src/voseoGuard.test.ts` activo; recorrido manual sin voseo.

> Reemplazo **manual** guiado por la tabla de `specs/012-pulido-onboarding/contracts/ui-copy.md` (acentos y clíticos: "archívala", "agrégalas", "únete"; "vos" → "tú"/"ti"/"contigo" según contexto). No usar `sed` ciego. **No tocar** "más", "Más", "inglés", "interés", "Interés" ni pretéritos como "Superaste". Las líneas de `OnboardingStep1/2/3.tsx`, `validateDistribution.ts` y `LocalCategoryRepository.ts` ya se resolvieron en US1/US3/US4: solo verificar. Los números de línea citados en T029-T034 son **orientativos** (US1/US3/US4 ya reescribieron varios de esos archivos): localizar cada forma buscando la **cadena** con `rg`, no por número de línea.

### Implementation for User Story 2

- [X] T029 [P] [US2] Lote **dominio** (`src/core/use-cases/`): `validateTransfer.ts` (L29-30 "Seleccioná"), `buildQuickTask.ts` (L18 "Escribí"), `parseMoney.ts` (L6 "Ingresá"), `quickRecordRules.ts` (L48, L51 "Seleccioná"), `evaluateNotifications.ts` (L150 "debés"), `recordInstallmentPayment.ts` (L35 "podés").
- [X] T030 [P] [US2] Lote **repositorios** (`src/infrastructure/repositories/local/`): `LocalIncomeSourceRepository.ts` (L15 "Ingresá"), `LocalPaymentAccountRepository.ts` (L43 "archivala" → "archívala"), `LocalMovementRepository.ts` (L59-61 "Seleccioná", L92 "Eliminá"). Revisar también cualquier mensaje restante en `LocalCategoryRepository.ts`.
- [X] T031 [P] [US2] Lote **formularios** (`src/presentation/components/`): `TransferForm.tsx` (L87, L89), `TaskForm.tsx` (L57), `InstallmentLoanForm.tsx` (L74), `HabitForm.tsx` (L43), `GoalForm.tsx` (L52), `PaymentAccountForm.tsx` (L115), `SharedMovementForm.tsx` (L177 "vos"), `MovementForm.tsx` (L376 "Agregá", L387 "tenés … Agregalas"), `QuickRecordSheet.tsx` (L116, L168), `InstallmentLoanList.tsx` (L96).
- [X] T032 [P] [US2] Lote **pantallas y paneles** (`src/presentation/components/`): `TaskDashboard.tsx`, `GoalDashboard.tsx`, `HabitDashboard.tsx`, `DebtList.tsx`, `ControlPage.tsx`, `NotificationHistory.tsx`, `SettingsScreen.tsx` (L313 "Descargá"), `LoginScreen.tsx` (L48 "Intentá", L82 "aceptás"), `CommandPalette.tsx` (L133 "Usá"), `IncomeSourceSettings.tsx`, `PaymentAccountSettings.tsx` (L85, L120), `control/TasksPanel.tsx` (L195), `control/HabitsPanel.tsx` (L113), `control/GoalsPanel.tsx` (L169), `dashboard/SharedSpaceCard.tsx` (L31 "Debés"), `dashboard/LoansCard.tsx` (L37).
- [X] T033 [P] [US2] Lote **espacio compartido** (`src/presentation/components/`): `SharedSpaceSettings.tsx` (L36 "querés"), `SharedSpaceScreen.tsx` (L69 "tenés/Creá/unite", L108 "sos"), `SharedSpaceCreate.tsx` (L47 "querés"), `SharedSpaceBalances.tsx` (L71-72 "Vos/vos"). Cuidar el contexto de "vos" (sujeto → "tú"; tras preposición → "ti"/"contigo").
- [X] T034 [P] [US2] Lote **tests con copy en voseo** (actualizar las cadenas que verifican, sin cambiar la lógica): `src/core/use-cases/buildQuickTask.test.ts` (L28), `src/presentation/components/TransferForm.test.tsx` (L79, L124, L132, L160), `InstallmentLoanList.test.tsx` (L131, L140), `DebtList.test.tsx` (L78), `IncomeSourceSettings.test.tsx` (L17, L29, L47), `SharedSpaceScreen.test.tsx` (L79), `NotificationHistory.test.tsx` (L20, L25, L42), `SharedSpaceBalances.test.tsx` (L41, L47), `SavingsGoalForm.test.tsx` (L72), `SharedMovementForm.test.tsx` (L223, L267), `ControlPage.test.tsx` (L319, L367), `MovementForm.test.tsx` (L361, L364, L451), `src/presentation/hooks/useControlData.test.tsx` (L61), `OnboardingStep2.test.tsx` (L125), `OnboardingStep3.test.tsx` (L79).
- [X] T035 [US2] Barrido heurístico amplio (una sola vez, tras T029-T034): buscar en `src/` palabras terminadas en `á`, `é`, `í`, `ás`, `és`, `ís` (con `rg -n -o -i "\b[a-záéíóúñ]+(á|é|í|ás|és|ís)\b" src`), descartar las legítimas (`está`, `será`, `más`, `inglés`, `interés`, `así`, `aquí`, `también`, etc.) y corregir cualquier otra forma de voseo restante (p. ej. `Tocá`, `Pulsá`, `Confirmá`, `Cerrá`, `Abrí`, `Cargá`, `Registrá`); registrar las formas nuevas que se hayan encontrado para ampliar la lista de T036.
- [X] T036 [US2] Crear `src/voseoGuard.test.ts` (depende de T029-T035): lee todos los `*.ts`/`*.tsx` bajo `src/` (incluye tests) **excepto el propio archivo**, busca con límites de palabra e insensible a mayúsculas la lista explícita de `contracts/ui-copy.md` (+ las formas de T035: `querés|podés|tenés|sos|vos|debés|necesitás|ganás|aceptás|elegí|seleccioná|ingresá|completá|escribí|definí|agregá|agregalas?|eliminá|renombrá|guardá|registrá|creá|organizá|usá|descargá|intentá|unite|asegurate|archivala`) y falla listando `archivo:línea → forma`. Verificar que **no** marca "más", "interés", "inglés" ni "Superaste".
- [X] T037 [US2] Ejecutar `pnpm test` completo; corregir los tests que fallen por texto (no relajar la guardia). Confirmar SC-003: la guardia da 0 coincidencias.

**Checkpoint**: US2 completa; la constitución v2.1.0 es verificable por `pnpm test`.

---

## Phase 7: User Story 5 — Los avisos desaparecen solos (Prioridad: P3)

**Goal**: los avisos de "no se puede eliminar…" se ocultan a los 4 s o al hacer otra acción; los errores de formulario persisten.

**Independent Test**: provocar el aviso de eliminar última subcategoría → desaparece a los 4 s (o antes con otra acción); el total ≠ 100% del paso 2 **no** desaparece.

### Tests for User Story 5

- [X] T038 [P] [US5] Crear `src/presentation/hooks/useTransientMessages.test.tsx` (con `vi.useFakeTimers` + `renderHook`): `show('a','x')` muestra y a los 4000 ms desaparece (a 3999 ms sigue); un nuevo `show` con la misma clave **reinicia** el temporizador; claves distintas son independientes; `clear('a')` y `clearAll()` ocultan de inmediato y cancelan temporizadores; al desmontar no queda ningún temporizador (sin `setState` sobre componente desmontado); `ttlMs` personalizado.
- [X] T039 [P] [US5] Ampliar `src/presentation/components/OnboardingStep2.test.tsx`: el aviso de eliminar (p. ej. "Necesitas al menos una categoría de distribución." o "No se puede eliminar: tiene N categorías de gasto asociadas.") desaparece a los 4 s y al ejecutar otra acción (agregar/renombrar/eliminar otra); el estado "Total: N% — Debe sumar exactamente 100%" y el `saveError` **no** desaparecen.
- [X] T040 [P] [US5] Ampliar `src/presentation/components/OnboardingStep3.test.tsx`: el aviso "No se puede eliminar: la categoría necesita al menos una subcategoría." aparece junto a esa subcategoría y desaparece a los 4 s o al ejecutar otra acción; el error de `seed` (`errors.seed`) y el hint de categoría vacía **no** desaparecen.

### Implementation for User Story 5

- [X] T041 [US5] Crear `src/presentation/hooks/useTransientMessages.ts` (≈ 30 líneas, sin dependencias): `useTransientMessages(ttlMs = 4000)` → `{ messages, show, clear, clearAll }` con un temporizador por clave en `useRef<Map<string, ReturnType<typeof setTimeout>>>`, `useEffect` de limpieza al desmontar y sin reglas de negocio. Hace pasar T038.
- [X] T042 [US5] Modificar `src/presentation/components/OnboardingStep2.tsx` (depende de T041; después de T019): sustituir `deleteErrors` por el hook; `clearAll()` al inicio de `handleAddBucket`, `handleDeleteBucket`, cambios de nombre/porcentaje y `handleSubmit`; el aviso se pinta junto a la fila que lo causó. El total ≠ 100% y `saveError` quedan persistentes. Hace pasar T039.
- [X] T043 [US5] Modificar `src/presentation/components/OnboardingStep3.tsx` (depende de T041; después de T028): los errores por clave de eliminación (categoría/subcategoría, L103, L123, L134) pasan por el hook; `errors.seed` se mantiene como estado persistente aparte; `clearAll()` al iniciar agregar/eliminar categoría o subcategoría. Hace pasar T040.

**Checkpoint**: las cinco historias funcionan de forma independiente.

---

## Phase 8: Polish & Cross-Cutting

- [X] T044 [P] Actualizar `CLAUDE.md` (sección "Conventions from AGENTS.md / constitution.md": copy de UI en español latinoamericano neutro, **tuteo, sin voseo**) y `AGENTS.md` con la misma regla, para mantener coherencia con la constitución v2.1.0 (Gobernanza: no contradecirla).
- [X] T045 [P] Confirmar que no hay cambios de esquema: `git diff --stat -- supabase src/infrastructure/db/db.ts` vacío (sin migración ni nueva versión Dexie); registrar el resultado en `verification.md`.
- [X] T046 Ejecutar `pnpm test`, `pnpm lint` y `pnpm build`; todo en verde (o, si hay fallos previos de T001, solo esos).
- [ ] T047 (PARCIAL: ver `verification.md`; faltan offline, usuario existente, Ajustes → Cuentas y selector de "Nuevo gasto" a mano) Recorrer `specs/012-pulido-onboarding/quickstart.md` §2 con `pnpm dev` y un usuario nuevo (incluida la prueba offline y un usuario existente con "General" y ahorro heredado); corregir lo que difiera.
- [X] T048 Correr la búsqueda de control de `quickstart.md` §3 y confirmar 0 coincidencias en `src/`.
- [X] T049 Completar `specs/012-pulido-onboarding/verification.md` con resultados reales de T046-T048 y los **límites** de lo no ejecutado (por ejemplo, si el recorrido manual no se pudo hacer), sin afirmar lo no verificado.

---

## Dependencies & Execution Order

### Fases
- **Fase 1 (Setup)** → sin dependencias.
- **Fase 2 (Foundational)** → vacía; no bloquea nada.
- **Fases 3-7 (historias)** → independientes en funcionalidad, pero comparten archivos; orden recomendado: **US1 → US3 → US4 → US2 → US5**.
- **Fase 8 (Polish)** → después de las historias deseadas.

### Dependencias entre historias (por archivos compartidos, no por funcionalidad)
- **US1** no depende de ninguna otra: es el MVP.
- **US3** y **US4** no dependen entre sí funcionalmente, pero ambas modifican `LocalCategoryRepository.ts`: **T018 antes de T027**.
- **US2** va después de US1/US3/US4 para no reescribir copy dos veces y porque T036 activa la guardia global.
- **US5** depende de US3 (T042 tras T019) y de US4 (T043 tras T028) por `OnboardingStep2/3.tsx`.

### Dentro de cada historia
Tests (fallando) → piezas puras → repositorio → hook/UI. Cada tarea de implementación nombra qué tests hace pasar.

### Oportunidades de paralelismo
- **US1**: T002-T008 (pruebas, archivos distintos) en paralelo; luego T009 ∥ T010 ∥ T013; T011 → T012 en secuencia.
- **US3**: T014 ∥ T015 ∥ T016 (pruebas); T017 ∥ T018 (archivos distintos); luego T019.
- **US4**: T020 ∥ T021 ∥ T022 ∥ T023 ∥ T024; T025 ∥ T026; luego T027 → T028.
- **US2**: T029 ∥ T030 ∥ T031 ∥ T032 ∥ T033 ∥ T034 (archivos disjuntos); luego T035 → T036 → T037.
- **US5**: T038 ∥ T039 ∥ T040; T041 → T042 ∥ T043 (archivos distintos).
- **Polish**: T044 ∥ T045.

### Ejemplo de paralelismo (US1)
```text
Lanzar juntas: T002, T003, T004, T005, T006, T007, T008   # pruebas, archivos distintos
Luego juntas:  T009, T010, T013                           # piezas puras y stepper
Después en serie: T011 → T012                             # repositorio, luego UI
```

---

## Implementation Strategy

### MVP primero (solo US1)
1. Fase 1 (T001) → Fase 3 completa (T002-T013).
2. **Detenerse y validar**: sueldo 3000 + saldo 800 ⇒ Capital disponible S/ 800.00, presupuesto 50% = S/ 1,500.00.
3. Es desplegable por sí sola (resuelve el problema principal de usuarios que se registran a mitad de mes).

### Entrega incremental
US1 (MVP) → US3 (ahorro fijo + bug del guardado silencioso) → US4 (orden y sin "General") → US2 (tuteo + guardia) → US5 (avisos) → Polish. Cada incremento deja `pnpm test` en verde.

### Notas
- Commits en inglés (Principio VI), uno por historia o por lote lógico; no mezclar el lote de tuteo (US2) con cambios funcionales.
- Si una tarea descubre una forma de voseo nueva, agregarla a la lista de `voseoGuard.test.ts` y a `contracts/ui-copy.md`.
- No aplicar ningún cambio al remoto de Supabase: esta feature no lo requiere.
