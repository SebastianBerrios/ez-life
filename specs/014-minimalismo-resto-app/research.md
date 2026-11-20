# Research: Minimalismo en el resto de la app

**Feature**: `014-minimalismo-resto-app` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

Este documento consolida las decisiones técnicas y de arquitectura de presentación para llevar el lenguaje visual cálido
de la spec 013 al resto de la aplicación sin modificar reglas de negocio, persistencia, migraciones ni agregar
dependencias runtime.

---

## R1. Breakpoints responsive y ergonomía PWA nativa (FR-004, FR-007)

- **Decision**:
  - Cambiar el umbral entre **barra inferior fija** y **barra lateral fija** de `md` (`768px`) a `lg` (`1024px`) en
    `Layout.tsx`, `BottomNav.tsx`, `AppTopbar.tsx` y `MobileHeader.tsx`.
  - Unificar el contenedor principal de `<main>` en `Layout.tsx` a una columna centrada `max-w-[720px]` en todas las
    pantallas principales (coherentemente con `Dashboard.tsx` de la spec 013).
  - Aplicar relleno inferior seguro `pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10` en `<main>` y
    `pt-[env(safe-area-inset-top)]` en `MobileHeader` para dispositivos con notch y barra de gestos.
  - Mantener sincronizado `<meta name="theme-color">` con el tema resuelto (`#FBF5EA` en claro, `#241A2B` en oscuro)
    mediante un efecto ligero en `ThemeProvider` cuando el usuario selecciona tema manual, complementando los media
    queries ya presentes en `src/app/layout.tsx`, sin tocar `public/sw.js` ni flujos de instalación.
- **Rationale**:
  - `md` (`768px`) coincide con el ancho de una tablet en vertical (p. ej. iPad 768×1024). Usar `lg` (`1024px`) para
    activar la barra lateral garantiza exactamente lo especificado: celular y tablet vertical comparten barra inferior
    fija + columna centrada ≤ 720 px; tablet horizontal y escritorio muestran barra lateral + columna centrada ~720 px.
  - `viewportFit: "cover"` ya está configurado en `src/app/layout.tsx`, por lo que `env(safe-area-inset-*)` funciona
    de inmediato en PWA instalada.
- **Alternatives considered**:
  - Mantener `md` (`768px`) para la barra lateral: descartado porque contradice la aclaración de tablet vertical y deja
    poco ancho útil cuando se combina barra lateral de 240 px con una columna de 720 px (`240 + 720 = 960px > 768px`).
  - Usar media queries por orientación (`orientation: landscape`): descartado por fragilidad cuando se abre el teclado
    virtual en celular (que hace que el viewport sea más ancho que alto).

---

## R2. Primitivas compartidas y retiro de estilos "terminal" (FR-001, FR-002, FR-005, FR-008)

- **Decision**:
  - Crear dos primitivas ligeras en `src/components/ui/` (sin dependencias nuevas, Principio VII):
    1. `CollapsibleSection`: bloque colapsable accesible (`<button aria-expanded aria-controls>` + región de contenido),
       objetivo táctil ≥ 44 px, contador opcional en píldora (ej. `"Más opciones · 2 activas"`), soporte controlado o
       no controlado y transición desactivada con `motion-reduce:transition-none`.
    2. `EmptyState`: tarjeta cálida `Panel` centrada con icono en círculo `bg-surface-2`, mensaje breve en tuteo y
       botón de acción en píldora.
  - Extender `SheetContent` (`src/components/ui/sheet.tsx`) para admitir un footer fijo/pegajoso al alcance del pulgar
    en celular (`< 768px`) con `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`, manteniendo la transición automática a
    diálogo centrado en tablet y escritorio (`md:` `>= 768px`).
  - Unificar las etiquetas de navegación en `BottomNav.tsx` y `MainFlow.tsx` a formato de oración (`Control y hábitos`,
    `Espacio compartido`, `Mi progreso`, `Nuevo registro`) y dar estilo píldora (`rounded-full`) al botón `+` móvil y al
    botón `Nuevo registro` lateral como única acción primaria de la navegación.
  - Pulir la pantalla de carga de `MainFlow.tsx` y agregar `src/app/error.tsx` con el mismo lenguaje cálido (paleta
    crema/ciruela, tarjeta `Panel`, botón píldora `"Reintentar"`).
  - Retirar `FinancesKpis.tsx`, `MovementTable` (en `MovementRows.tsx`) y cualquier componente o clase de estilo
    terminal que quede sin consumidores (verificando con `grep` antes de borrar).
- **Rationale**:
  - Centralizar colapsables y estados vacíos evita estilos ad hoc repetidos en Finanzas, Control, Espacio Compartido,
    Ajustes y los 6 formularios.
  - Usar `<button aria-expanded>` en `CollapsibleSection` en lugar de `<details>` nativo permite control reactivo limpio
    para auto-abrir `"Más opciones"` ante errores de validación (FR-023) y para auto-abrir secciones de Ajustes cuando
    llega un deep-link (FR-021), con comportamiento consistente en jsdom y navegadores móviles.
- **Alternatives considered**:
  - Usar `@base-ui/react` Accordion: innecesario para un componente de ~45 líneas (Principio VII: simplicidad).
  - Mantener `<Dialog>` en algunos formularios y `<Sheet>` en otros: descartado porque FR-022 exige consistencia
    (bottom sheet en celular, diálogo centrado en tablet/computadora) en todos los formularios alcanzados.

---

## R3. Separación de lógica de frases en funciones puras (Principio III, FR-025)

- **Decision**:
  - Extraer toda construcción de cifras protagonistas, frases dinámicas y conteo de campos avanzados a módulos puros en
    `src/core/use-cases/` con pruebas unitarias dedicadas:
    1. `buildFinancesHero.ts`: calcula los tres datos protagonistas de Finanzas (balance neto del periodo filtrado,
       porcentaje gastado del ingreso mensual en 50/30/20, total que debes = préstamos + tarjetas + deudas `borrowed`,
       más total que te deben = deudas `lent`). Reutiliza `selectCardOwed` de la spec 013 para tarjetas.
    2. `formatFinancesPhrases.ts`: construye frases en español latinoamericano neutro con tuteo para bloques 50/30/20,
       préstamos en cuotas (con singular/plural y manejo de `payment_day` ausente o préstamo saldado), deudas informales
       y tarjetas de crédito.
    3. `formatSharedSpacePhrases.ts`: calcula el saldo neto del usuario en un espacio compartido y formatea cada saldo
       entre pares (`"Ana te debe S/ 40"`, `"Le debes S/ 40 a Ana"`, `"Están al día"`) y la descripción de división de
       un movimiento compartido.
    4. `formAdvancedFields.ts`: cuenta campos avanzados con valor activo por formulario, construye la etiqueta
       `"Más opciones"` / `"Más opciones · N activas"` (singular `"1 activa"`), y determina si un error corresponde a
       un campo avanzado para disparar auto-despliegue.
- **Rationale**:
  - Cumple estrictamente Principio III (lógica fuera de componentes React), Principio VIII (céntimos enteros) y
    Principio VI (tuteo verificable por tests unitarios y `voseoGuard.test.ts`).
- **Alternatives considered**:
  - Construir strings inline dentro de los JSX: descartado por violar FR-025 y Principio III.

---

## R4. Rediseño de Finanzas: tres pestañas, un protagonista cada una (US2, FR-009..FR-012)

- **Decision**:
  - Eliminar `FinancesKpis` y la vista apilada multi-sección de escritorio: `FinancesScreen` usa `Segmented`
    (`Movimientos` / `Regla 50/30/20` / `Préstamos`) en todos los tamaños de pantalla dentro de la columna de ~720 px.
  - **Movimientos**: hero superior con el balance neto del periodo filtrado (`ingresos − egresos`, excluyendo
    transferencias). Debajo, barra de búsqueda/filtros ligera y lista agrupada por día (`MovementCard` redondeada con
    píldoras pastel, sin `MovementTable`).
  - **Regla 50/30/20**: hero superior con el porcentaje gastado del ingreso mensual (o frase guía si no hay ingreso
    esperado configurado). Debajo, una tarjeta por bloque (Necesidades, Deseos, Ahorro) con píldora pastel
    (`pill-needs` / `pill-wants` / `pill-savings`), frase humana (`"Llevas S/ 130 de S/ 630 en gustos"`), barra suave y
    desglose de categorías desplegable.
  - **Préstamos**: hero superior con el total que debes (préstamos en cuotas + deuda corriente de tarjetas + deudas
    informales `borrowed`) y, si hay deudas `lent` pendientes, un bloque secundario aparte `"Te deben S/ X"`. Debajo:
    tarjetas de crédito (reutilizando `selectCardOwed` y el acceso `"Agregar línea de crédito"` de la spec 013),
    préstamos en cuotas con frase de estado (`"Te faltan 8 cuotas · próxima el 15"`) y deudas informales, conservando
    todas las acciones existentes (pagar cuota, abono a capital, historial, corregir términos, saldar, borrar).
  - Ampliar `useFinancesData` (solo lectura local, sin cambios de modelo) para exponer también las tarjetas de crédito
    y deudas/préstamos necesarios para calcular el hero de Préstamos sin duplicar consultas Dexie.
- **Rationale**:
  - Alinea Finanzas con el ritmo visual del Resumen de la spec 013 (una columna ~720 px, cero tablas, cero grids de 4
    KPIs) y mantiene intactas todas las mutaciones y validaciones existentes.
- **Alternatives considered**:
  - Mantener `MovementTable` solo en escritorio: descartado porque FR-003 y FR-010 prohíben explícitamente tablas
    rígidas y piden lista agrupada por día.

---

## R5. Formularios enfocados en lo esencial con "Más opciones" (US3, FR-022, FR-023)

- **Decision**:
  - Todos los formularios alcanzados se presentan en `Sheet` (bottom sheet con footer fijo en celular, diálogo centrado
    en tablet y escritorio): `QuickRecordSheet` (`MovementForm`, `TransferForm`), edición en `MovementList`,
    `PaymentAccountForm`, `InstallmentLoanForm` y `DebtForm`.
  - Clasificación esencial vs. `"Más opciones"` por formulario:
    - `MovementForm`: **esenciales** = monto (`AmountHero`), cuenta (`AccountChips`), categoría de gasto / fuente de
      ingreso, concepto breve; **avanzados** = subcategoría, fecha y hora personalizada, compartir en espacio
      compartido, meta de ahorro, recurrente, ajuste de balance.
    - `TransferForm`: **esenciales** = monto (`AmountHero`), cuenta origen, cuenta destino (+ intercambiar);
      **avanzados** = fecha y hora personalizada, concepto/descripción.
    - `PaymentAccountForm`: **esenciales** = nombre, tipo (y línea de crédito cuando se crea tarjeta de crédito nueva,
      pues `validateNewCreditCard` la exige); **avanzados** = saldo inicial, día de cierre, día de pago (y línea de
      crédito al editar tarjeta existente si ya está definida o falta).
    - `InstallmentLoanForm`: **esenciales** = entidad financiera, monto, N° de cuotas, monto de cuota, categoría
      50/30/20 (todos requeridos por el dominio); **avanzados** = día de pago, tasa de interés %.
    - `DebtForm`: **esenciales** = nombre de la persona, dirección, monto; **avanzados** = fecha de vencimiento, tasa de
      interés %.
  - En modo edición, `"Más opciones"` inicia siempre **plegado** mostrando `"Más opciones · N activas"` cuando hay
    campos avanzados con valor (aclaración confirmada en spec).
  - Si al enviar el formulario ocurre un error de validación en cualquier campo dentro de `"Más opciones"`, el estado
    controlado de `CollapsibleSection` pasa a `open = true` automáticamente (FR-023).
- **Rationale**:
  - Reduce en ≥ 30% los campos visibles iniciales en los formularios con campos opcionales (SC-003), mantiene 100% de
    compatibilidad con los valores por defecto existentes y evita errores invisibles detrás de un bloque plegado.
- **Alternatives considered**:
  - Abrir `"Más opciones"` automáticamente al editar si tiene valores: descartado porque la clarificación explícita de
    la spec pide iniciar plegado con contador numérico.

---

## R6. Control y Hábitos centrado en "lo de hoy" (US4, FR-013..FR-015)

- **Decision**:
  - Eliminar el layout de 2 columnas (`wide`) y el `DesktopHeader` de 3 paneles; usar una columna centrada `max-w-[720px]`.
  - Orden vertical único en todos los dispositivos:
    1. **Hero de hoy**: puntaje de hábitos / avance diario en Fredoka grande + `RingProgress` limpio (retirando el texto
       `"SCORE"` en mayúsculas) + racha activa + tira semanal (`WeekStrip` sin abreviaturas de mes en mayúsculas).
    2. **"Foco de Hoy"**: tarjeta dedicada con lo que corresponde hacer hoy (hábitos programados para hoy + tareas
       vencidas o para hoy) con acción rápida de completar en un toque, sin duplicar reglas de dominio.
    3. **Selector segmentado** (`Hábitos` / `Tareas` / `Metas`): muestra una lista a la vez en tarjetas redondeadas con
       acción principal clara y estado vacío accionable, manteniendo las 3 entidades separadas (Principio XIII).
    4. **Analítica plegada por defecto**: `AnalyticsSection` con `CollapsibleSection`, montando los gráficos solo al
       abrirse.
  - Cuando llega un `focus` desde ⌘K (p. ej. una tarea o meta), seleccionar automáticamente la pestaña correspondiente
    del selector segmentado antes de revelar el elemento.
- **Rationale**:
  - Devuelve prominencia a "Foco de Hoy" y al puntaje de hábitos retirados del Resumen en la spec 013, y evita el muro
    vertical de 4 paneles simultáneos.
- **Alternatives considered**:
  - Mostrar Hábitos, Tareas y Metas apilados a la vez: descartado por la clarificación explícita que elige selector
    segmentado debajo de "Foco de Hoy".

---

## R7. Espacio Compartido en frases y movimientos compartidos legibles (US5, FR-016..FR-018)

- **Decision**:
  - Columna centrada `max-w-[720px]`.
  - Estado sin espacio: `EmptyState` cálido con acciones claras `Crear espacio` y `Unirme con código`, abriendo
    `SharedSpaceCreate` y `SharedSpaceJoin` en `Sheet` (con botón de copiar código al crear).
  - Estado con espacio activo:
    - Tarjeta protagonista con el saldo neto del usuario en el espacio (`"Te deben S/ 40"`, `"Debes S/ 40"`, o
      `"Están al día"`) y botón principal `+ Movimiento` (abriendo `SharedMovementForm` en `Sheet`).
    - Saldos por miembro en filas redondeadas sin `divide-y`, usando `formatSharedSpacePhrases` (`"Ana te debe S/ 40"`,
      `"Le debes S/ 40 a Ana"`).
    - Lista de movimientos compartidos del espacio (reutilizando `LocalSharedMovementRepository.getAllForSpace` ya
      leído por la pantalla) en tarjetas limpias con quién pagó, tipo de división y monto, sin tablas ni bordes duros.
    - Ajustes del espacio (modo de permisos y abandonar) dentro de un `CollapsibleSection` plegado por defecto.
- **Rationale**:
  - Reutiliza el repositorio y los cálculos de `calculateSharedBalance` sin tocar reglas de membresía (Principio IX) ni
    realtime best-effort (Principio XII).
- **Alternatives considered**:
  - Mostrar solo saldos sin listar movimientos compartidos: descartado porque FR-018 pide explícitamente listar los
    movimientos compartidos y su división de forma legible.

---

## R8. Mi Progreso ligero y Ajustes en 5 secciones colapsables (US6, FR-019..FR-021)

- **Decision**:
  - **Mi Progreso**: columna `max-w-[720px]`, tarjeta protagonista con `X de 6 logros`, cuadrícula ligera de 2 columnas
    en `sm+` (1 columna en 360 px) con tarjetas redondeadas y píldoras claras (`Logrado` / `En curso`), respetando el
    interruptor de visibilidad existente.
  - **Ajustes**: columna `max-w-[720px]` (eliminando `xl:grid-cols-2`).
    - Arriba, fuera de cualquier sección plegada: bloque visible con `"Completar configuración"` y `"Ver tutorial"`.
    - Debajo, exactamente **5 secciones colapsables** independientes (todas plegadas por defecto, varias abiertas a la
      vez):
      1. **Perfil** (nombre, correo, cerrar sesión).
      2. **Cuentas e ingresos** (`PaymentAccountSettings`, `IncomeSourceSettings`, editar distribución 50/30/20,
         gestionar categorías). Se auto-abre automáticamente si llega `focus` de cuenta o `editAccountId`.
      3. **Notificaciones** (hora de recordatorio, in-app, push).
      4. **Apariencia** (`ThemeToggle` + interruptor de visibilidad de Mi Progreso).
      5. **Datos y exportación** (exportar CSV y PDF).
- **Rationale**:
  - Elimina el scroll largo de 10 tarjetas abiertas en Ajustes y respeta el deep-link desde Resumen (`"Agregar línea de
    crédito"`) y desde ⌘K (`accountFocus`).
- **Alternatives considered**:
  - Acordeón exclusivo (solo 1 sección abierta a la vez): descartado por la clarificación explícita que permite
    mantener varias abiertas simultáneamente.
