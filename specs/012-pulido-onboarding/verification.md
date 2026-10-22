# Verificación — Spec 012: Pulido del onboarding

Solo se registran resultados realmente ejecutados y los límites de lo no ejecutado.
Fecha: 2026-10-22.

## Línea base (T001) — `main` limpio, antes de cambiar código

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 162 archivos, **1237 pruebas pasan**, 0 fallos |
| `pnpm lint` | `✔ No ESLint warnings or errors` |

## Resultado final (T046)

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | **168 archivos, 1309 pruebas pasan**, 0 fallos (+6 archivos, +72 pruebas respecto a la línea base) |
| `pnpm lint` | `✔ No ESLint warnings or errors` |
| `pnpm build` | Compilación correcta, incluye chequeo de tipos y la caché offline (32 assets) |

Suite completa al cierre de cada historia: US3 → 164 archivos / 1269 pruebas · US4 → 166 / 1288 ·
US2 → 167 / 1292 · US5 → 168 / 1309. Para US1 no hubo una corrida completa propia en verde: la corrida
combinada de ese momento (164 archivos / 1257 pruebas) tuvo 1 fallo en una prueba nueva mía (un supuesto
erróneo sobre `calculateBudgets`), corregido y verificado con `pnpm vitest run` del archivo; la siguiente
corrida completa (al cerrar US3) ya incluye todo US1 en verde.

> Nota: `pnpm test -- <rutas>` ejecuta la suite completa (el `--` no restringe los archivos con este script);
> para correr archivos concretos se usó `pnpm vitest run <rutas>`.

## Sin cambios de esquema ni de dependencias (T045)

`git status` sobre `supabase/`, `src/infrastructure/db/db.ts`, `package.json` y `pnpm-lock.yaml`: **0 cambios**.
No se aplicó ninguna migración ni se ejecutó `supabase db push`.

## Búsqueda de control de voseo (T048)

La búsqueda de `quickstart.md` §3 (lista explícita, sin distinguir mayúsculas) sobre `src/`, excluyendo
`src/voseoGuard.test.ts` (que contiene la lista): **0 coincidencias**. La guardia automática
`src/voseoGuard.test.ts` pasa dentro de `pnpm test`.

## Recorrido manual en navegador (T047) — PARCIAL

Se ejecutó con `pnpm dev` (puerto 3123) y un navegador en contexto **aislado** (almacenamiento vacío), con una
cuenta local ficticia (`localStorage['ezlife.activeAccount.v1'] = {id:'qa-012-local-user'}`) para saltar el login
de Google. No se usó ninguna sesión ni dato real. Servidor y página cerrados al terminar.

Comprobado en el navegador:

- **Paso 1**: título "Tu punto de partida"; indicador "INICIO"; campos "Sueldo o ingreso mensual" y "Saldo
  actual (opcional)" con la ayuda asociada (`description` accesible). Un saldo `-5` lo frena la validación nativa
  del navegador (`min=0`) antes de nuestro mensaje (que queda como segunda barrera, cubierta por pruebas).
- Con sueldo 3000 y saldo 800: la base local guarda la cuenta "Efectivo" con `opening_balance = 80000` y
  "Sueldo Base" con `amount = 300000`.
- **Paso 2**: sin selectores "AHORRO"; "Ahorro e Inversión" muestra "AHORRO · FIJA" (mayúsculas por estilo) y no tiene
  botón de eliminar; descripción y tutorial en tuteo.
- **Paso 3**: las categorías semilla conservan su orden (Desayuno, Almuerzo, Cena, Snack…). Una categoría nueva
  ("Streaming") aparece al final, **sin** "General", con "Agrega al menos una subcategoría." y "Finalizar"
  deshabilitado; al agregarle una subcategoría el aviso desaparece y "Finalizar" se habilita.
- **Avisos transitorios**: "No se puede eliminar: la categoría necesita al menos una subcategoría." seguía
  visible a los 3 s y había desaparecido a los 4.5 s (medido en el navegador).
- **Inicio tras finalizar**: "Capital disponible" = **S/ 800.00**; presupuesto de Necesidades Básicas =
  **S/ 1,500.00** (S/ 3,000 × 50%). Sin errores en la consola del navegador.

**NO ejecutado en el navegador** (límites):

- Prueba **sin conexión** (offline) del recorrido.
- Usuario **existente** con categoría "General" ya creada y categoría de ahorro heredada: cubierto solo por
  pruebas automatizadas (`LocalCategoryRepository.test.ts`, `OnboardingStep2.test.tsx`).
- Ajustes → Cuentas (que "Efectivo" figure una sola vez con saldo S/ 800.00 tras entrar a la app) y el selector de
  "Nuevo gasto" solo con categorías con subcategorías: no se recorrieron a mano; cubiertos por pruebas
  (`LocalPaymentAccountRepository.test.ts`, `MovementForm.test.tsx`). Antes de cargar la app, la base local tenía
  una única cuenta.
- Sincronización real con Supabase (la cuenta ficticia no tiene sesión, por lo que no se empujó nada).
- Verificación visual/estilos más allá del árbol de accesibilidad (no se tomaron capturas).

## Desviaciones respecto al plan

1. **`CLAUDE.md`**: además de añadir la regla de tuteo, se corrigió su línea previa que decía que el copy debía
   "pasar por i18n", porque contradecía el Principio VI de la constitución (copy hardcodeado, sin i18n).
2. **`SharedMovementForm`**: la etiqueta pasó de "Parte de vos" a "Parte de ti" (y `SharedSpaceBalances`
   reescribe la frase: "Tú le debes a X" / "X te debe") para evitar un "vos" gramaticalmente forzado.
3. **Guardia de voseo**: además de la lista explícita, incluye un segundo patrón para voseo escondido en
   expresiones regulares de pruebas (`/no ten[eé]s …/`), que las primeras búsquedas no veían y que rompieron
   7 pruebas al cambiar el copy. Se corrigieron esas expresiones.
4. **Pruebas con reloj falso (US5)**: se falsean solo `setTimeout`/`clearTimeout` y se define un stub mínimo de
   `jest.advanceTimersByTime` porque Testing Library solo avanza un reloj falso propio si detecta `jest`.
5. **`validateDistribution`**: se exportó el helper `isValidDistributionPercentage` para compartir la regla
   (0% solo en ahorro) con `LocalCategoryRepository.saveDistributionCategory`.
6. **Mensaje del repositorio** `saveStartingPoint` para saldo inválido: "El saldo actual debe ser un monto en
   céntimos mayor o igual a 0." (no estaba fijado en el contrato).

## Convergencia (Fase 9) — 2026-10-22

- **T050**: pruebas de regresión con ahorro al 0% en `calculateBudgets`, `buildRuleView`, `buildFinancesKpis` y `evaluateNotifications` (+4 pruebas). `pnpm test`: 1313 pruebas pasan; `pnpm lint` limpio. `pnpm build` **no** se volvió a ejecutar tras estos cambios (solo tocan pruebas y dos textos de error).
- **T052**: «bucket» eliminado de los mensajes de `LocalCategoryRepository.ts` y `LocalMovementRepository.ts`; ninguna prueba verificaba esos textos.
- **T051 — PARCIAL** (navegador aislado, cuenta local ficticia, DB `ezlife-db`). Comprobado: sueldo 3000 + saldo 800 → "Capital disponible" S/ 800.00 y presupuesto 50% = S/ 1,500.00; Ajustes → Cuentas lista "Efectivo" una sola vez con S/ 800.00; con una categoría vacía sembrada directamente en IndexedDB, "Registrar Movimiento" no la ofrece; con el ahorro heredado sembrado en "Gustos y Deseos", el paso 2 muestra "Ahorro · fija" solo en esa fila y sin botón de eliminar.
- **T051 — NO ejecutado**: prueba **sin conexión**; que la subcategoría "General" heredada (categoría "Legado", sembrada) se conserve sin cambios en Ajustes → "Gestionar categorías de gasto"; sincronización real. Los datos sembrados se escribieron a mano en IndexedDB, no por la UI.

### T051 — completado (segunda pasada, 2026-10-22)

Contexto aislado nuevo (`pnpm dev`, cuenta local ficticia), onboarding repetido con sueldo 3000 y saldo 800, y luego:

- **Usuario existente**: se sembró en IndexedDB una categoría antigua "Legado" con "General" y "Extra". En Ajustes → Gestionar categorías de gasto aparece primero (la más antigua), con "General" y "Extra" en su orden y sin modificaciones.
- **Sin conexión** (`Offline` emulado, `navigator.onLine === false`): se creó una categoría nueva (nace vacía, con "Agrega al menos una subcategoría." y "Finalizar configuración" deshabilitado) y se le agregó una subcategoría ("Finalizar" se habilita). Todo funciona offline.
- **`pnpm build`**: compilación correcta tras los cambios de la Fase 9 (32 assets en la caché offline).

Límites que siguen vigentes: la sincronización real con Supabase no se probó (cuenta ficticia, sin sesión) y los datos "existentes" se sembraron a mano en IndexedDB, no con un usuario real.

### T053 — jerga «bucket» en textos visibles (2026-10-22)

Cambiados: `RuleSection.tsx` (texto de categoría vacía y `aria-label` «Bucket …» → «Categoría de distribución …»), `buildPaletteIndex.ts` (subtítulo de la paleta) y la cadena que verifica `RuleSection.test.tsx`. `pnpm vitest run`: 168 archivos, 1313 pruebas pasan; `pnpm lint` limpio. `pnpm build` **no** se volvió a ejecutar (solo cambian textos).
