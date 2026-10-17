# 010 — Verificación

## Fase 2 — Sistema de diseño (tokens, fuentes, primitivos)

Fecha: 2026-10-16. Alcance: tokens, fuentes, Tailwind, restilado de primitivos, primitivos nuevos y `formatMoney`.
No se tocaron pantallas, navegación ni shell (fases 3 y 4). Documentación de tokens: `tokens.md`.

### Comandos ejecutados (salida real)

| Comprobación | Resultado |
|---|---|
| `pnpm test` (línea base antes de la fase) | 93 archivos, 484 tests, todo verde |
| `pnpm test` (final) | 103 archivos, 535 tests, todo verde (+51: `formatMoney` 17, `cn` 4, primitivos 30) |
| `npx tsc --noEmit` | sin errores |
| `pnpm lint` | "No ESLint warnings or errors" |
| `pnpm build` (incluye `build-offline-cache.mjs`) | compila; "Offline cache: 32 assets" |
| Fuentes en `.next/static/media` | 7 archivos (Geist `.woff` + subconjuntos woff2 de JetBrains Mono); los 7 aparecen en `public/sw.js` (precaché offline) |

### Navegador (chrome-devtools MCP contra `pnpm dev`)

- La app exige login OAuth (Google/GitHub); no se ingresaron credenciales. Solo se verificó `LoginScreen`: oscuro a 1280 px y claro a 390 px (render y legibilidad correctos, fondo `rgb(9,10,15)` en oscuro).
- `document.fonts`: Geist cargada (`__geist_430277`, peso 100–900). JetBrains Mono carga bajo demanda (no hay texto mono en el login); se forzó con `document.fonts.load` y el peso 500 quedó `loaded`.
- Para ver los primitivos se usó una página temporal `src/app/styleguide-tmp/page.tsx` (eliminada al terminar; no queda ruta nueva). Capturas en oscuro/claro a 1280 px, oscuro/claro a 390 px y `Sheet` abierto en 390 px (bottom-sheet de ancho completo, radio 12 px). Se detectaron y corrigieron: (a) `ThemeToggle` provocaba error de hidratación con tema claro guardado; (b) `Segmented` aplastaba sus pestañas en pantallas angostas (ahora hace scroll horizontal) y (c) la fusión de clases descartaba `text-label-mono-sm`/`text-headline-*` (ver desviaciones).
- Los errores de hidratación restantes de esa página provenían de `Select` de Base UI renderizado en servidor y de `ProgressValue` (formato `Intl` distinto servidor/cliente); ninguno de los dos se usa en SSR en la app real (el `Select` solo existe tras el login y `ProgressValue` no se usa).

### No verificado

- Pantallas autenticadas (Inicio, Finanzas, Control, ajustes, formularios) con los nuevos tokens: sin sesión no se pudieron abrir; solo se verificó vía tests y la página temporal de primitivos.
- Modo offline con recarga y fuentes desde caché: solo se comprobó que el build las lista en el precaché, no se ejecutó la recarga offline.
- `prefers-reduced-motion` y navegación por teclado se cubren con tests (Segmented, Switch, Sheet) y con la regla CSS heredada; no se probaron en el navegador.
- Lighthouse / contraste en navegador: los ratios de `tokens.md` son calculados, no medidos en pantalla.

### Desviaciones del brief

1. Primary claro `#047857` (no `#059669`): `#059669` con texto blanco da 3.77:1 < AA.
2. Colores Tailwind con `hsl(var(--x) / <alpha-value>)` (antes `hsl(var(--x))`): necesario para `bg-primary/10` y los tonos translúcidos.
3. `cn` movido a `src/lib/utils.ts` con configuración propia (`cn/config`), y los 17 primitivos existentes cambiaron `from "cn"` por `from "@/lib/utils"`: el paquete interpretaba `text-headline-*` como color y los descartaba.
4. `ThemeToggle` pasa a dos estados (claro/oscuro) y espera al montaje: con `enableSystem={false}` el paso "sistema" dejaba a next-themes sin clase resoluble.
5. Variable de JetBrains Mono: `--font-jetbrains` (el brief mencionaba `--font-mono`; se evita el choque con el nombre de Tailwind). Añadido `--primary-hover` para el hover del botón principal (más claro en oscuro, más oscuro en claro).
6. `GeistMonoVF.woff` eliminado del árbol de trabajo (sin referencias). `InstallmentLoanList` perdió su helper `centsToDisplay` (reemplazado por `formatMoney`).
7. `Label` y `Skeleton` no cambiaron: heredan `muted`/`foreground` de los tokens y las etiquetas mono en mayúsculas se aplican por pantalla en la fase 4.

### Riesgos abiertos

- Usuarios con `theme=system` guardado en localStorage verán el tema claro hasta pulsar el toggle (`enableSystem` está desactivado).
- `Money size="lg"` (36 px) no cabe en media columna a 390 px; usar `md` o ancho completo en las tarjetas KPI móviles.
- Los pocos usos de `toFixed(2)` que quedan (Dashboard, MovementList, MovementForm, ControlPage, SettingsScreen, formularios) se migran a `formatMoney`/`Money` en las fases 3 y 4.

## Fase 3 — Shell y navegación

Fecha: 2026-10-16. Alcance: rutas nuevas, sidebar/bottom nav/topbar, mes compartido, composiciones transitorias (Finanzas, Control) y retiro de `CreatePage`/`MoreDrawer`. Las pantallas (Inicio, Finanzas, Control, hoja de registro) conservan su interior actual; la fase 4 lo reescribe.

### Comandos ejecutados (salida real)

| Comprobación | Resultado |
|---|---|
| `pnpm test` (antes de la fase) | 103 archivos, 535 tests |
| `pnpm test` (final) | 107 archivos, 580 tests, todo verde (+45 netos: se borraron `CreatePage.test` y `MoreDrawer.test`; se añadieron `FinancesScreen`, `AppTopbar`/`MobileHeader`, `MobileRouteLinks`, `useHasUnreadNotifications`, `localAccount`, `theme-provider`, `calendar` y casos nuevos en `BottomNav`, `MainFlow`, `ControlPage`, `Dashboard`, `AnalysisScreen`, `MovementList`) |
| `npx tsc --noEmit` | sin errores |
| `pnpm lint` | "No ESLint warnings or errors" |
| `pnpm build` | compila; "Offline cache: 32 assets" |

### Navegador (chrome-devtools MCP contra `pnpm dev`, puerto 3110, detenido al terminar)

- Acceso: sin credenciales reales. Se sembró en localStorage/IndexedDB de `localhost:3110` una cuenta local claramente falsa (`fake-shell-user`, "Usuario de prueba", `prueba@example.test`), onboarding completado y 3 movimientos, 1 tarea, 1 hábito, 1 meta y 1 meta de ahorro ficticios. Es el mismo mecanismo de cuenta local que usa la app sin conexión (`observeAccountSession` cae a `getLocalAccount()` sin sesión); no se tocó ninguna comprobación de auth ni se creó página temporal.
- Capturas (en el scratchpad de la sesión, no versionadas): 1280 px oscuro: Inicio, Finanzas (Movimientos, Regla 50/30/20, Préstamos), Control, Control con hoja "Nueva tarea", Ajustes; 1280 px claro: Ajustes y Finanzas; 390 px (emulación 390x844 @2x): Inicio oscuro y claro, Finanzas oscuro, Control con hoja "Nuevo hábito".
- Comprobado: sidebar 240 px con logo `ez·life` + punto de estado, "Nuevo Registro" sin hint ⌘K, 6 destinos, pie con nombre/email reales del usuario falso; topbar sticky con breadcrumb, selector de mes (`Octubre 2026`) y campana con punto de no leídas; bottom nav móvil de 5 slots con "+" central de 56 px (`aria-label="Registrar nuevo movimiento"`, abre el formulario de movimiento); filas "Espacio compartido"/"Mi progreso" en Inicio; sin desborde horizontal en Inicio/Finanzas (3 pestañas)/Hábitos/Ajustes a 390 px (`scrollWidth - innerWidth = 0`); Escape cierra la hoja; títulos de pestaña por ruta.
- Teclado (1280 px): orden de tabulación Nuevo Registro → 6 destinos → tema → cerrar sesión → mes anterior/siguiente → campana → pestañas de Finanzas → botón; el foco queda visible (outline 2 px del tema + `shadow-focus`).
- Consola: tras corregir lo de abajo, 0 errores y 0 advertencias en la sesión final (carga, cambio de rutas/pestañas, hojas y diálogos).

### Hallazgos corregidos durante la verificación

1. `FinancesScreen`: `InstallmentLoanList` y `DebtList` eran hermanos con la misma `key` (0); React avisaba de claves duplicadas. Claves ahora distintas (el mismo defecto existía en el `MainFlow` anterior).
2. `Button` no aceptaba `ref`; Base UI lo pasa al usarlo en `render={<Button/>}` (botón de cierre de `Dialog`/`Sheet`) y React 18 emitía "Function components cannot receive refs" en cada diálogo. `Button` pasa a `forwardRef` (cambio en `src/components/ui/button.tsx`, fuera del alcance nominal de la fase, aislado).
3. Las pestañas de Finanzas a 390 px mostraban barra de scroll horizontal; ahora caben (texto 12 px y padding reducido en móvil, scrollbar oculto).

### No verificado

- 390 px reales de hardware/safe-area: se usó emulación de viewport; `env(safe-area-inset-bottom)` no se probó en un dispositivo con notch (además el `viewport` de Next no declara `viewport-fit=cover`, así que el inset puede valer 0).
- Capturas en claro de Inicio/Control a 1280 px y de Préstamos/Control/Ajustes a 390 px en claro; no se miró Ajustes a 390 px a ojo (solo desborde numérico).
- Comparación píxel a píxel con `inicio-desktop.png`/`inicio-mobile.png`: solo revisión visual del shell (sidebar, topbar, bottom nav); el contenido de Inicio es el actual, no el rediseñado.
- `prefers-reduced-motion` (el punto de estado usa `motion-safe:animate-pulse`; la regla global de la spec 009 sigue activa) y modo offline con recarga: no ejecutados en navegador en esta fase.
- Con cuenta real (OAuth) y sincronización: no probado; el nombre/email del pie salen de `session.user` (metadatos `full_name`/`name` y `email`) y solo se comprobaron con la cuenta local falsa y tests unitarios.
- `scripts/verify-progress-browser.js` y `scripts/verify-audit-responsive.js`: etiquetas de navegación actualizadas pero NO ejecutados (requieren el flujo Playwright CLI y un servidor en 3103). El tramo "Nuevo → Monto → Opciones adicionales" de `verify-progress-browser.js` sigue la forma del formulario anterior a la spec 011 y probablemente necesite ajuste en la fase 4.

### Desviaciones del brief

1. `LocalAccount` gana `name?`/`email?` (poblados en `observeAccountSession` desde `session.user`, solo si existen) porque el árbol no tenía ningún dato de nombre/correo; es un cambio aditivo en infraestructura de auth con tests (`localAccount.test.ts`).
2. Nuevos archivos auxiliares: `MonthSelector.tsx`, `MobileHeader.tsx` (el brief pedía solo `AppTopbar`; separar evita controles duplicados en el mismo componente), `MobileRouteLinks.tsx` (filas transitorias compartidas por Inicio y Ajustes), `dialogChrome.ts` (clase compartida de los diálogos de formulario) y `useHasUnreadNotifications.ts` (punto de no leídas con la API existente `getAllByUser` + `read_at`).
3. `goalsRefreshKey` (metas de ahorro) pasó de `MainFlow` a estado local de `ControlPage`, único consumidor ahora; las claves de hábitos/tareas/metas siguen en `MainFlow` y `ControlPage` además usa un contador local para refrescar tras sus propios guardados.
4. Los formularios de préstamos/cuotas siguen en `Dialog` (como antes) y los de Control en `Sheet`.
5. Logo `ez·life` renderizado como `<h1>` en sidebar y cabecera móvil (convención previa, y los scripts leen `h1`); el script comprobaba tipografía Jakarta/Fraunces, actualizado a Geist.
6. Riesgo de la fase 2 resuelto: un `theme=system` guardado se reescribe a `dark` (`theme-provider.tsx`, con test).

## Fase 4a — Flujos de creación (Nuevo Registro, Mover, cuentas)

Fecha: 2026-10-16. Alcance: hoja "Nuevo Registro" (`QuickRecordSheet`), `MovementForm` rediseñado, `TransferForm`, gestión de cuentas en Ajustes y `viewport` del shell. No se tocaron Inicio, Finanzas ni Control por dentro (solo puntos de entrada) ni `supabase/`.

### Comandos ejecutados (salida real)

| Comprobación | Resultado |
|---|---|
| `pnpm test` (antes de la fase) | 107 archivos, 580 tests |
| `pnpm test` (final) | 115 archivos, 678 tests, todo verde (+98 netos) |
| `npx tsc --noEmit` | sin errores |
| `pnpm lint` | "No ESLint warnings or errors" |
| `pnpm build` | compila; "Offline cache: 32 assets"; el HTML construido trae `viewport-fit=cover` y los dos `theme-color` |

Tests nuevos o ampliados: `addQuickAmount`, `quickRecordRules`, `transferAccounts`, `parseOpeningBalance` (core); `QuickRecordSheet` (16), `MovementForm` (9 → 27: chips, tarjetas de categoría, subcategorías, "Guardar y registrar otro", toggle compartido, edición), `TransferForm` (10), `PaymentAccountSettings` (8), `SharedMovementForm` (`initial`), `useActiveSharedSpaces`, `MainFlow` (+4: abre desde "+", `openQuickRecord` con pestaña y por defecto, refresco tras transferencia) y `BottomNav` (botón del sidebar y `safe-area-inset-bottom`). En `MovementForm.test` solo cambiaron consultas donde el DOM cambió (selects de categoría/cuenta → radios); los asserts de payload y validación son los originales.

### Navegador (chrome-devtools MCP contra `pnpm dev`, puerto 3120, detenido al terminar)

- Cuenta: una local claramente falsa como en la fase 3 (`fake-quick-user`, "Usuario de prueba", `prueba@example.test`), sembrada en `localhost:3120` por localStorage + IndexedDB: onboarding completo, 3 buckets 50/30/20, 4 categorías con subcategorías, fuente de ingreso, cuentas "BCP Débito" y "Visa Crédito" (saldo inicial −S/ 200) además de "Efectivo", y un espacio compartido "Casa" con 2 miembros (filas locales; no se llamó al RPC). Sin credenciales reales.
- 1280 px oscuro: Gasto vacío y relleno, Ingreso, Mover con 3 cuentas, Mover con 1 cuenta (estado vacío y formulario "Nueva cuenta"), Hábito, Tarea, Meta, Ahorro, toggle compartido activo y paso a `SharedMovementForm` con el monto prellenado (45.90) y regreso al borrador con "Cancelar", Ajustes → Cuentas de pago y hoja "Editar cuenta". 1280 px claro: Gasto. 390 px (emulación 390x844 @2x) oscuro y claro: Gasto.
- Comparado a ojo con `registro-mobile.png`: encabezado con punto + título + X, pestañas con iconos, tarjeta del monto con badge EGRESO y chips, concepto, tarjetas de categoría con bucket y check, cuenta en chips, toggle compartido y botones coinciden en estructura. Diferencias: título "Nuevo Registro" (no "Rápido"), 5 pestañas (incluye "Mover", que el mock no tiene), sin avatar ni flecha atrás (es una hoja, no una pantalla).
- Guardados reales: gasto de S/ 70.00 con "Guardar y registrar otro" (mensaje "Registro guardado", monto/concepto vaciados, categoría/cuenta/hora conservadas, foco de vuelta en el monto), ingreso de S/ 3000.00 con Enter, transferencia de S/ 50.00 Efectivo → BCP, y un gasto de S/ 5.50 con la red en "Offline". Resultado: balance del mes S/ 2930.00 antes del gasto offline (la transferencia no cuenta como ingreso ni gasto; después Egresos S/ 75.50), lista de Finanzas con los movimientos y su hora, y saldos en Ajustes BCP S/ 1,550.00 / Visa −S/ 200.00 / Efectivo S/ 2,880.00 (cuadran con saldo inicial ± movimientos).
- Cuentas: archivar BCP y Visa pide confirmación y deja "Efectivo" con "Archivar" deshabilitado (última cuenta activa); tras archivar, "Mover" muestra el estado vacío.
- Teclado: el foco cae en el monto al abrir; Enter en el monto guarda y cierra; Escape cierra; el orden de tabulación (listado del DOM) es pestañas → monto → chips → limpiar → concepto → subcategorías → fecha → hora → toggle → opciones adicionales → guardar → guardar y registrar otro → cerrar.
- Consola: 0 errores y 0 advertencias en toda la sesión (navegación entre rutas, hojas y modo sin conexión).
- Sin desborde horizontal a 390 px; las 5 pestañas caben justas (355 px) y el control hace scroll si no caben.

### Hallazgos corregidos durante la verificación

1. El orden de buckets lo daba el repositorio (por id): la primera categoría preseleccionada era "Inversión". Ahora las tarjetas van por bucket de mayor a menor porcentaje (50/30/20), con test.
2. Los inputs de fecha/hora nativos ya traen su icono: se quitó el reloj propio (duplicado).
3. Los selects (fuente de ingreso, tipo de cuenta, meta de ahorro, espacio) quedaban angostos: ahora ocupan todo el ancho.
4. La confirmación "Registro guardado" persistía al cambiar Gasto/Ingreso: se limpia al cambiar de tipo.
5. Las casillas de "recurrente" y "ajuste" medían 16 px de alto: la etiqueta mide ≥44 px.
6. El botón "Crear cuenta" del estado vacío dejaba el foco en el diálogo: el nombre de la cuenta recibe el foco al abrir.

### No verificado

- Guardar de verdad un gasto compartido: requiere sesión y el RPC `create_shared_movement`; solo se comprobó la visibilidad del toggle, el paso al formulario compartido con monto prellenado y el regreso al borrador (con filas locales sembradas).
- `env(safe-area-inset-bottom)` en un dispositivo con notch (la emulación lo deja en 0); sí se comprobó que el HTML trae `viewport-fit=cover` y que la barra inferior usa `pb-[env(safe-area-inset-bottom)]`.
- `prefers-reduced-motion` en navegador y recarga offline con fuentes desde caché (el guardado offline sí se probó, sin recargar).
- Claro: solo Gasto a 1280 y 390 px; Ingreso, Mover, Hábito/Meta y Ajustes → Cuentas se vieron únicamente en oscuro. Mover con 2+ cuentas solo a 1280 px oscuro (no a 390 px).
- Orden de tabulación comprobado por el DOM, no pulsando Tab; foco visible de los radios (`has-[:focus-visible]`) cubierto por clases, no inspeccionado en pantalla con teclado.
- `scripts/verify-progress-browser.js`: tramo de "Nuevo Registro" actualizado (diálogo "Nuevo Registro", `Monto`, `Concepto / descripción`, `Guardar Registro`) y `node --check` correcto, pero NO ejecutado (requiere Playwright CLI y un servidor en 3103). `verify-audit-responsive.js` no usa el formulario.
- Con cuenta real (OAuth) y sincronización.

### Desviaciones del brief

1. Subcategoría: el brief decía "obligatoria si la categoría tiene"; el formulario previo y el repositorio no la exigen y un test existente guarda sin elegirla, así que se mantuvo OPCIONAL (el chip lo rotula "Opcional").
2. `SharedMovementForm.initial` acepta solo `{ amount }`: el RPC `create_shared_movement` no guarda descripción, así que mostrarla sería engañoso. Ese formulario sigue usando `parseFloat` para el reparto (código previo, fuera de lo tocado).
3. Se añadió la prop opcional `onOpenQuickRecord` a `Dashboard` (sin uso aún) para que MainFlow la pase por props, y `savingsGoalsRefreshKey` a `ControlPage` porque una meta de ahorro creada desde la hoja no se reflejaba en su lista.
4. El guardado de un gasto compartido llama a `onSaved('movement')` (no hay tipo propio) y MainFlow, ante cualquier 'movement', también refresca el espacio compartido.
5. Archivos auxiliares nuevos: `AmountHero.tsx` (monto + chips, común a Movimiento y Transferencia), `quickRecordUi.tsx` (etiquetas, chips de cuenta, fila fecha/hora, icono por categoría según el nombre: el modelo no tiene icono), `PaymentAccountForm.tsx`, `useActiveSharedSpaces.ts`, y casos de uso `quickRecordRules`, `transferAccounts` (con `canArchiveAccount`) y `parseOpeningBalance` (negativo solo en crédito: `parseMoney` no admite signo).
6. El edit de `MovementList` sigue en `Dialog` pero con `max-h` y scroll para el formulario nuevo. `themeColor` es por `prefers-color-scheme` aunque la app ignora la preferencia del SO (arranca siempre en oscuro): puede no coincidir con el tema activo.
7. El toggle de espacio compartido también se oculta para ajustes de balance (el RPC no los admite). La hoja usa `Sheet` con `initialFocus={false}` y enfoca el monto ella misma.

### Riesgos abiertos

- Reabrir la hoja dentro de la animación de cierre (≈100 ms) conserva el estado anterior: el cuerpo aún no se desmontó.
- Los formularios de Hábito, Tarea, Meta y Ahorro conservan su estilo previo (títulos y botones propios): se rediseñan en la fase de Control.
- Con muchas cuentas, las dos filas de chips de "Mover" alargan la hoja.

## Fase 4b — Inicio (Dashboard)

Fecha: 2026-10-16. Alcance: reescritura de `Dashboard` (móvil + desktop en un solo componente), hook de datos, helpers de `core/use-cases`, extracción de `buildHabitStreak` en `HabitList`/`HabitDashboard`, y enrutado desde `MainFlow`. No se tocaron Finanzas, Control ni `QuickRecordSheet` por dentro ni `supabase/`.

### Comandos ejecutados (salida real)

| Comprobación | Resultado |
|---|---|
| `pnpm test` (antes de la fase) | 115 archivos, 678 tests |
| `pnpm test` (final) | 130 archivos, 775 tests, todo verde (+97) |
| `npx tsc --noEmit` | sin errores |
| `pnpm lint` | "No ESLint warnings or errors" |
| `pnpm build` | compila; "Offline cache: 32 assets" |

Una corrida completa intermedia (en paralelo con la carga del equipo) tuvo 5 timeouts de 5 s en `InstallmentLoanForm`, `InstallmentLoanList`, `MovementForm` y `OnboardingWizard` (escritura con `userEvent`); los 4 archivos pasaron en solitario y la corrida completa siguiente quedó 775/775. Es la misma fragilidad por carga ya vista en `Dashboard.test` (ahora con `{ timeout: 3000 }` en sus `waitFor`).

Tests nuevos: unitarios de `calculateAvailableCapital`, `calculateSavingsRate`, `budgetStatus`, `buildHabitStreak`, `habitDay`, `buildFocusToday` (incluye racha en noches UTC-5), `calculateDailyScore`, `calculateWeeklyPerformance` (límites de semana y de mes), `pickPrimarySavingsGoal`, `buildCycleSparkline`, `selectRecentMovements`, `calculateUserSharedNet`, `nextInstallment`, `formatMovementWhen`. Componentes: `Dashboard.test` reescrito (hero y delta, ojo con persistencia y localStorage bloqueado, acciones rápidas, Foco con clic y Space, meta principal, Mi Progreso, préstamos con cuota, escritorio con KPIs, tabla con TRANSFER, espacio compartido presente/ausente, bloques solo-escritorio ausentes en móvil, orden 50/30/20), `dashboardParts.test` (Sparkline, Amount/HideAmountsToggle, FocusPanel, PrimaryGoalCard vacío, `useMediaQuery`, `useHideAmounts`) y `MainFlow.test` (+3: salto a Finanzas > Préstamos, navegación a Control, sin fila duplicada de Mi progreso). Los asserts originales de Dashboard (semáforo con `budget-status-*` y `aria-label`, mensajes vacíos, recarga tras sync, dos `getAllByCycle` al montar y cuatro tras sync) se conservaron; solo cambiaron las consultas donde el DOM cambió (título "Préstamos activos", montos con `Money`). Se quitaron los tests del gráfico de barras y de la tarjeta "Comparación con el mes anterior" porque esos bloques se eliminaron por diseño (la comparación vive en el delta del hero); un test nuevo comprueba que ya no están.

### Navegador (chrome-devtools MCP contra `pnpm dev`, puerto 3130, detenido al terminar)

- Cuenta: local claramente falsa (`fake-inicio-user`, "Usuario de prueba", `prueba@example.test`), sembrada en `localhost:3130` por localStorage + IndexedDB crudo. Datos: 2 cuentas (BCP Débito, Visa Crédito con saldo inicial −S/ 200) más "Efectivo" que crea la app, ingreso S/ 3,000 y gastos en los 3 buckets (Necesidades 112 %, Gustos 96 %, Ahorro 25 %), una TRANSFER, mes anterior con S/ 2,800 − S/ 1,500, dos metas de ahorro, 2 hábitos (uno con racha de 4), 3 tareas (una urgente hoy, una mañana), deuda informal, préstamo en cuotas y espacio compartido "Casa" con S/ 45.00 a favor. Hora real del equipo: 21:12 en UTC-5 (la franja en que `getUTCDay` ya respondería "mañana").
- Capturas (scratchpad, no versionadas): 1280 px oscuro y claro; 390 px (emulación 390x844 @2x) oscuro y claro. Comparado a ojo con `inicio-desktop.png` e `inicio-mobile.png`: coinciden la jerarquía (cabecera mono + título, 4 KPIs, presupuesto + transacciones a la izquierda, Foco/Compartido/Préstamos a la derecha; en móvil hero, presupuesto, Foco, meta, Mi Progreso, préstamos) y los tokens. Diferencias deliberadas: sin sparkline ni cifras inventadas, sin XP/"Nivel"/"PRO"/"v2.4"/"Cronograma"/hora de la tarea, tarjeta de capital con el balance del ciclo y su delta (el mock mostraba un "sueldo consolidado"), "Tasa de ahorro" real (no "proyectada").
- Cifras contrastadas con lo sembrado: balance del ciclo S/ 308.50 (3,000 − 2,691.50), delta −S/ 991.50 (contra 1,300.00), capital S/ 1,908.50 (saldos iniciales 300 + movimientos; la transferencia suma 0), tasa de ahorro 10 %, presupuesto S/ 2,691.50 de S/ 3,000.00, Foco 25 % = 1/4 antes de marcar, meta principal "Viaje a Cusco" 3 % con S/ 150.00 de S/ 5,000.00, cuota 04/24 de S/ 520.00, deuda S/ 60.00 restante, "Te deben S/ 45.00".
- Interacción: ojo (oculta hero y capital, `aria-pressed`, persiste tras recargar y vuelve a mostrar); acciones rápidas Ingreso/Gasto/Mover abren la hoja en su pestaña; Metas y "Ver todo" van a Control; "Ver préstamos" abre Finanzas en Préstamos; Mi Progreso, Espacio compartido y "Aportar" (hoja en Gasto) correctos; marcar hábito y tarea persiste tras recargar; en escritorio, clic real en el ojo y en "Registrar Movimiento", y Space real sobre el check de la tarea urgente (score 75 % a 100 %).
- Consola: 0 errores y 0 advertencias. Sin desborde horizontal a 390 px (`scrollWidth == clientWidth`) tras corregirlo (ver hallazgos); todos los controles de `main` miden ≥ 44 px de alto.

### Hallazgos corregidos durante la verificación

1. El orden de buckets venía del repositorio (por id): Ahorro salía primero. Ahora van de mayor a menor porcentaje (con test).
2. A 390 px la fila inferior del presupuesto (insignias "Cerca del límite de presupuesto") y el encabezado desbordaban el ancho (`scrollWidth` 433). En móvil se omiten las insignias (el punto de estado y "Excedido por…" bastan) y los encabezados ajustan línea.
3. La tabla de transacciones partía la columna Cuenta en 2-4 líneas y repetía "Transferencia" en Concepto y Categoría; ahora Cuenta no se parte (salvo "A → B" de transferencias) y Categoría muestra "—".

### Hallazgos de dominio (no corregidos fuera de Inicio)

- `isHabitScheduledToday`, `buildFixedDaysLog` y el `completedToday` de `HabitList` usan fechas en UTC: en UTC-5 después de las 19:00 el "hoy" ya es mañana (hábito de otro día, racha reiniciada porque el último día del registro queda sin cumplir). `buildHabitStreak` conserva ese comportamiento a propósito (extracción sin cambios). Inicio no depende de él: `habitDay.ts` compara por día local y `buildFocusToday` re-ancla finalizaciones y `created_at` al mediodía local antes de calcular la racha. Control (4d) debería hacer lo mismo.
- Simplificación documentada y mantenida: un hábito por frecuencia usa el conteo histórico como "una semana" (racha 0/1, `completedToday` siempre falso).
- La racha de un hábito pendiente hoy se muestra "hasta ayer" (el evaluador pone 0 mientras hoy sigue abierto); al marcarlo incluye hoy.

### No verificado

- Las interacciones a 390 px se ejecutaron con `.click()` del DOM: el clic del MCP en emulación móvil cae desplazado (≈ ×0.9) y no alcanzaba los botones; los clics reales solo se probaron a 1280 px. No se probó toque real ni `safe-area`.
- Foco visible por teclado en pantalla (solo se verificó que Space activa el check; el anillo se cubre con clases `focus-visible:shadow-focus`), `prefers-reduced-motion` y modo offline con recarga en Inicio.
- Espacio compartido con RPC y sincronización con cuenta real (OAuth): solo filas locales sembradas. "Liquidar saldo" solo navega a la pantalla del espacio.
- Escritorio sin ninguna meta de ahorro (tarjeta "Sin meta de ahorro activa") y días sin hábitos/tareas: solo con tests, no en navegador.
- `scripts/verify-*.js`: no ejecutados.

### Desviaciones del brief

1. `calculateTotalBalance` ya existía en `calculateAccountBalances.ts` (recibe saldos, no movimientos, y no cuenta movimientos sin cuenta); el helper pedido se llama `calculateAvailableCapital(accounts, movements, { includeArchived })` y lo compone. Incluye archivadas por defecto.
2. Sin hora de la tarea: `Task.due_date` es un día a mediodía local, no tiene hora. No hay `dueTime` en `FocusItem`, ni "Vence hoy 18:00", ni hora en "Siguiente:"; se muestra "vence hoy". El mock mostraba "20:00".
3. Pasivo financiero sin vencimiento ni saldo deudor (el modelo no tiene fecha de cuota y la app no calcula amortización). Se muestra "Cuota N/total · M por pagar" y el monto de la cuota (`nextInstallment`). Se omite "Cronograma".
4. `buildFocusToday` ordena pendientes como tareas urgentes, hábitos, resto de tareas; hechos al final. La racha de hábitos pendientes es "hasta ayer". `calculateWeeklyPerformance` recibe un `today` opcional (inyectable) además de `weekStart`; los hábitos por frecuencia solo cuentan en días con cumplimiento (hoy: mientras no se alcance la meta semanal).
5. Detección móvil/escritorio en JS (`useIsDesktop`, `matchMedia`) en vez de duplicar el DOM con clases `hidden`: un único árbol activo, sin testids duplicados. En jsdom (sin `matchMedia`) el valor por defecto es móvil.
6. En escritorio, sin meta de ahorro activa la 4.ª tarjeta KPI muestra "Sin meta de ahorro activa" con "Crear meta" (abre la hoja en Meta) en lugar de dejar un hueco; en móvil la tarjeta se oculta, como pedía el brief.
7. "Ocultar montos" solo cubre el hero móvil y la tarjeta de capital de escritorio (su equivalente); presupuesto, meta y préstamos siguen visibles.
8. El delta del hero es sobre el balance del ciclo ("Sin datos del mes anterior" cuando no hay). El título "Deudas activas" pasó a "Préstamos activos" (incluye cuotas); se mantiene "No tenés deudas activas." cuando ambas listas están vacías.
9. `MobileRouteLinks` sigue en `MainFlow` (debajo de Inicio, solo con "Espacio compartido": "Mi progreso" ya tiene su tarjeta); `PersonalProgress compact` se restiló en vez de reemplazarse. `MainFlow` gana `navigate(route, { financesTab })` y reinicia la sub-pestaña de Finanzas a "Movimientos" en cualquier otra navegación.
10. Archivos auxiliares nuevos: carpeta `components/dashboard/` (`Amount`, `BudgetPanel`, `DesktopKpis`, `FocusPanel`, `HeroBalance`, `LoansCard`, `PrimaryGoalCard`, `RecentTransactions`, `SharedSpaceCard`, `Sparkline`), `useMediaQuery`, y los helpers `budgetStatus`, `habitDay`, `formatMovementWhen`, `calculateUserSharedNet`, `nextInstallment`.

### Riesgos abiertos

- `useDashboardData` carga todo el historial de movimientos para capital, recientes y meta principal; con muchos años de datos habrá que acotar o indexar.
- `view.today` se fija en la última carga: una pestaña abierta pasada la medianoche conserva el "hoy" anterior hasta el siguiente evento de sync o cambio local.
- El MCP de navegador desplaza los clics en emulación móvil (ver "No verificado"): conviene revalidar el toque real en un dispositivo.

## Fase 4c — Finanzas

Fecha: 2026-10-16. Alcance: `FinancesScreen` real (cabecera, KPIs, Regla 50/30/20, Préstamos, Historial), hook de datos, helpers de `core/use-cases`, `MovementList` rediseñado (móvil agrupado por día + tabla de escritorio), restilado de `InstallmentLoanList`/`DebtList`, exportación CSV compartida y `parseMoney` en los formularios de deudas y préstamos con cuotas. No se tocaron `supabase/`, Control, Inicio ni `QuickRecordSheet` por dentro.

### Comandos ejecutados (salida real)

| Comprobación | Resultado |
|---|---|
| `pnpm test` (antes de la fase) | 130 archivos, 775 tests |
| `pnpm test` (final) | 143 archivos, 903 tests, todo verde (+128 netos) |
| `npx tsc --noEmit` | sin errores |
| `pnpm lint` | "No ESLint warnings or errors" |
| `pnpm build` | compila; "Offline cache: 32 assets" |

Tests nuevos: `searchText`, `paginate` (+`pageNumbers`), `describeMovement`, `filterMovements`, `groupMovementsByDay`, `buildRuleView`, `buildFinancesKpis` (+`describeSavingsInsight`), `LocalSyncStatusRepository`, `downloadTextFile`, `menu` (primitivo), `useFinancesData` (6, con IndexedDB real), `RuleSection`, `DebtList` (archivo nuevo), `SettingsScreen` (export CSV). Reescritos: `MovementList.test` (28: filtros con conteo, búsqueda, categoría, orden, agrupación, vacíos, editar/eliminar con confirmación y error, sin menú en compartidos/cuotas, tabla de escritorio con Estado, pie, paginación y reinicio de página) y `FinancesScreen.test` (20, con datos locales reales: layout escritorio/móvil, deep link, KPIs, Regla con semáforo, recarga por `movementsRefreshKey`, CSV, botones y diálogos de préstamos). Ampliados: `parseMoney` (paridad con la fórmula `parseFloat` antigua para 24 importes válidos y rechazo de los inválidos), `InstallmentLoanList`, `DebtForm`, `InstallmentLoanForm`. `MainFlow.test` ahora simula `FinancesScreen` (cambió la composición) en lugar de `MovementList`/`AnalysisScreen`.

### Navegador (chrome-devtools MCP contra `pnpm dev`, puerto 3140, detenido al terminar)

- Cuenta local claramente falsa (`fake-fin-user`, "Usuario de prueba", `prueba@example.test`) sembrada en `localhost:3140` con localStorage + IndexedDB crudo (sin credenciales reales): 2 cuentas (BCP Débito, Visa Crédito con −S/ 200 inicial) más "Efectivo" que crea la app; ingreso S/ 3,000 y un ajuste de S/ 50; 22 gastos en los 3 buckets (Necesidades y Ahorro excedidos, Deseos al 32 %); una TRANSFER, un movimiento compartido ligado, un pago de cuota con `installment_payment_id`, un gasto de setiembre (fuera del mes); deuda informal de S/ 300 con S/ 100 devueltos; préstamo en cuotas BCP.
- Capturas (scratchpad, no versionadas): escritorio 1280 px oscuro y claro (completo), móvil 390 px (emulación 390x844 @2x) en Movimientos, Regla y Préstamos, oscuro y claro.
- Cifras contrastadas con lo sembrado: ingresos S/ 3,050.00 (con el ajuste); gastos S/ 3,707.40 = 124 % de la base S/ 3,000; tasa de ahorro −22 % con "obj. 20 %" (bucket de ahorro); capital −S/ 157.40 (saldos iniciales 800 + ingresos − todos los gastos; la TRANSFER suma 0 y setiembre solo cuenta en el capital); Necesidades S/ 2,769.50 de S/ 1,500 (185 %), Servicios S/ 1,510.00 = 55 % del bucket, Alimentación S/ 271.50 (suma de sus 7 movimientos). Conteos de pestañas 25 / 22 / 2 / 1 / 1.
- Interacción verificada: filtros (conteos y filas), orden asc/desc, paginación de 20 por página (20 + 5; pie "Mostrando 20 de 25 registros del mes"), búsqueda real por teclado ("alimentacion" encuentra 7 filas con acentos), menú de fila con Enter, Escape (el foco vuelve al botón) y flechas, edición por el diálogo existente (el movimiento editado pasa a "Pendiente" en la columna Estado y el resto sigue "Sincronizado"), borrado con confirmación (KPIs recalculados: gastos −25.00, capital +25.00), pago de cuota desde Finanzas (gastos +S/ 900.00, 10 de 12 cuotas, avance 17 %), abono a capital reduciendo plazo (8 de 12, +S/ 100.50), historial de pagos, devolución de deuda con entrada inválida ("1.2.3": mensaje y nada se guarda), devolución parcial (pendiente S/ 150.00) y "Marcar como saldado" (el encabezado pasa de "2 Activos" a "1 Activo"), diálogo "+ Con cuotas" (Escape cierra), deep link "Registrar pago" de Inicio (la sección Préstamos queda a 96 px del borde superior), pestañas móviles una a una, insignia En línea / Sin conexión (con eventos `online`/`offline`).
- CSV: se interceptaron el `Blob` y el ancla: descarga `ez-life-movimientos-2026-10.csv`, `text/csv;charset=utf-8;`, 25 filas más la cabecera `Fecha;Hora;Tipo;Cuenta;Categoria;Monto;Descripcion`, con la TRANSFER como `BCP Débito -> Visa Crédito`, nombres de cuenta, fuente y categoría, y sin el gasto de setiembre.
- Consola: 0 errores y 0 advertencias en las sesiones de escritorio y móvil. Sin desborde horizontal a 390 px (`scrollWidth == clientWidth` en las 3 secciones) y ningún control de `main` menor de 44 px de alto. Foco con Tab real: el siguiente control (selector de categoría) recibe el anillo esmeralda (`:focus-visible`, `box-shadow` más outline de 2 px).

### Hallazgos corregidos durante la verificación

1. El deep link de escritorio hacía scroll antes de cargar los datos y, al crecer las secciones de arriba, Préstamos quedaba fuera de pantalla (scrollY 396, destino a 918 px). Ahora espera a `loading === false`.
2. La tabla desbordaba horizontalmente a 1280 px (Monto fuera de pantalla) por la etiqueta "Pendiente de sincronizar": el texto visible es "Pendiente" y el nombre accesible y el `title` son la frase completa; además se ajustaron paddings y anchos (la tabla cabe en 924 px; por debajo hace scroll horizontal dentro de su contenedor).
3. La cifra grande del KPI de capital rozaba el borde de la tarjeta en `xl`: el tamaño grande pasa a `2xl`.
4. "Salida compartida" quedaba truncado por la insignia: las insignias Ajuste/Compartido ahora van en la segunda línea del concepto. En móvil las filas sin menú reservan el ancho del menú (los importes alinean).
5. El pie decía "Mostrando 20 de 22 registros del mes (filtrado de 25)"; ahora "Mostrando 20 de 22 registros filtrados (25 del mes)".

### No verificado

- Clics en emulación móvil: el MCP los desplaza (el navegador de la sesión tiene zoom 0.9 en `localhost:3140`), así que a 390 px se usó `.click()` del DOM y el teclado real solo en escritorio. Para fijar 1280 px CSS hubo que emular una ventana de 1152 px por ese zoom. No se probó toque real ni `safe-area`.
- Las capturas a página completa dejan en blanco la lista de Préstamos si se toman justo tras montar (la animación `fade-slide-up` no avanza fuera de pantalla); con la sección a la vista se renderiza bien. Es un artefacto de la captura, no se reprodujo con scroll normal.
- `prefers-reduced-motion` (sin forma de emularlo con las herramientas) y modo offline con recarga (en `pnpm dev` no hay service worker; el badge sin conexión se probó solo con eventos).
- El estado "Pendiente de sincronizar" contra un servidor real y con una cuenta OAuth: solo se comprobó la cola local (editar crea entrada; vaciarla marca "Sincronizado" en tests).
- Un movimiento compartido real (RPC) y el formulario de espacio compartido.
- `DebtForm` e `InstallmentLoanForm` conservan su estilo previo (solo cambió el parseo); `SavingsGoalForm` conserva su `parseFloat` (fuera de lo pedido para esta fase).
- Ningún estado "warning" (80–100 %) en pantalla con los datos sembrados; está cubierto por los tests de `buildRuleView`.
- `scripts/verify-*.js`: no ejecutados (sin referencias a las etiquetas que cambiaron).

### Desviaciones del brief

1. `AnalysisScreen.tsx` y su test se eliminaron; su contenido pasó a `buildRuleView` (core) y `finances/RuleSection.tsx`. No usaba recharts, así que no había gráfico que conservar. Sus dos tests (actualización tras commits locales y remotos sin remontar, y mes por `refDate` sin controles de mes) se portaron a `useFinancesData.test` y `FinancesScreen.test`.
2. `MovementList` ya no carga datos: recibe `movements`, `lookups`, etc. por props desde `FinancesScreen` (una sola carga para KPIs, Regla e Historial). Por eso el test "se remonta con `key`" se sustituyó por la recarga silenciosa del hook ante `movementsRefreshKey` y ante `onLocalChanges`.
3. Hook base nuevo `useLocalQuery` (carga, recarga por sync y cambios locales, descarte de respuestas viejas); `useDashboardData` se refactorizó para usarlo sin cambiar su comportamiento (Dashboard y MainFlow siguen verdes).
4. El título de la pantalla es un `h2` (el `h1` del shell es el logo `ez·life`, igual que Inicio). El `h2 Finanzas` que ponía `MainFlow` se movió dentro de `FinancesScreen`.
5. Menú de fila con Base UI Menu (ya era dependencia): nuevo primitivo `components/ui/menu.tsx`, sin deps nuevas. El borrado conserva `window.confirm` (comportamiento previo).
6. `parseMoney` rechaza lo que `parseFloat` aceptaba en silencio ("10.123", "1.2.3", ".5", vacío): ahora muestra "Ingresá un monto con hasta dos decimales." y no llama al repositorio. Para importes válidos el resultado es idéntico (test de paridad).
7. El KPI "Ingresos" incluye los ajustes de balance de tipo ingreso (igual que Inicio, vía `compareMonthlyPeriods`); "Gastos acumulados" incluye todo gasto del mes, también los pagos de cuotas sin categoría.
8. `InstallmentLoanList` y `DebtList` ganaron refresco ante `onLocalChanges` de su tabla (antes solo recargaban tras sus propias acciones). Omitidos por no tener dato real: PENDIENTE de la cuota (el modelo no guarda saldo), próximo vencimiento, TCEA y referencia, "Amortización" (se muestra "Avance de cuotas" = cuotas pagadas sobre pactadas), medios de pago ajenos a `payment_accounts`, presupuestos libres por categoría (se muestra gasto y % del bucket) y "LIVE SYNC · BCP API" (badge En línea / Sin conexión).
9. Los formularios de préstamo siguen en `Dialog` (no `Sheet`).
10. El icono por nombre de `categoryIcon` ganó dos patrones ("Necesidades" usa casa, "Deseos" usa mando) en `quickRecordUi.tsx`.

### Riesgos abiertos

- La insignia "Pendiente" es verdadera mientras haya una entrada en `sync_queue` para ese movimiento; con una cuenta local que nunca sincroniza, todo queda pendiente (es lo real, pero puede sorprender).
- `useFinancesData` lee todo el historial de movimientos para el capital (igual que `useDashboardData`).
- El menú de la fila es la única vía de editar y eliminar: no hay atajo de teclado por fila.
- `sync_queue` se vigila entera: cada ciclo de sync dispara una recarga silenciosa adicional.

### Notas para 4d/4e

- Reutilizar `matchesQuery` y `normalizeText` (`core/use-cases/searchText.ts`) junto con `movementSearchHaystacks` y `describeMovement` (`describeMovement.ts`) en la paleta ⌘K: ya cubren descripción, categoría, subcategoría, cuentas, bucket, tipo, ajuste/compartido y el importe en dos formas ("3,000.00" y "3000.00").
- `downloadTextFile` y `loadExportLookups` viven en `src/presentation/lib/`; `paginate`, `groupByDay`, `selectMovements` y `useLocalQuery` están listos para otras pantallas. Control debería re-anclar fechas locales como se advirtió en 4b.
- `components/ui/menu.tsx` (`DropdownMenu*`) es el patrón de menús de acciones.

## Fase 4d — Control & Hábitos

Fecha: 2026-10-16/17. Alcance: corrección del día local (UTC → local) en los evaluadores de hábitos/tareas, helpers de `core/use-cases`, reescritura de `ControlPage` en `components/control/*` con hook de datos `useControlData`, hojas de edición, restilado de `HabitForm`/`TaskForm`/`GoalForm`/`SavingsGoalForm`, `QuickRecordSheet.initialKind` y retiro de `HabitList`/`TaskList`/`GoalList`/`SavingsGoalList` y de la sección transitoria "Gestionar". No se tocaron `supabase/`, Inicio ni Finanzas por dentro, ni se construyó la paleta ⌘K.

### Comandos ejecutados (salida real)

| Comprobación | Resultado |
|---|---|
| `pnpm test` (antes de la fase) | 143 archivos, 903 tests |
| `pnpm test` (final, America/Lima) | 151 archivos, 1044 tests, todo verde (+141 netos) |
| Misma suite con `TZ=Asia/Tokyo` | 151 archivos, 1044 tests, todo verde |
| Misma suite con `TZ=Pacific/Auckland` | 151 archivos, 1044 tests, todo verde |
| Misma suite con `TZ=UTC` | 151 archivos, 1044 tests, todo verde |
| `npx tsc --noEmit` | sin errores |
| `pnpm lint` | "No ESLint warnings or errors" |
| `pnpm build` | compila; "Offline cache: 32 assets" |

Las cuatro zonas se ejecutaron en PowerShell (`$env:TZ=...`); en Git Bash `TZ=` no llega a Node en Windows (se comprobó con `getTimezoneOffset`), así que esas corridas no valdrían. La línea base previa a la fase también pasaba en Lima, Tokio y Auckland (los tests antiguos construían fechas en UTC de forma autoconsistente), por lo que los nuevos tests de regresión usan componentes locales (`new Date(2026, 9, 16, 22, 0)`). Las cuatro corridas de la matriz se hicieron antes de las dos últimas correcciones de presentación (hallazgos 1 y 2, solo clases/tamaños); después se repitieron `pnpm test` en Lima (151 archivos, 1044 tests verdes), `tsc` y `lint`, pero no Tokio, Auckland ni UTC. `pnpm build` también es anterior a esas dos correcciones.

### Corrección del día local (§1)

Antes: `isHabitScheduledToday`, `buildFixedDaysLog`, `calculateHabitStreakHistory`, `calculateHabitCompletionRate`, `evaluateTaskRecurrence` y el recordatorio de `useNotificationEvaluator` leían `getUTCDay`/`getUTCDate`: en UTC-5 después de las 19:00 "hoy" ya era mañana (hábito de otro día, racha reiniciada) y `evaluateTaskRecurrence` devolvía fechas a medianoche UTC, que en UTC-5 son el día anterior (la tarea nueva llegaba un día antes).

- `habitDay.ts` es el único lugar de las reglas por día local (`dayCode`, `groupCompletionsByDay`, `countCompletionsInWeekOf`, `habitStateOnDay`, `habitLast7Days`, `habitHistoryStart`); `calendar.ts` ganó `startOfDay`, `addDays`, `daysBetween` y `weekWindow` (lunes–domingo local, aritmética por componentes, sin sumar 24 h).
- `evaluateHabitStreak`, `buildHabitStreak`, `calculateHabitCompletionRate`, `calculateTaskCompletionStats` y `evaluateTaskRecurrence` pasan a claves `calendarKey` locales; `buildFocusToday` ya no re-ancla fechas a mediodía. El cálculo de `useNotificationEvaluator` se extrajo a `findHabitsPendingToday` (testeable). `evaluateAchievements.completedHabitWeeks` ya era local: solo se añadió un test de noches.
- Navegador: reloj falso a las 22:00 en America/Lima (03:00 UTC del día siguiente, sábado 17 → UTC domingo 18): "Solo sábados" aparece "Pendiente hoy", "Solo domingos" y el hábito de lunes a viernes dicen "No toca hoy", las rachas se mantienen (8 d) y el hábito de sábados marcado a esa hora cuenta en su día (racha 1 d).

### Cambios de comportamiento más allá de la corrección de zona (con tests)

1. Hábito por frecuencia: la racha pasa de "conteo histórico = una semana (0/1)" a semanas completas lunes–domingo locales que cumplieron `frequency_target` (`buildFrequencyWeeks`); la semana en curso y la semana parcial de creación solo cuentan al cumplirse. `completedToday` real para ambos modos. Se retiró la simplificación documentada en la fase 4b.
2. `isHabitScheduledToday` en frecuencia: también es verdadero si ya se cumplió hoy (un hábito hecho no desaparece de la agenda); `completedToday` en días fijos ahora es "existe cumplimiento hoy" (antes miraba el último día programado).
3. Un día anterior a la creación del hábito nunca está programado (sin faltas fantasma en la tira semanal ni en los 7 puntos).
4. `currentHabitStreak`: la racha mostrada de un hábito de días fijos aún abierto hoy es la de hasta ayer (ya era así en Inicio; ahora también en Control y en la analítica, que antes mostraba 0).
5. `calculateTaskCompletionStats`: una tarea vence/está atrasada por día local (antes una tarea de hoy figuraba "vencida" por la tarde y una hecha el mismo día después del mediodía, "tarde").
6. `evaluateTaskRecurrence`: fechas generadas a mediodía local; se genera cuando llega el día local (antes pasado el mediodía UTC) y copia `priority` y `tag` a la nueva ocurrencia (antes se perdían).
7. `SavingsGoalForm`: `parseMoney` (paridad con `parseFloat` en 10 importes válidos; rechaza "10.123" y "1.2.3"), la fecha límite se guarda con `parseCalendarDate` (antes `new Date('YYYY-MM-DD')` = UTC, un día antes al oeste de UTC) y gana modo edición (`existing`).
8. `GoalForm`: Enter en "Nuevo hito" agrega el hito en lugar de enviar el formulario.
9. `useControlData`: no agrega un segundo cumplimiento si hoy ya existe uno (el repositorio no deduplica) y detecta el cambio de día con la pestaña abierta (revisión cada 60 s). No se inventó "deshacer": un hábito marcado queda marcado.

### Navegador (chrome-devtools MCP contra `pnpm dev`, puertos 3150 y 3160, detenidos al terminar)

- Cuenta local claramente falsa (`fake-control-user`, "Usuario de prueba", `prueba@example.test`) sembrada con localStorage + IndexedDB crudo: 3 hábitos (diario con racha de 8, lunes–viernes, 3 veces por semana) más "Solo sábados"/"Solo domingos" para el caso de zona; cumplimientos en 10 días; 6 tareas (alta/media/baja, hoy, atrasada, mañana, hecha, recurrente); 2 metas (numérica y checklist); 2 metas de ahorro (una con aporte de S/ 1,250.00 de S/ 5,000.00) y 3 movimientos. Sin credenciales reales. El servidor del puerto 3150 murió a mitad de la sesión (límite de la herramienta) y se resembró en el 3160.
- Capturas (scratchpad, no versionadas): 1280 px oscuro y claro, analítica abierta oscuro y claro, hoja "Editar hábito" y "Nueva tarea" a 1280 px, 390 px (emulación 390x844 @2x) oscuro y claro. Comparado a ojo con `control-desktop.png`/`control-mobile.png`: coinciden la jerarquía (tres tarjetas superiores, Hábitos/Metas a la izquierda y Tareas a la derecha en escritorio; Centro de mando con anillo, racha y tira L–D, luego hábitos, tareas y metas en móvil) y los tokens. Diferencias deliberadas: sin "Nivel/XP/Fuego/Alborada", sin capacidad de horas de foco, sin "+12% vs ayer", sin franja del día ni "rúbricas/Entregar", sin horas de tarea, etiqueta de estado derivada (≥80 "Excelente", ≥50 "En ritmo", <50 "Atención") en lugar de "Óptimo".
- Cifras contrastadas con lo sembrado: tira semanal 3/3, 2/2, 3/4, 3/3 y hoy 0/5 al inicio (hábitos diario, lunes–viernes y frecuencia + 2 tareas de hoy); "Carga operativa" 3 hábitos, 1 urgente, 4 metas; marcar "Tender la cama" llevó el anillo de 0 a 20 % (1 de 5), la racha de 8 a 9 y la tira del viernes a 1/5; la tarea rápida subió el total a 6 y su marca como hecha a 2 de 6 = 33 %; tasa de adherencia 87 % → 91 %; meta numérica 40 % → 41 % con "+1"; checklist 60 % → 80 % al marcar el módulo 4; ahorro "Viaje a Cusco" 25 % "En objetivo". Además, con el reloj de las 22:00: 2 de 5 = 40 % tras marcar dos hábitos.
- Interacción verificada: marcar hábito con clic real y con Space real; tarea rápida con Enter (limpia el campo, conserva el foco, anuncia "Tarea añadida", rechaza vacío con `aria-invalid` y mensaje); ventanas Para hoy / Esta semana / Hechas con conteos; marcar tarea; editar hábito por el menú con teclado (flecha abajo + Enter) y guardar con Enter; entradas "+ Nuevo", "Nueva tarea", "Nueva meta" y "Asignar ahorro" abren la hoja en la pestaña y sub-formulario correctos; crear tarea desde la hoja (aparece en "Esta semana" como "Mañana" sin claves de refresco); analítica cerrada por defecto y, abierta, con los gráficos de rachas y de tareas con colores leídos de las variables CSS (sin hex) en ambos temas; sin desborde horizontal a 390 px (`scrollWidth == clientWidth`) y ningún control de `main` menor de 44 px de alto tras la corrección.
- Consola: sin errores ni advertencias tras la última carga (móvil claro).

### Hallazgos corregidos durante la verificación

1. A 390 px el título del hábito se cortaba ("Lectura…", "Solo sáb…") por la insignia de racha y el menú; la racha pasa a la línea del horario y el título se parte.
2. Las pestañas de tareas medían 36 px en móvil; ahora 44 px en móvil y 36 px en escritorio (`useIsDesktop`).
3. Los ejes de los gráficos heredaban el trazo del borde también en el texto (rótulos azulados); ahora solo la línea y las marcas.
4. La tira semanal decía "1 programados"; la fecha de "Carga operativa" salía partida en nodos de texto.

### No verificado

- Clics reales de ratón a 390 px: en emulación móvil el MCP los desplaza, así que se usó `.click()` del DOM (no se probó toque real ni `safe-area`). La emulación de zona horaria no está en las herramientas: el caso UTC-5 se reprodujo con zona real America/Lima y un reloj falso a las 22:00 (inyectado antes de cargar), no con `Emulation.setTimezoneOverride`.
- `prefers-reduced-motion` y recarga sin conexión con fuentes desde caché; el anillo de foco por teclado solo se comprobó indirectamente (Space activa el check), no se inspeccionó en pantalla.
- La consola de las sesiones de escritorio (puerto 3150) no se listó al terminar; solo la sesión final móvil. Eliminar con diálogo `confirm` nativo, la edición de tareas/metas/ahorro y los menús de metas se cubren con tests (IndexedDB real), no en el navegador. Cuenta real (OAuth) y sincronización contra servidor: no probadas. Mi Progreso compacto se vio con gamificación activa; oculto solo en tests.
- `scripts/verify-*.js`: no ejecutados (no referencian etiquetas de Control).

### Desviaciones del brief

1. `describeGoalStatus` solo aplica a `SavingsGoal`: `Goal` no tiene fecha límite en el dominio (no se muestra estado en metas numéricas/checklist). Regla: esperado lineal entre la fecha de creación y el cierre; "Atrasada" si va más de 10 puntos por debajo.
2. Se añadió un bucket `later` (tareas posteriores a esta semana) mostrado bajo "Más adelante" en la pestaña "Esta semana", para que ninguna tarea quede invisible; "Hechas" muestra las 20 más recientes (límite de UI).
3. `buildControlView` concentra todo el cálculo de pantalla (tarjetas, ventanas, metas, carga, adherencia, racha activa); además de los helpers pedidos hay `describeTaskDue`, `findHabitsPendingToday`, `habitAdherence` (null si no hay nada medible aún, para que un hábito recién creado no hunda la adherencia a 0 %) y `summarizeWeek`.
4. Se eliminaron `habitsRefreshKey`, `tasksRefreshKey`, `goalsControlRefreshKey`, `savingsGoalsRefreshKey` y los callbacks `onHabitSaved/onTaskSaved/onGoalSaved` de `MainFlow`/`ControlPage`, y sus tests de remontaje: `useControlData` se refresca solo con `onLocalChanges`/`onSyncCompleted`. Los tests de `HabitList`/`TaskList`/`GoalList` se portaron a `ControlPage.test` (con IndexedDB real, 40 tests) y `useControlData.test`.
5. `MainFlow` ya no envuelve Control en su propio `h2`: el título "Control y Metas" lo pone `ControlPage` (en escritorio como encabezado solo para lectores de pantalla).
6. En escritorio ≥ 1280 px el contenido va en dos columnas (hábitos, metas y Mi Progreso a la izquierda; tareas a la derecha); por debajo, una columna en el orden hábitos, tareas, metas. La detección es por `matchMedia` (un solo árbol). `HabitDashboard` ganó "N % de cumplimiento (últimos 30 días)" por hábito (lo mostraba el antiguo `HabitList`) y las tres analíticas se refrescan ante cambios locales.
7. Archivos nuevos auxiliares: `formUi.tsx` (marco común de formularios, chips de radio y de días), `useChartColors.ts`, `control/ItemMenu.tsx`, `control/controlUi.tsx`.

### Riesgos abiertos

- Un hábito marcado por error no se puede deshacer (el repositorio solo agrega cumplimientos).
- Pasar de dos columnas a una (cambio de ancho) remonta los paneles y reinicia la pestaña de tareas.
- `evaluateNotifications` calcula "vence pronto" con milisegundos (`ceil((due - now) / día)`), no por día local: sin cambios (ventana de recordatorio, no un día exacto). Los nombres de archivo de exportación de `SettingsScreen` usan la fecha UTC (`toISOString`): sin cambios.
- `useControlData` lee todos los movimientos (para el progreso de metas de ahorro) y todo el historial de cumplimientos.

### Notas para la fase 4e (paleta ⌘K)

- Indexar: hábitos (`LocalHabitRepository.getAll`), tareas (`getAllIncludingDone`), metas (`LocalGoalRepository`), metas de ahorro (`LocalSavingsGoalRepository`) y movimientos (`matchesQuery`/`describeMovement` de la 4c). `describeHabitSchedule` y `describeTaskDue` dan el texto secundario de cada resultado.
- Navegación: `MainFlow.navigate('control')`; `ControlPage` no acepta aún un id objetivo (habría que añadir una prop `focus={{ kind, id }}` que abra la hoja de edición o desplace a la tarjeta, con testids `habit-card-<id>`, `task-card-<id>`, `goal-card-<id>`, `savings-goal-card-<id>`). Acciones: `onOpenQuickRecord('habit'|'goal'|'expense', 'habit'|'task'|'goal'|'savings-goal')` ya cubre "Nuevo hábito/tarea/meta/ahorro".

## Fase 4e — Paleta ⌘K, pantallas restantes y verificación final

Fecha: 2026-10-17. Alcance: paleta de comandos ⌘K (núcleo, hook de atajo, componente, entradas en cabeceras, navegación con foco a Control/Finanzas/Ajustes), restilado de las pantallas restantes (Login, Onboarding 1–3, Espacio Compartido y sus formularios, Mi Progreso, Ajustes, Fuentes de ingreso, Notificaciones), correcciones de dinero según la constitución y verificación de todo el rediseño. No se tocó `supabase/` ni se hizo commit.

### Comandos ejecutados (salida real)

| Comprobación | Resultado |
|---|---|
| `pnpm test` (antes de la fase) | 151 archivos, 1044 tests |
| `pnpm test` (final, America/Lima) | 162 archivos, 1208 tests, todo verde (+164 netos) |
| Misma suite con `$env:TZ` = Asia/Tokyo, Pacific/Auckland, UTC | 162 archivos, 1208 tests, todo verde en las tres (PowerShell; la matriz se repitió completa tras el último cambio de código) |
| `npx tsc --noEmit` | sin errores |
| `pnpm lint` | "No ESLint warnings or errors" |
| `pnpm build` | compila; "Offline cache: 32 assets" (cuatro builds durante la fase; el último es el verificado abajo) |

Tests nuevos: núcleo `buildPaletteIndex` (9), `searchPalette` (11), `paletteCommand` (5); hooks `useHotkey` (10), `useRevealTarget` (9), `usePaletteData` (4, IndexedDB real); componentes `CommandPalette` (34: abrir/cerrar, foco y restauración, ARIA combobox/listbox/grupos, anuncio de resultados, flechas/Home/End/Enter/Escape/IME, hover, navegación y acciones por tipo, tema, "Mi Progreso" según gamificación, importes con signo), `OnboardingStep3` (12), `NotificationHistory` (5), `SharedSpaceBalances` (3), `IncomeSourceSettings` (6), y ampliaciones de `MainFlow` (+8: Ctrl+K, entrada del topbar, no abre sobre otro diálogo, foco a movimiento/tarea/cuenta, mes del movimiento, acción de creación), `ControlPage` (+6: foco a hábito, tarea en su ventana, meta y ahorro, elemento inexistente), `FinancesScreen` (+5: abre edición, cambia de sección en móvil, revela no editables, página correcta en escritorio, abandona a los 4 s), `SettingsScreen` (+6), `AppTopbar`/`MobileHeader` (+3), `LoginScreen` (+2), `OnboardingWizard` (+2), `PersonalProgress` (+2), `SharedSpaceScreen` (+1), `Dashboard` (+2) y `SharedMovementForm` (+14: paridad con `parseFloat*100` en 11 importes válidos; rechazo de "10.123", "1.2.3", ".5", "5.", vacío, cero y partes fijas con más de dos decimales). Los asserts existentes no se debilitaron; solo cambió la consulta del botón compacto de Mi Progreso (ya no lleva `aria-label` propio, ver abajo).

### Paleta ⌘K — qué hace

- `buildPaletteIndex` (acciones, "Ir a" con las 3 secciones de Finanzas, movimientos recientes primero, tareas por vencimiento con las hechas al final, hábitos, metas, metas de ahorro, cuentas; sin datos inventados) y `searchPalette` (grupos en el orden pedido más "Cuentas" al final; vacío = Acciones + Ir a + 5 movimientos; con texto, máx. 5 por grupo, prefijo y comienzo de palabra antes que subcadena, orden estable). Los textos del índice se normalizan al construirlo (`normalizeText`), así buscar no re-normaliza miles de movimientos. "3000" y "3,000" encuentran S/ 3,000.00.
- `paletteCommand` mapea cada entrada a una única orden (abrir la hoja con pestaña y sub-formulario, navegar con `financesTab`/`focus`, cambiar tema). `MainFlow.navigate(route, { financesTab, focus })`: un movimiento cambia además el mes compartido; cualquier navegación sin foco descarta el pedido anterior.
- `useHotkey('mod+k')`: ⌘ en Apple, Ctrl en el resto; ignora composición IME, repetición y otros modificadores; `preventDefault`; no actúa mientras haya otro `role="dialog"` abierto salvo la propia paleta (así el mismo atajo la cierra); limpia su listener.
- `CommandPalette` sobre el `Dialog` existente (sin dependencias nuevas), 640 px o ancho − 32 px, `Kbd` en la barra de ayudas; los datos se leen solo mientras está abierta (`usePaletteData` sobre `useLocalQuery`) y se refrescan con los cambios locales. Foco al buscador al abrir y vuelta al elemento previo al cerrar con Esc; al activar un resultado el foco lo decide el destino.
- Destinos: movimiento editable, abre su diálogo de edición; movimiento ligado, compartido o de cuota, se desplaza, resalta y enfoca la fila (cambia de página y limpia filtros); tarea, hábito, meta y meta de ahorro, `ControlPage` (cambia a la ventana de tareas que la contiene) con `useRevealTarget` (scroll suave solo si el movimiento está permitido, anillo estático `data-reveal`, foco a la tarjeta); cuenta, Ajustes con la fila de la cuenta en "Cuentas de pago".
- Entradas: Ctrl/⌘+K solo con la app abierta (nunca en login u onboarding), campo "Buscar… Ctrl K" en la barra superior de escritorio y botón de lupa en la cabecera móvil. "Nuevo Registro" del sidebar sigue sin hint.

### Navegador (chrome-devtools MCP + Playwright CLI)

- Cuenta local claramente falsa (`fake-final-user`, "Usuario de prueba", `prueba@example.test`) en `localhost:3170`: se completó el onboarding de verdad por la interfaz (ingreso S/ 3,000, distribución 50/30/20, categorías) y luego se sembraron por IndexedDB crudo 2 cuentas más "Efectivo", 6 movimientos, 3 tareas, 2 hábitos con cumplimientos, 1 meta, 1 meta de ahorro y un espacio compartido "Casa" con filas locales (sin RPC). Sin credenciales reales. Servidores de desarrollo y producción detenidos al terminar.
- Pantallas vistas con captura: Login (oscuro 1280, claro 390), Onboarding paso 1, 2 y 3 (oscuro 1280), Inicio (1280 oscuro, 390 oscuro), Control (1280 oscuro), Espacio Compartido vacío y con espacio (1280 oscuro) más los diálogos "Nuevo Espacio" y "Nuevo Movimiento Compartido", Mi Progreso (1280 oscuro), Ajustes (1280 oscuro, 390 claro de página completa), Notificaciones (390 claro), la paleta (1280 y 390 oscuro) y el Nuevo Registro con el foco en un chip. No se tomaron capturas de Finanzas en esta fase (se auditó con Lighthouse; a ojo se vio en la 4c).
- Paleta con Ctrl+K real: movimiento ("almuerzo", Enter: Finanzas con el diálogo de edición de ese movimiento), tarea ("banco": Control, tarjeta resaltada con anillo y desplazada a la vista), cuenta ("visa", End, Enter: Ajustes con la fila de la cuenta resaltada y enfocada), y Esc.
- Producción (`pnpm build` y `next start`, puerto 3170): service worker activo con caché nueva (32 activos, 7 fuentes). Con `emulate networkConditions=Offline` (se comprobó que un `fetch` externo y uno local no cacheado fallan): recarga sin conexión y se ven el shell, Geist y JetBrains Mono cargadas, el nombre de la cuenta y las cifras de la base local (S/ 3,503.60 de capital, etc.). Se guardó sin conexión un gasto de S/ 12.34 "Cafe sin conexion": aparece en Finanzas, sigue ahí tras otra recarga sin conexión y quedó 1 entrada en `sync_queue`. Al quitar la emulación el fetch externo vuelve a salir. Límite: bajo esta emulación `navigator.onLine` sigue en `true`, así que el aviso "Sin conexión" no se mostró en ese tramo (sí lo cubren los tests y el script de Playwright, que usa `setOffline`).
- Foco por teclado con Tab real: Inicio (sidebar, mes, "Buscar…", notificaciones), Control (Nuevo, Marcar hábito, Acciones…) y la hoja Nuevo Registro (chip "+S/ 50"): todos con `outline` sólido más `box-shadow` y `:focus-visible` verdadero. Finanzas no se recorrió con Tab en esta fase.
- Movimiento reducido: sí hay emulación (Playwright `emulateMedia({ reducedMotion: 'reduce' })`; el MCP de DevTools no la ofrece). Con "reduce": paleta, overlay y botón del sidebar tienen `animation-duration` y `transition-duration` de 0.00001 s; sin preferencia el botón tiene 0.15 s. Además `verify-progress-browser.js` recorre las pantallas con esa emulación.
- Consola de la sesión de producción: sin mensajes. En desarrollo apareció un aviso de Chrome "form field should have an id or name" (2): el campo de la paleta no tenía `name` (corregido).
- Scripts: `scripts/verify-progress-browser.js` PASA completo en producción (puerto 3103, Playwright CLI 0.1.14 global, sin instalar nada): tipografía Geist, caché de 32 activos, recarga, escritura y reapertura sin conexión, visibilidad persistida (ahora con el Switch), movimiento reducido, foco, y 6 pantallas × 390/1440 px × claro/oscuro sin desborde. `scripts/verify-audit-responsive.js` PASA a 390, 820 y 1440 px. Ambos estaban desactualizados (texto "Balance del Mes", importe `S/ -12.34`, fila "Mi progreso" de Inicio, botón "Editar" suelto, casilla de gamificación): se ajustaron, y la sustitución de `Balance del Mes` se aplicó también a los demás `verify-*.js` (esos no se ejecutaron: requieren sus propios flujos).

### Accesibilidad — Lighthouse (categoría Accesibilidad; mejores prácticas y SEO 100 en todas)

Antes (primer build de la fase) y después (build final). "Nav" es modo navegación; el resto, modo instantánea del estado actual, con la emulación de viewport indicada.

| Pantalla | Antes | Después |
|---|---|---|
| Inicio escritorio oscuro (nav) | 96 | 100 |
| Inicio escritorio claro (nav) | 96 | 100 |
| Finanzas escritorio oscuro | 95 | 100 |
| Finanzas escritorio claro | 92 | 100 |
| Control escritorio oscuro | 97 | 100 |
| Control escritorio claro | 97 | 100 |
| Ajustes escritorio oscuro | 100 | 100 |
| Ajustes escritorio claro | 96 | 100 |
| Paleta abierta, escritorio oscuro | 96 (fallo en el fondo) | 100 |
| Espacio Compartido y Mi Progreso, escritorio oscuro | sin medir | 100 / 100 |
| Inicio móvil oscuro (nav) | 98 | 100 |
| Inicio móvil claro (nav) | 98 | 98 al medir; el arreglo del orden de encabezados llegó después y no se repitió |
| Finanzas / Control / Ajustes móvil, oscuro y claro | sin medir antes de los arreglos | 100 en las seis |
| Paleta abierta, móvil oscuro | sin medir | 100 |

Fallos reales encontrados y corregidos (ninguno quedó pendiente en lo medido):

1. Contraste de insignias y botones tintados: `expense`/`destructive` oscuro `#F43F5E` (4.24:1) pasa a `#FB7185`; claro `#E11D48` (3.78 y 4.00:1) pasa a `#BE123C`; `success` claro `#047857` (4.38:1) pasa a `#065F46`; `warning` claro `#B45309` (4.39:1) pasa a `#92400E`. `tokens.md` actualizado (la tabla de ratios de esa guía quedó sin recalcular para estos cuatro).
2. `aria-controls` hacia paneles inexistentes en las pestañas de filtro de Movimientos y en la prioridad de `TaskForm` (se quitó `idPrefix`; no son pestañas con panel).
3. Botón compacto de Mi Progreso: el `aria-label` no contenía el texto visible (`label-content-name-mismatch`); ahora el nombre sale del contenido.
4. Orden de encabezados en Inicio móvil (h1 del shell y h3 de los paneles): se añadió un `h2` solo para lectores de pantalla.
5. Dos landmarks `main` anidados (`page.tsx` y `Layout`): `page.tsx` ya no envuelve.
6. CLS 0.855 en Inicio móvil (el esqueleto medía unos 460 px y la fila "Espacio compartido" saltaba al cargar): el esqueleto reserva una pantalla; tras el arreglo, 49 comprobaciones sin fallo.
7. Anillo de foco de la paleta (la regla global dibujaba un rectángulo alto alrededor del campo).

Fallos de maquetación hallados por los scripts o la inspección y corregidos: la cabecera móvil se desbordaba con la lupa añadida (el avatar, sin acción, se oculta bajo 640 px); en ancho de tableta (unos 820 px, diseño de escritorio con sidebar) Finanzas desbordaba por la barra de filtros (ahora fila solo desde `xl`) e Inicio por la columna de transacciones (columna `minmax(0,1fr)`); en onboarding paso 2 el botón de borrar caía a otra línea (nombre arriba; % / Ahorro / borrar abajo) y en el paso 3 las secciones salían por id (ahora de mayor a menor %); las fuentes de ingreso partían el nombre a 390 px.

Error preexistente encontrado y corregido: en `IncomeSourceSettings` el botón "Agregar fuente"/"Guardar fuente" no tenía `type="submit"` y el `Button` de Base UI es `type="button"` por defecto, así que el formulario nunca se enviaba con el clic. Verificado en navegador (se agregó "Freelance" S/ 450.50) y con tests.

### Dinero (constitución)

- `SharedMovementForm`: monto total y partes fijas con `parseMoney` y `validateMovementAmount` (los porcentajes siguen numéricos). El mensaje de `parseMoney` se muestra con `role="alert"`.
- Barrido de `src/` por `toFixed(2)` y plantillas `S/ ${…}` fuera de tests. Reemplazados: `SharedSpaceBalances` (ahora `Money`), el relleno de edición de `IncomeSourceSettings` e `InstallmentLoanForm` (ahora `centsToAmountInput`) y el importe de `IncomeSourceSettings` (`Money`). Se dejan a propósito: `exportMovements.ts` (`S/ 1500,50` es el formato de texto del CSV/PDF con coma decimal, no una visualización), `AmountHero` (etiqueta de los chips "+S/ 10", soles enteros), `Sparkline` (coordenadas SVG) y el reparto por porcentaje por defecto de `SharedMovementForm` (`toFixed(2)` de un porcentaje, no de dinero).
- Comentarios obsoletos de `calculateGoalProgress.ts` y `calculateSavingsGoalProgress.ts` corregidos. Los nombres de archivo de exportación de Ajustes usan ahora el día local (`calendarKey`; test que simula las 22:00).

### Hallazgos que no se corrigieron

- `evaluateNotifications` sigue calculando "vence pronto" con milisegundos (afecta al borde de la ventana de 3 días y cambiarlo altera cuándo se notifica; no era trivial sin tocar los tests de notificaciones).
- Una vez, en una sesión del MCP, el atajo Ctrl+K dejó de abrir la paleta después de una auditoría Lighthouse con la paleta abierta (no se vio `preventDefault` en los pulsos siguientes). No se reprodujo en varios intentos posteriores (con Escape previo, sin paleta abierta, con y sin instantáneas). Puede ser un efecto de Lighthouse sobre el diálogo y no de la app, pero no está descartado: conviene reprobar con un navegador real.
- No hay acción "Exportar CSV del mes" en la paleta (necesita el mes y las tablas de nombres que hoy solo carga Finanzas; el botón vive allí). "Cambiar tema" alterna claro/oscuro con `next-themes`.

### Desviaciones del brief

1. Home/End en la paleta mueven la selección a la primera/última opción (estilo `cmdk`), no el cursor del campo.
2. El hint del atajo muestra "Ctrl K" fuera de Apple y "⌘ K" en Apple (el mock decía ⌘K fijo).
3. Se añadió el grupo "Cuentas" (el brief lo pedía solo como destino a Ajustes) y "Regla 50/30/20"/"Préstamos" como destinos de "Ir a".
4. Cuenta lleva a Ajustes y revela la fila de la cuenta (el brief decía "Ajustes (Cuentas de pago)").
5. `paletteFixtures.ts` vive en `core/use-cases` (datos falsos compartidos por los tests del núcleo y de la presentación); no se importa desde código de la app.
6. `OnboardingStep3.tsx` se extrajo del asistente con la misma lógica y mensajes; los tests del asistente se conservan y el archivo gana los suyos.
7. El avatar de la cabecera móvil se oculta bajo 640 px (no cabe junto a mes, lupa y campana).

### No verificado

- Autenticación real (OAuth), sincronización contra Supabase y el RPC real de espacios compartidos: el espacio "Casa" son filas locales sembradas; se abrió el formulario de movimiento compartido pero no se envió. La migración remota no se aplicó ni se probó.
- Toque real y `safe-area` en hardware (solo emulación de viewport; el MCP desplaza los clics en emulación móvil, por lo que a 390 px se usó `.click()` del DOM y teclado real solo en escritorio).
- Atajo ⌘K en macOS (solo cubierto por tests de la rama de plataforma), Firefox y Safari, y lectores de pantalla reales; Lighthouse no sustituye una prueba con tecnología de asistencia.
- Lighthouse sobre Login, Onboarding, la hoja de Nuevo Registro y Notificaciones; Inicio móvil claro tras el arreglo de encabezados; recorrido con Tab de Finanzas, Ajustes y Espacio Compartido.
- Foco de la paleta en móvil con teclado en pantalla.

## Resumen de cierre del rediseño (spec 010)

**Verificado (con salida real, ver cada fase):** tokens, fuentes autohospedadas y primitivos (fase 2); shell y navegación (3); hoja Nuevo Registro, Mover y cuentas (4a); Inicio (4b); Finanzas (4c); Control y Hábitos con corrección del día local (4d); paleta ⌘K, Login, Onboarding, Espacio Compartido, Mi Progreso, Ajustes, Notificaciones (4e). Suite completa 162 archivos / 1208 tests, verde en America/Lima, Asia/Tokyo, Pacific/Auckland y UTC; `tsc`, `lint` y `build` sin errores; Lighthouse de accesibilidad 100 en todas las pantallas medidas (escritorio y móvil, oscuro y claro, con la paleta abierta) salvo Inicio móvil claro (98, sin repetir tras el arreglo); recarga sin conexión desde caché con fuentes y datos locales, y un gasto guardado sin conexión que sigue listado tras recargar; movimiento reducido emulado en un navegador real; foco por teclado visible; `verify-progress-browser.js` y `verify-audit-responsive.js` pasan contra el build de producción con cuentas locales falsas.

**Nunca verificado:** inicio de sesión real (OAuth) y sincronización con servidor; llamadas reales al RPC de espacios compartidos (solo filas locales); toque real y `safe-area` en dispositivos con notch; macOS/Safari/Firefox; lectores de pantalla reales; la migración remota `20261016120000_payment_accounts_time_priority.sql` NO está aplicada (el código del rediseño funciona con la base local, pero la sincronización de cuentas, hora y prioridad contra el remoto no se ha probado nunca).

**Decisión pendiente del usuario (una):** aplicar la migración `supabase/migrations/20261016120000_payment_accounts_time_priority.sql` al proyecto `mvp-lab` con `supabase db push` (siguiendo `mvp-lab-infra/OPERATIONS.md`; no con el MCP ni `execute_sql`). Hasta que se aplique, las cuentas de pago, la hora de los movimientos y la prioridad/etiqueta de las tareas existen solo en el dispositivo y el push de esas filas contra el remoto probablemente falle (no se probó). No se ejecutó nada contra el remoto.
