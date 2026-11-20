# Feature Specification: Balance del mes, cuentas y deudas, tutorial y Resumen minimalista

**Feature Branch**: `013-balance-mes-resumen-minimalista` (la rama no se creó: no hay hook `before_specify` registrado)

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Balance del mes, cuentas y deudas en el onboarding, tutorial y Resumen minimalista" (ver el texto completo del encargo en el historial de la sesión; resumido en Problema).

Constitución aplicable: v2.1.0. Sin dependencias runtime nuevas (Principios I y VII): el tour se escribe a mano y
las fuentes se cargan de forma local. Dinero siempre en céntimos, solo PEN (Principio VIII). Offline-first
(Principios V y XII). Recordatorios solo por el sistema de `Notification` existente (Principio XI).

## Clarifications

### Session 2026-11-10

- Q: Cuando el usuario mueve dinero hacia o desde sus ahorros, ¿ese monto cuenta dentro de "Salió" y "Entró", o se muestra en una línea aparte? → A: Línea aparte. "Entró" y "Salió" incluyen solo ingresos y gastos reales (compras con tarjeta y cuotas de préstamo incluidas); aportes y retiros de ahorro se muestran aparte ("Ahorraste S/ X" / "Sacaste S/ X de tus ahorros") y Balance = arranque + Entró − Salió − Ahorraste + Sacaste.
- Q: ¿Qué debe mostrar el Resumen para una tarjeta de crédito que el usuario ya tenía antes de esta versión y que no tiene línea de crédito guardada? → A: La línea es opcional para tarjetas existentes: sin línea, el Resumen muestra solo "Debes S/ X" (sin "de S/ Y") y la tarjeta ofrece "Agregar línea de crédito"; no se pide nada al actualizar.
- Q: Si el usuario registra un gasto pagado directamente desde una cuenta de ahorros, o un ingreso depositado directamente en ella, ¿cómo afecta al Balance del mes y a "Entró · Salió"? → A: Retiro/aporte implícito: el gasto desde ahorros cuenta en "Salió" (y en el 50/30/20) pero no baja el Balance y reduce el ahorro neto; el ingreso depositado en ahorros cuenta en "Entró" pero no sube el Balance y suma al ahorro neto.
- Q: Si el usuario registra a mano (sin pulsar "Registrar" en el ítem) algo que ya estaba en "Por registrar", ¿cómo decide la app que el ítem quedó cubierto? → A: Por vínculo estructurado en el mes, sin importar monto ni texto: sueldo = ingreso con esa fuente de ingreso; recurrencia = movimiento de esa regla; cuota = pago de cuota de ese préstamo; tarjeta = transferencia hacia esa tarjeta.
- Q: Cuando el usuario hace un ajuste manual de saldo (spec 006), ¿ese ajuste debe cambiar el Balance del mes y contar dentro de "Entró" o "Salió"? → A: Cambia el Balance (suma o resta la diferencia) pero no cuenta en "Entró", "Salió" ni en el 50/30/20; se muestra aparte como "Ajuste de saldo S/ X" cuando existe.

### Session 2026-11-11

- Q: El tramo de un pago de tarjeta que cubre deuda previa, ¿cuenta en "Salió"? → A: Sí. Es dinero real que sale de débito/efectivo: suma a "Salió" y baja el Balance, pero no cuenta en el 50/30/20 (no es un gasto nuevo: la compra ya se contó cuando se hizo, o es anterior a esta versión).
- Q: Un gasto registrado en la categoría de Ahorro (bucket de ahorro), ¿cuenta como "Salió" o como "Ahorraste"? → A: Como "Ahorraste": sale del Balance, suma al ahorro neto y no cuenta en "Salió". Si se paga desde una cuenta de ahorros no genera flujos. Registrar a la vez ese gasto y una transferencia a ahorros duplica el aporte; es responsabilidad del usuario.
- Q: ¿Cuándo aparece en "Por registrar" y cuándo notifica una cuota de préstamo o un pago de tarjeta? → A: Desde 3 días antes de su día de pago, y la notificación sale cuando el ítem pasa a la lista. Sueldo y recurrencias aparecen y notifican el día que toca.
- Q: ¿El usuario puede marcar una "cuenta principal"? → A: No. La cuenta principal es solo el valor por defecto del selector de cuenta de origen (la cuenta de débito activa más antigua y, si no hay, "Efectivo"); el usuario elige otra en cada pago. No hay campo nuevo.
- Q: Si el usuario crea una cuenta con saldo después del primer mes, ¿cómo afecta al Balance? → A: El saldo inicial de una cuenta de débito/efectivo creada en un mes posterior al de `balance_since` entra al Balance de su mes de apertura como "Ajuste de saldo S/ X" (sin contar en "Entró", "Salió" ni 50/30/20); los meses anteriores no cambian. Las cuentas de ahorros no mueven el Balance por su saldo inicial.
- Q: La deuda de tarjeta previa, ¿es la anterior al día de la actualización o la anterior al mes? → A: La anterior al inicio del mes en que se actualiza (`balance_since`); las compras de ese mes cuentan como deuda corriente.
- Q: ¿El ítem "Cuentas" del checklist puede declararse "no aplica"? → A: Sí, con un botón explícito "Solo uso efectivo" en el paso 2; continuar sin bancos y sin pulsarlo deja Cuentas pendiente.
- Q: ¿Cuántos ítems de "Por registrar" se muestran? → A: Los 3 primeros; con más, "Ver todos (N)" expande la lista en el mismo lugar.
- Q: ¿Qué muestra el selector de mes antes de `balance_since`? → A: Las mismas reglas: compras con tarjeta como deuda previa y cuentas solo desde su mes de apertura; un usuario nuevo ve S/ 0 en los meses anteriores a su registro.

## Problema

- El Resumen no le dice nada al usuario. Muestra "Capital disponible – S/ 294.70", una cifra que suma tarjetas
  de crédito y cuentas archivadas, y un "Balance del ciclo" (ingresos − gastos) que ignora el saldo con el que
  la persona empezó el mes.
- El onboarding solo pide el sueldo y un saldo actual (que crea una única cuenta "Efectivo"). No pregunta por
  cuentas de banco, tarjetas de crédito ni préstamos, así que la app nace con una foto incompleta de las
  finanzas.
- Hoy la app crea sola los movimientos recurrentes. El usuario ve gastos e ingresos que nunca registró, y la
  cifra de dinero deja de coincidir con su realidad.
- La interfaz ("terminal de control", etiquetas en mayúsculas monoespaciadas, cuadrícula de 4 indicadores) se
  siente pesada para una app de finanzas personales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver cuánto dinero tengo este mes (Priority: P1)

Al abrir el Resumen, la persona ve una sola cifra grande: su **Balance del mes**, con la frase "Entró S/ X ·
Salió S/ Y" debajo. El balance es el dinero gastable (cuentas de débito y efectivo) con el que arrancó el mes,
más lo que registró como ingreso, menos lo que gastó, menos lo que pasó a ahorros (más lo que sacó de ellos). Las tarjetas de crédito, los ahorros y las deudas no
inflan ni distorsionan esa cifra.

**Why this priority**: Es el problema de fondo. Sin una cifra confiable, el resto (onboarding, recordatorios,
rediseño) no tiene sentido. Es la capacidad nueva de mayor valor y se puede probar con datos de cuentas ya
existentes.

**Independent Test**: Preparar un usuario con saldo de arranque S/ 1,000 (débito + efectivo), registrar un
ingreso de S/ 500 y un gasto de S/ 300 en efectivo: el Resumen muestra "Balance del mes S/ 1,200" y
"Entró S/ 500 · Salió S/ 300". Repetir con una compra con tarjeta de S/ 100: el balance baja a S/ 1,100 en ese
momento; luego pagar la tarjeta con débito: el balance sigue en S/ 1,100.

**Acceptance Scenarios**:

1. **Given** saldo de arranque S/ 1,000, **When** el usuario registra un ingreso S/ 500 y un gasto S/ 300 en
   efectivo, **Then** el Resumen muestra Balance S/ 1,200, "Entró S/ 500 · Salió S/ 300".
2. **Given** el usuario tiene una cuenta de ahorros con S/ 2,000, **When** ve el Resumen, **Then** esos S/ 2,000
   no forman parte del Balance del mes (aparecen solo en Cuentas).
3. **Given** una compra con tarjeta de crédito de S/ 100 hecha este mes, **When** se registra, **Then** el
   Balance baja S/ 100 ese día y el gasto cuenta ese día en el 50/30/20.
4. **Given** la compra anterior, **When** el usuario paga la tarjeta con una transferencia débito→tarjeta de
   S/ 100, **Then** el Balance no cambia y el pago no cuenta como gasto ni en el 50/30/20.
5. **Given** una tarjeta que ya tenía una deuda previa de S/ 400 al registrarse, **When** ve el Resumen,
   **Then** esos S/ 400 aparecen como deuda y el Balance no los resta; **When** paga S/ 400 de esa deuda con
   débito, **Then** el Balance baja S/ 400 y "Salió" sube S/ 400 (la deuda previa solo afecta al balance
   cuando se paga).
6. **Given** el usuario paga una cuota de préstamo de S/ 250 desde su cuenta de débito, **When** ve el Resumen,
   **Then** la cuota suma a "Salió" y baja el Balance.
7. **Given** una transferencia de S/ 200 de débito a una cuenta de ahorros, **When** se registra, **Then** el
   Balance baja S/ 200, el Resumen dice "Ahorraste S/ 200" y el bloque Ahorro del 50/30/20 sube S/ 200.
8. **Given** un retiro de S/ 300 de ahorros a débito, **When** se registra, **Then** el Balance sube S/ 300,
   el Resumen dice "Sacaste S/ 300 de tus ahorros" y el ahorro neto del mes baja S/ 300.
9. **Given** un mes donde se sacó más de lo ahorrado, **When** el usuario ve el 50/30/20, **Then** el ahorro
   neto es negativo y se muestra como información ("Este mes sacaste más de lo que ahorraste"), nunca como
   error ni en color de alerta.
10. **Given** un nuevo mes, **When** el usuario abre el Resumen, **Then** el saldo de arranque es lo que quedó
    al cierre del mes anterior, y el primer mes de un usuario nuevo arranca con el saldo declarado en el
    onboarding.
11. **Given** el ingreso mensual declarado S/ 3,000 sin ningún ingreso registrado, **When** ve el Resumen,
    **Then** "Entró" es S/ 0 (el ingreso declarado solo sirve de base del 50/30/20) hasta que lo registre.

---

### User Story 2 - Contar mi situación real al empezar: cuentas, tarjetas y préstamos (Priority: P1)

El onboarding pasa de pedir solo sueldo y saldo a recoger la foto completa: ingresos, dónde está el dinero,
tarjetas de crédito y préstamos. Los pasos opcionales se pueden omitir y completar después.

**Why this priority**: Alimenta de datos reales al Balance y a las secciones de Cuentas y Deudas. Sin esto, un
usuario nuevo vería un Resumen vacío o incorrecto el primer día.

**Independent Test**: Registrar un usuario nuevo y completar el onboarding con sueldo S/ 3,000, un banco con
S/ 1,500, efectivo S/ 100, una tarjeta (línea S/ 5,000, consumido S/ 800, paga el 15) y un préstamo en cuotas
(6 de 12 pagadas); el Resumen muestra Balance S/ 1,600, la tarjeta como "Usaste S/ 800 de S/ 5,000 · Pagas el
15" y el préstamo con su saldo y próxima cuota.

**Acceptance Scenarios**:

1. **Given** el paso 1 (Ingresos, obligatorio), **When** el usuario ingresa su ingreso mensual, opcionalmente
   "¿Qué día te pagan?" y "¿Ya recibiste tu sueldo de este mes?", **Then** puede continuar; sin ingreso mensual
   válido no avanza.
2. **Given** "¿Ya recibiste tu sueldo de este mes?" = Sí, **When** termina el onboarding, **Then** no se espera
   un ingreso este mes (ya está dentro del saldo) y no aparece en "Por registrar".
3. **Given** la misma pregunta = No y un día de pago definido, **When** termina el onboarding, **Then** el
   sueldo aparece en "Por registrar" para ese día.
4. **Given** el paso 2 ("¿Dónde tienes tu dinero?"), **When** se muestra, **Then** existe siempre un campo
   fijo "Efectivo" (cuenta creada aunque quede en S/ 0) más una lista de cuentas de banco (débito o ahorros)
   con nombre y saldo actual, y un botón "+ Agregar cuenta"; el paso es obligatorio pero siempre se puede
   continuar (Efectivo cumple el mínimo); un botón "Solo uso efectivo" declara que no usa cuentas de banco.
5. **Given** el paso 3 ("¿Tienes tarjetas de crédito?", opcional), **When** el usuario agrega una tarjeta,
   **Then** debe indicar nombre y línea de crédito (obligatoria) y puede indicar lo consumido hasta hoy, día de
   cierre y día de pago; sin línea de crédito no puede guardar la tarjeta. Se muestra "Usaste S/ X de S/ Y ·
   Pagas el 15".
6. **Given** el paso 4 ("¿Tienes préstamos?", opcional), **When** el usuario agrega uno y activa "¿Pagas en
   cuotas?", **Then** se piden monto, cuota, cuotas totales, cuotas ya pagadas y día de pago; **When** lo deja
   desactivado, **Then** se pide solo el saldo pendiente (deuda informal).
7. **Given** cualquier paso opcional, **When** el usuario pulsa "Omitir", **Then** avanza sin crear datos y ese
   tema queda pendiente en el checklist de configuración.
8. **Given** un onboarding interrumpido, **When** el usuario vuelve a abrir la app, **Then** retoma en el paso
   donde quedó, sin duplicar cuentas, tarjetas ni préstamos ya guardados.
9. **Given** el usuario termina los pasos nuevos, **When** continúa, **Then** siguen los pasos actuales de
   distribución 50/30/20 y categorías sin cambios funcionales.
10. **Given** el pago de una cuota o un abono a un préstamo, **When** el usuario lo registra, **Then** se le
    pide la cuenta de origen (por defecto su cuenta principal) y el movimiento resultante queda asociado a esa
    cuenta; el pago a capital sigue preguntando si reduce cuotas o monto y a cuánto.

---

### User Story 3 - La app me recuerda; yo registro (Priority: P2)

Ningún ingreso ni gasto aparece solo. Lo que toca este mes (recurrencias, sueldo, cuota de préstamo, pago de
tarjeta) aparece en una lista **"Por registrar"** del Resumen con un botón **Registrar** y otro **Omitir este
mes**, y llega una notificación el día que toca.

**Why this priority**: Es un cambio de comportamiento que protege la confianza en el Balance (US1): si la app
inventa movimientos, la cifra deja de reflejar la realidad. Depende de US1 pero se prueba por separado.

**Independent Test**: Con una recurrencia mensual de S/ 80 el día 5, avanzar el reloj al día 5: no se crea
ningún movimiento; "Por registrar" muestra "Gimnasio · S/ 80 · día 5"; al pulsar Registrar se abre el
formulario prellenado y al guardar el ítem desaparece y el Balance baja S/ 80.

**Acceptance Scenarios**:

1. **Given** una regla recurrente activa, **When** llega el día del mes, **Then** no se crea ningún movimiento
   automáticamente; el ítem aparece en "Por registrar" con "nombre · monto · día".
2. **Given** un ítem de "Por registrar", **When** el usuario pulsa Registrar, **Then** se abre el formulario
   correspondiente prellenado (gasto/ingreso, pago de cuota o transferencia a la tarjeta) y al guardar el ítem
   sale de la lista.
3. **Given** un ítem, **When** el usuario pulsa Omitir este mes, **Then** sale de la lista solo por ese mes y
   reaparece el mes siguiente.
4. **Given** un ítem que pasa a "Por registrar" (según la ventana de FR-015),
   **When** la app evalúa recordatorios, **Then** emite una notificación por el sistema existente, una sola vez por ítem y mes, respetando las preferencias de notificación del usuario.
5. **Given** un sueldo con día de pago definido (y no marcado como ya recibido este mes), **When** llega el
   mes/día, **Then** aparece como ítem "Sueldo" en "Por registrar".
6. **Given** un préstamo en cuotas con día de pago, **When** faltan 3 días o menos para su día de pago, **Then** aparece "Cuota de
   [préstamo]" para el día de pago.
7. **Given** una tarjeta con día de pago y consumo pendiente, **When** faltan 3 días o menos para pagar, **Then**
   aparece "Pagar tarjeta [nombre]" con el consumo como monto sugerido.
8. **Given** movimientos recurrentes generados en meses anteriores, **When** se actualiza la app, **Then** se
   conservan intactos.

---

### User Story 4 - Un Resumen minimalista (Priority: P2)

El Resumen deja de ser un tablero. Muestra, en este orden: Balance del mes (con "Entró · Salió"), Por
registrar, Cuentas y Deudas, el 50/30/20 en una barra compacta con frases, la meta de ahorro principal y,
si aplica, la tarjeta de checklist. Los datos se leen como frases, no como etiquetas técnicas.

**Why this priority**: Es la cara visible de US1–US3; entrega valor aun sin el tour ni el nuevo lenguaje
visual, pero necesita las cifras de US1.

**Independent Test**: Abrir el Resumen en un móvil de 390 px de ancho: sin hacer scroll se ven la cifra de
balance, "Entró · Salió" y el primer ítem de "Por registrar"; el orden de las secciones coincide con la
lista; no aparecen "Terminal de control", "Resumen Ejecutivo", "Rendimiento conductual" ni "Foco de Hoy".

**Acceptance Scenarios**:

1. **Given** un usuario con datos, **When** abre el Resumen, **Then** ve las secciones en el orden: Balance del
   mes, Por registrar, Cuentas y Deudas, 50/30/20, Meta de ahorro principal, Checklist (si aplica).
2. **Given** la sección Cuentas, **When** se muestra, **Then** lista cuentas de débito, efectivo y ahorros con
   su saldo; archivadas no aparecen.
3. **Given** la sección Deudas, **When** se muestra, **Then** cada tarjeta indica "Usaste S/ X de S/ Y" con su
   próxima fecha de pago, y cada préstamo su saldo y próxima cuota.
4. **Given** el 50/30/20, **When** se muestra, **Then** es una barra compacta con frases como "Te quedan
   S/ 885 para necesidades", calculada sobre el ingreso declarado × porcentaje.
5. **Given** una pantalla de escritorio, **When** se abre el Resumen, **Then** se mantiene la barra lateral, el
   contenido va en una columna centrada de unos 720 px, y Cuentas y Deudas se ven lado a lado; no hay
   cuadrícula de indicadores.
6. **Given** el Resumen, **When** se revisa, **Then** ya no contiene "Capital disponible", "Rendimiento
   conductual", "Foco de Hoy"/hábitos ni textos como "TERMINAL DE CONTROL" o "Resumen Ejecutivo" (hábitos y
   rendimiento siguen en Control & Hábitos).
7. **Given** un usuario sin tarjetas ni préstamos, **When** ve el Resumen, **Then** la sección Deudas muestra un
   estado vacío amable en lugar de ocultarse sin explicación.

---

### User Story 5 - Completar mi configuración y conocer la app (Priority: P3)

Quien omitió pasos del onboarding (o ya tenía cuenta antes de esta versión) ve una tarjeta "Completa tu
configuración · N de 4" en el Resumen y un tour guiado de 4 pasos. Ambos son repetibles desde Ajustes.

**Why this priority**: Mejora la adopción y cierra el ciclo para usuarios existentes, pero la app funciona sin
ellos.

**Independent Test**: Con un usuario que omitió tarjetas y préstamos, el Resumen muestra "Completa tu
configuración · 2 de 4"; al abrir el ítem Tarjetas se abre el paso correspondiente; al completarlo el contador
pasa a 3 de 4. Terminar el onboarding lanza el tour de 4 pasos; "Omitir" lo cierra en cualquier paso.

**Acceptance Scenarios**:

1. **Given** un usuario con pasos pendientes, **When** abre el Resumen, **Then** ve la tarjeta de checklist con
   "N de 4" (ingresos, cuentas, tarjetas, préstamos) y puede descartarla.
2. **Given** la tarjeta descartada, **When** el usuario abre Ajustes, **Then** sigue disponible "Completar
   configuración", que abre el paso que falta.
3. **Given** que el usuario no tiene tarjetas o préstamos, **When** responde que no tiene ("No tengo
   tarjetas", "No tengo préstamos" o, en cuentas, "Solo uso efectivo"), **Then** ese ítem cuenta como completo y puede llegar a 4 de 4.
4. **Given** que el usuario termina el onboarding, **When** entra al Resumen, **Then** se inicia el tour de 4
   pasos: (1) tu balance del mes, (2) tus cuentas y deudas, (3) el botón de registrar, (4) dónde completar la
   configuración; cada paso tiene "Omitir".
5. **Given** el tour terminado u omitido, **When** el usuario abre Ajustes → "Ver tutorial", **Then** el tour
   se repite.
6. **Given** un usuario con onboarding ya completo antes de esta versión, **When** abre la app por primera vez
   después de actualizar, **Then** ve el tour una sola vez y la tarjeta de checklist con lo que le falta, y no
   se le obliga a repetir el onboarding.

---

### User Story 6 - Un lenguaje visual cálido y propio (Priority: P3)

Toda la app adopta un estilo más cálido y ligero: fondo crema en claro y ciruela oscuro (no negro) en oscuro,
verde pastel como acento, tipografías redondeadas, bordes muy redondeados, sombras suaves y menos líneas
divisorias. El tema sigue al sistema por defecto, con selector en Ajustes.

**Why this priority**: Es el acabado que hace sentir liviana la app, pero no cambia qué puede hacer la persona.
Como cambia estilos globales, conviene entregarlo después de la estructura.

**Independent Test**: Abrir la app con el sistema operativo en modo claro y en modo oscuro sin haber elegido
tema: se ve cada modo con su paleta; cambiar el tema en Ajustes lo respeta tras recargar; ninguna pantalla
conserva etiquetas en mayúsculas monoespaciadas.

**Acceptance Scenarios**:

1. **Given** un usuario que nunca eligió tema, **When** abre la app, **Then** se aplica el tema del sistema
   (claro u oscuro) y lo sigue si el sistema cambia.
2. **Given** Ajustes, **When** el usuario elige Claro, Oscuro o Sistema, **Then** el tema cambia al instante y
   se mantiene tras recargar.
3. **Given** el modo claro y el oscuro, **When** se revisa el Resumen, el onboarding, el checklist y el tour,
   **Then** ambos tienen igual calidad visual y contraste legible.
4. **Given** Necesidades, Deseos y Ahorro, **When** se muestran como píldoras, **Then** cada uno usa un par
   fondo pálido / texto oscuro propio.
5. **Given** cualquier pantalla de la app, **When** se revisa, **Then** no queda tipografía monoespaciada ni
   etiquetas en mayúsculas como estilo de etiqueta; cifras y títulos usan Fredoka y el texto Figtree.
6. **Given** el copy de Ajustes, **When** se revisa, **Then** "Recibí alertas…" queda corregido a tuteo
   ("Recibe alertas…").

---

### Edge Cases

- **Compra con tarjeta + pago parcial.** El pago se aplica primero a la deuda previa de la tarjeta (más
  antigua) y después a las compras del mes. Solo el tramo que cubre deuda previa baja el Balance; el tramo que
  cubre compras ya descontadas no lo mueve.
- **Ajuste manual de saldo.** Cambia el Balance pero no cuenta en "Entró", "Salió" ni en el 50/30/20; aparece
  como "Ajuste de saldo S/ X" en una línea aparte.
- **Gasto o ingreso directo sobre una cuenta de ahorros.** El gasto cuenta en "Salió" y en el 50/30/20 sin bajar
  el Balance (reduce el ahorro neto); el ingreso cuenta en "Entró" sin subir el Balance (suma al ahorro neto).
- **Gasto de la categoría de Ahorro.** Cuenta como "Ahorraste" (sale del Balance y suma al ahorro neto), no
  como "Salió"; si se paga desde una cuenta de ahorros no genera flujos. Registrar a la vez ese gasto y una
  transferencia a ahorros duplica el aporte: es responsabilidad del usuario.
- **Cuenta creada con saldo después del primer mes.** El saldo inicial de una cuenta de débito/efectivo cuya
  apertura es posterior al mes de `balance_since` suma al Balance de su mes de apertura como "Ajuste de saldo
  S/ X"; los meses anteriores no cambian. Una cuenta de ahorros nueva no mueve el Balance por su saldo inicial.
- **Pago de tarjeta desde ahorros.** Se trata como retiro de ahorros (suma al Balance) seguido del pago
  (no lo mueve); el efecto neto es el de un retiro de ahorros que paga una deuda.
- **Mes sin movimientos.** El Balance es igual al saldo de arranque y "Entró S/ 0 · Salió S/ 0".
- **Balance negativo.** Se muestra con el signo, en tono neutro-informativo, con una frase ("Gastaste más de lo
  que tenías este mes").
- **Cuenta archivada o eliminada.** No entra al Balance ni a Cuentas; sus movimientos históricos se conservan.
- **Mes anterior consultado en el selector de mes.** Muestra el balance y "Entró/Salió" de ese mes con las
  mismas reglas; "Por registrar" solo se muestra para el mes en curso. Antes del mes de `balance_since`, las compras con tarjeta son deuda previa (sin flujos) y una cuenta solo aporta al Balance si no tiene fecha de apertura o se abrió en ese mes o antes; para un usuario nuevo, los meses anteriores a su registro muestran Balance S/ 0 y "Entró S/ 0 · Salió S/ 0". El saldo de arranque del primer mes rastreado incluye las cuentas del onboarding y por diseño puede diferir del Balance del mes anterior.
- **Día 29, 30 o 31 en meses cortos.** Un ítem cuyo día no existe en ese mes cae en el último día del mes.
- **Ítems "Por registrar" de meses anteriores.** No se acumulan: lo que no se registró ni omitió el mes
  pasado simplemente deja de listarse.
- **Registrar a mano algo que estaba en "Por registrar".** El ítem queda cubierto por vínculo estructurado en
  el mes (ver FR-019). Un movimiento sin ese vínculo no cubre el ítem. No se duplica el recordatorio.
- **Consumo mayor a la línea de crédito al registrar la tarjeta.** Se muestra un mensaje de validación y no se
  guarda hasta corregirlo.
- **Saldo negativo en una cuenta de débito/ahorros del onboarding.** Mensaje de validación; no avanza.
- **Cuotas ya pagadas = cuotas totales.** El préstamo se considera saldado y no aparece en Deudas ni genera
  recordatorios.
- **Usuario sin conexión.** Onboarding, Resumen, "Por registrar", checklist y tour funcionan sin red y
  sincronizan después; la app no se bloquea.
- **Usuario que borra datos o cambia de dispositivo.** El estado del checklist y del tour viaja con su perfil;
  no se repite el tour en un dispositivo nuevo si ya lo vio.
- **Tarjeta existente sin línea de crédito.** Se muestra "Debes S/ X" con la acción "Agregar línea de crédito";
  el recordatorio de pago y el resto de reglas de tarjeta funcionan igual.
- **Sin día de pago definido (sueldo, préstamo o tarjeta).** No se genera ítem en "Por registrar" para ese
  concepto; el usuario puede registrar a mano en cualquier momento.

## Requirements *(mandatory)*

### Functional Requirements

**Balance del mes**

- **FR-001**: El Resumen MUST mostrar como cifra principal el **Balance del mes** = saldo de arranque del mes
  + Entró − Salió − Ahorraste + Sacaste, con la frase "Entró S/ X · Salió S/ Y" debajo. "Entró" son solo los
  ingresos registrados del mes y "Salió" solo los gastos reales del mes (compras con tarjeta y cuotas de
  préstamo incluidas, y excluyendo los gastos de la categoría de Ahorro, que cuentan como "Ahorraste"); los aportes a ahorro ("Ahorraste") y los retiros de ahorro ("Sacaste") MUST NOT sumarse
  a "Salió" ni a "Entró" y se muestran en una línea aparte (FR-008). Un ajuste manual de saldo (spec 006) MUST
  sumar o restar su diferencia al Balance sin contar en "Entró", "Salió" ni en el 50/30/20, y se muestra aparte
  como "Ajuste de saldo S/ X" cuando existe en el mes.
- **FR-002**: El saldo de arranque del primer mes de un usuario nuevo MUST ser el saldo declarado en el
  onboarding (efectivo + cuentas de débito); el de cada mes siguiente MUST ser el balance al cierre del mes
  anterior.
- **FR-003**: El Balance MUST considerar solo dinero gastable: cuentas de débito y efectivo. Las cuentas de
  ahorro MUST NOT entrar en el Balance. Un gasto pagado desde una cuenta de ahorros MUST contar en "Salió" y en
  el 50/30/20 pero no bajar el Balance, y MUST reducir el ahorro neto; un ingreso depositado en una cuenta de
  ahorros MUST contar en "Entró" pero no subir el Balance, y MUST sumar al ahorro neto. Es decir, el Balance
  solo se mueve por movimientos sobre débito/efectivo y por compras con tarjeta.
- **FR-004**: Una compra con tarjeta de crédito del mes MUST restar del Balance el día de la compra y MUST
  contar ese día en el 50/30/20.
- **FR-005**: Pagar una tarjeta (transferencia de débito/efectivo a la tarjeta) MUST NOT contar como ingreso
  ni como gasto en el 50/30/20, y MUST NOT mover el Balance, salvo el tramo que cubre deuda previa (FR-006),
  que MUST sumar a "Salió" y bajar el Balance.
- **FR-006**: La deuda de tarjeta existente al registrarse (o anterior al mes en que se actualiza a esta versión) MUST mostrarse
  aparte como deuda y MUST afectar al Balance solo cuando se paga; los pagos se aplican primero a esa deuda
  previa.
- **FR-007**: Una cuota de préstamo pagada MUST contar como salida del mes y bajar el Balance.
- **FR-008**: Una transferencia a una cuenta de ahorros MUST salir del Balance, mostrarse en una línea aparte
  de "Entró · Salió" como "Ahorraste S/ X" (sin contar en "Salió") y sumar al bloque Ahorro del 50/30/20. Un
  retiro de ahorros a débito/efectivo MUST sumar al Balance, mostrarse en esa línea aparte como "Sacaste S/ X de
  tus ahorros" (sin contar en "Entró") y restar del Ahorro. Un gasto de la categoría de Ahorro pagado desde
  débito/efectivo/tarjeta MUST tratarse como aporte (mismo efecto que una transferencia a ahorros); si se paga
  desde una cuenta de ahorros no genera flujos.
- **FR-009**: El 50/30/20 MUST mostrar el ahorro **neto** del mes (aportes − retiros), que puede ser negativo, y
  MUST presentarlo como información ("Este mes sacaste más de lo que ahorraste"), no como error.
- **FR-010**: El ingreso mensual declarado MUST seguir siendo la base del 50/30/20 (ingreso × porcentaje) y
  MUST NOT contar como ingreso del Balance hasta que el usuario lo registre como movimiento.
- **FR-011**: El Resumen MUST NOT mostrar el "Capital disponible".
- **FR-012**: Los cálculos del Balance, Entró, Salió, ahorro neto y deuda de tarjeta MUST vivir en funciones
  puras con pruebas unitarias, sin lógica en los componentes (Principio III).
- **FR-013**: Todos los importes MUST manejarse en céntimos enteros y mostrarse en PEN (Principio VIII).

**Regla "nada se registra solo"**

- **FR-014**: El sistema MUST NOT crear ningún ingreso ni gasto sin una acción explícita del usuario; esto
  reemplaza la generación automática de movimientos recurrentes.
- **FR-015**: El Resumen MUST mostrar una lista **"Por registrar"** del mes en curso con: recurrencias activas,
  sueldo (si hay día de pago definido y no está marcado como recibido), cuota de préstamo (desde 3 días
  antes de su día de pago) y pago de tarjeta (desde 3 días antes del día de pago), cada uno con "nombre ·
  monto · día".
- **FR-016**: Cada ítem MUST ofrecer **Registrar** (abre el formulario correspondiente prellenado) y **Omitir
  este mes** (lo oculta solo durante ese mes).
- **FR-017**: Cada ítem MUST generar una notificación cuando pasa a "Por registrar" (según la ventana de FR-015), por el sistema de `Notification` existente (Principio XI), una sola
  vez por ítem y mes, respetando las preferencias del usuario.
- **FR-018**: Los movimientos recurrentes ya generados en meses anteriores MUST conservarse sin cambios.
- **FR-019**: Registrar un ítem MUST removerlo de la lista y reflejarse de inmediato en el Balance. Un ítem
  también MUST darse por cubierto si el usuario registra a mano, en ese mes, un movimiento con su vínculo
  estructurado: sueldo = ingreso con esa fuente de ingreso; recurrencia = movimiento de esa regla; cuota = pago
  de cuota de ese préstamo; tarjeta = transferencia hacia esa tarjeta (sin importar monto ni texto).
- **FR-020**: Los pagos de cuota y los abonos a préstamo MUST pedir una cuenta de origen (por defecto la cuenta
  principal del usuario) y MUST crear su movimiento asociado a esa cuenta; el pago a capital MUST seguir
  preguntando si reduce cuotas o monto y a cuánto.

**Onboarding ampliado**

- **FR-021**: El onboarding MUST tener los pasos: (1) Ingresos [obligatorio], (2) "¿Dónde tienes tu dinero?"
  [obligatorio], (3) "¿Tienes tarjetas de crédito?" [opcional], (4) "¿Tienes préstamos?" [opcional],
  (5) distribución 50/30/20 y (6) categorías (estos dos sin cambios funcionales). Los opcionales MUST ofrecer
  "Omitir".
- **FR-022**: El paso 1 MUST pedir ingreso mensual (obligatorio), "¿Qué día te pagan?" (opcional) y "¿Ya
  recibiste tu sueldo de este mes?"; si la respuesta es Sí, el sueldo de este mes MUST NOT esperarse ni listarse
  en "Por registrar".
- **FR-023**: El paso 2 MUST incluir siempre la cuenta "Efectivo" (existente aunque su saldo sea S/ 0) y
  permitir agregar cuentas de banco (débito o ahorros) con nombre y saldo actual, con saldos no negativos; MUST ofrecer además "Solo uso efectivo" (FR-028) para quien no usa cuentas de banco.
- **FR-024**: El paso 3 MUST pedir por tarjeta: nombre, línea de crédito (obligatoria), consumido hasta hoy,
  día de cierre (opcional) y día de pago (opcional), y MUST mostrar "Usaste S/ X de S/ Y · Pagas el [día]".
  El consumo no puede superar la línea. La línea de crédito es obligatoria solo para tarjetas creadas desde
  esta versión; las tarjetas existentes sin línea MUST seguir funcionando (ver FR-035).
- **FR-025**: El paso 4 MUST pedir entidad o persona y un interruptor "¿Pagas en cuotas?". Con cuotas: monto,
  cuota, cuotas totales, cuotas ya pagadas y día de pago (préstamo en cuotas). Sin cuotas: saldo pendiente
  (deuda informal que debes). Las cuotas ya pagadas MUST reducir las pendientes sin crear movimientos.
- **FR-026**: El onboarding MUST poder retomarse tras una interrupción sin duplicar datos ya guardados.
- **FR-027**: Solo PEN; las tarjetas en USD y la multimoneda quedan fuera de alcance.

**Checklist y tutorial**

- **FR-028**: El Resumen MUST mostrar una tarjeta descartable "Completa tu configuración · N de 4" (ingresos,
  cuentas, tarjetas, préstamos). Un ítem cuenta como completo cuando el usuario tiene ese dato registrado o
  declaró explícitamente que no aplica ("Solo uso efectivo", "No tengo tarjetas" o "No tengo préstamos").
- **FR-029**: Ajustes MUST incluir una entrada permanente "Completar configuración" que abre el paso pendiente
  correspondiente, aunque la tarjeta se haya descartado.
- **FR-030**: Al terminar el onboarding MUST iniciarse un tour guiado de 4 pasos: (1) tu balance del mes,
  (2) tus cuentas y deudas, (3) el botón de registrar, (4) dónde completar la configuración; cada paso con
  "Omitir"; implementado a mano, sin librería de tours.
- **FR-031**: Ajustes MUST incluir "Ver tutorial" para repetir el tour en cualquier momento.
- **FR-032**: Usuarios con onboarding completo antes de esta versión MUST ver el tour una sola vez y la tarjeta
  de checklist con lo pendiente, sin repetir el onboarding.
- **FR-033**: El estado del checklist (descartada, ítems declarados "no aplica") y del tour (visto) MUST
  persistir con el perfil y sincronizarse entre dispositivos.

**Resumen minimalista**

- **FR-034**: El Resumen MUST presentar, en este orden: Balance del mes; Por registrar; Cuentas y Deudas;
  50/30/20 en barra compacta con frases; meta de ahorro principal; tarjeta de checklist (si aplica). En móvil se admiten además, tras la sección 6, los accesos de navegación a Espacio compartido y Mi progreso, que no son secciones.
- **FR-035**: Cuentas MUST listar débito, efectivo y ahorros con su saldo (sin archivadas). Deudas MUST listar
  tarjetas ("Usaste S/ X de S/ Y" y próxima fecha de pago) y préstamos (saldo y próxima cuota). Una tarjeta
  existente sin línea de crédito MUST mostrarse como "Debes S/ X" (sin "de S/ Y") con la acción "Agregar línea
  de crédito"; no se le pide al usuario completar nada al actualizar.
- **FR-036**: El Resumen MUST NOT incluir "Rendimiento conductual", "Foco de Hoy"/hábitos, ni los textos
  "Terminal de control" y "Resumen Ejecutivo"; esos contenidos siguen en Control & Hábitos.
- **FR-037**: El Resumen MUST ser mobile-first. En escritorio MUST conservar la barra lateral, centrar el
  contenido en una columna de unos 720 px y mostrar Cuentas y Deudas lado a lado, sin cuadrícula de
  indicadores.
- **FR-038**: Los datos del Resumen MUST expresarse como frases ("Te quedan S/ 885 para necesidades") y el
  botón "+" central MUST ser la única acción primaria destacada (los "Registrar" de la lista son secundarios).

**Lenguaje visual**

- **FR-039**: Los tokens globales (paleta, tipografías, radios, sombras) MUST actualizarse para que toda la app
  herede el estilo: fondo crema en claro y ciruela oscuro (no negro) en oscuro, texto ciruela, verde pastel
  como acento propio de ez-life (sin copiar el coral ni la identidad de la referencia https://huecazo.com/),
  píldoras de Necesidades/Deseos/Ahorro con pares fondo pálido / texto oscuro.
- **FR-040**: La tipografía MUST ser Fredoka (cifras y títulos) y Figtree (texto), cargadas de forma local;
  MUST retirarse JetBrains Mono y las etiquetas en mayúsculas monoespaciadas de toda la app.
- **FR-041**: Tarjetas MUST tener esquinas de unos 28 px, botones forma de píldora, sombras cálidas suaves, sin
  líneas divisorias duras y con microanimaciones cortas (respetando "reducir movimiento").
- **FR-042**: Modo claro y oscuro MUST tener el mismo nivel de calidad; el tema por defecto MUST seguir al
  sistema (hoy forzado a oscuro) y Ajustes MUST ofrecer un selector Claro / Oscuro / Sistema.
- **FR-043**: Esta spec MUST reestructurar únicamente Resumen, onboarding, checklist y tour; las demás
  pantallas solo heredan los tokens (su reestructura es la spec 014).
- **FR-044**: Se MUST mantener lo ya establecido de accesibilidad: controles táctiles de 44 px, foco visible y
  movimiento reducido en ambos temas.

**Copy**

- **FR-045**: Todo texto nuevo MUST estar en español latinoamericano neutro con tuteo (sin voseo), y el copy de
  Ajustes "Recibí alertas…" MUST corregirse; la prueba de voseo existente MUST seguir pasando.

**Datos y sincronización**

- **FR-046**: Todo dato nuevo (línea de crédito, día de cierre y de pago de tarjeta, día de pago del ingreso,
  estado del checklist y del tour, omisiones de "Por registrar") MUST guardarse primero en el dispositivo
  (offline-first) y sincronizarse después; toda tabla nueva MUST tener seguridad por propietario.
- **FR-047**: Los campos nuevos MUST estar disponibles en el servidor antes de que cualquier cliente intente
  sincronizarlos (el servidor rechaza campos desconocidos); los cambios de esquema remoto se aplican solo con
  migraciones y confirmación explícita del dueño del proyecto.
- **FR-048**: Todo lo anterior MUST funcionar sin conexión y no bloquear ni degradar la app al estar offline
  (Principio XII).

### Key Entities *(include if feature involves data)*

- **Cuenta de pago (existente, ampliada)**: débito, efectivo, ahorros o crédito, con saldo inicial. Las
  tarjetas de crédito ganan línea de crédito, día de cierre y día de pago. "Efectivo" existe siempre.
- **Movimiento (existente)**: ingreso, gasto o transferencia entre cuentas propias; ahora cada pago de cuota o
  abono a préstamo guarda su cuenta de origen.
- **Préstamo en cuotas y pago de cuota (existentes)**: se crean desde el onboarding con cuotas ya pagadas y día
  de pago; el pago a capital conserva su pregunta cuotas/monto.
- **Deuda informal que debes (existente, `borrowed`)**: saldo pendiente sin cuotas, creada desde el onboarding.
- **Fuente de ingreso (existente, ampliada)**: gana el día de pago y la marca de "ya recibido este mes".
- **Recordatorio "Por registrar" (derivado)**: ítem calculado para el mes (recurrencia, sueldo, cuota, pago de
  tarjeta) con estado pendiente / registrado / omitido; reutiliza el sistema de `Notification`.
- **Perfil (existente, ampliado)**: guarda el progreso del onboarding ampliado, el estado del checklist
  (descartado, ítems "no aplica") y si el tour ya se vio.
- **Balance del mes (derivado, no persistido)**: saldo de arranque + entró − salió − ahorraste + sacaste, más
  ahorro neto y deuda de tarjeta, calculado a partir de las cuentas y movimientos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En un conjunto de al menos 12 escenarios de referencia (ingreso, gasto, compra con tarjeta, pago
  de tarjeta, deuda previa, cuota de préstamo, ahorro, retiro de ahorros, mes nuevo, mes vacío, cuenta
  archivada, balance negativo), el Balance, "Entró" y "Salió" coinciden con el resultado esperado en el 100%.
- **SC-002**: Una persona nueva completa el onboarding con una cuenta de banco, una tarjeta y un préstamo en
  menos de 5 minutos, y en menos de 2 minutos si omite los pasos opcionales.
- **SC-003**: Una persona entiende "cuánto dinero tengo este mes" en menos de 5 segundos: en un móvil de 390 px
  de ancho, el Balance, "Entró · Salió" y el primer ítem de "Por registrar" son visibles sin hacer scroll.
- **SC-004**: En una simulación de 3 meses sin acciones del usuario se crean 0 movimientos automáticos; todo
  recordatorio genera exactamente 1 notificación por ítem y mes.
- **SC-005**: El 100% de las personas con onboarding ya completo ven el tour exactamente una vez y la tarjeta
  de checklist con lo pendiente, sin pasar de nuevo por el onboarding.
- **SC-006**: Ninguna pantalla de la app conserva tipografía monoespaciada, etiquetas en mayúsculas de estilo
  "terminal" ni formas de voseo; las pruebas automáticas de voseo y las nuevas pruebas de la spec pasan.
- **SC-007**: En modo claro y oscuro el texto cumple contraste legible (AA) en Resumen, onboarding, checklist y
  tour; sin elegir tema, la app muestra el del sistema operativo.
- **SC-008**: Todos los flujos nuevos (onboarding, registrar desde "Por registrar", checklist, tour) funcionan
  sin conexión y, al reconectar, sus datos sincronizan sin errores ni pérdidas.
- **SC-009**: El Resumen contiene exactamente las seis secciones definidas, en orden, y 0 de los contenidos
  retirados (capital disponible, rendimiento conductual, foco de hoy, cuadrícula de indicadores); en móvil se admiten además, tras la sección 6, los accesos de navegación a Espacio compartido y Mi progreso, que no son secciones.

## Assumptions

- **Posición de la deuda de tarjeta previa.** Para usuarios que ya tenían la app, el saldo adeudado de sus
  tarjetas **al inicio del mes en que actualizan** se trata como deuda previa (coincide con `balance_since` y con el saldo de arranque del mes); las compras hechas desde ese mes, incluso las anteriores al día de la actualización, siguen las reglas de FR-004 a FR-006.
- **Saldo de arranque de usuarios existentes.** El del mes en curso es la suma de saldos de sus cuentas de
  débito y efectivo al inicio del mes; no se les pide declarar nada.
- **Movimientos anteriores al registro.** En el primer mes de un usuario nuevo, los movimientos con fecha
  anterior al día del registro se conservan en el historial pero no alteran el Balance (el saldo declarado ya
  los refleja); así se evita contarlos dos veces.
- **Pagos a tarjeta.** Se aplican primero a la deuda previa (la más antigua) y luego a compras del mes.
- **Cuenta principal.** Es la cuenta de débito activa más antigua (por fecha de creación) y, si no hay,
  "Efectivo". Es solo el valor por defecto del selector de cuenta de origen; el usuario elige otra en cada
  pago. No existe un campo para marcarla.
- **Recordatorio de pago de tarjeta.** Su ventana de aparición es la de FR-015; el monto sugerido es el
  consumo actual; si no hay día de pago ni consumo, no hay recordatorio.
- **Visibilidad de "Por registrar".** Muestra los ítems pendientes del mes en curso ordenados por día,
  destacando los vencidos; se muestran los 3 primeros y, con más de 3, un "Ver todos (N)" que expande la lista en el mismo lugar.
- **Ítems vencidos de meses anteriores.** No se arrastran al mes siguiente.
- **Préstamos en cuotas del onboarding.** El saldo mostrado se deriva de las cuotas restantes con la lógica de
  saldo que ya existe; las cuotas ya pagadas no generan movimientos.
- **Ocultar importes.** El control actual de ocultar cifras se conserva sobre el Balance del mes.
- **Mi Progreso.** El bloque de logros sale del Resumen pero sigue accesible desde la navegación existente (la
  función de logros de la spec 009 no cambia).
- **"Capital disponible" en Finanzas.** Esta spec solo lo retira del Resumen; su indicador dentro de Finanzas se
  revisa en la spec 014.
- **Preferencia de tema previa.** Quien eligió explícitamente un tema lo conserva; quien nunca eligió pasa a
  seguir al sistema.
- **Fuera de alcance.** Spec 014 (estructura minimalista en Finanzas, Control & Hábitos, Espacio Compartido,
  Mi Progreso y Ajustes), préstamos que el usuario otorgó ("me deben") en el onboarding, multimoneda / tarjetas
  en USD e importación de movimientos bancarios.
- **Dependencias.** Usa lo ya existente: cuentas de pago y transferencias (spec 011), préstamos en cuotas y
  deudas informales, onboarding y su progreso en el perfil, y el sistema único de `Notification`.
- **Despliegue de datos.** Los cambios de esquema en el servidor compartido (`ez_life`) se aplican solo con
  migraciones y `supabase db push`, antes de publicar el cliente que los usa y tras correr la auditoría de la
  flota (`mvp-lab-infra/audit/fleet-auth-audit.sql`), con confirmación explícita del usuario.

## Qué cambia respecto a las specs 009, 010, 011 y 012

**Spec 009 (minimalismo y progreso).** Su intención (superficies sobrias, menos ruido, Resumen con balance primero)
se conserva y esta spec la lleva más lejos. Cambia: salvia/crema, Plus Jakarta Sans y Fraunces se reemplazan por
la nueva paleta (crema/ciruela con verde pastel) y por Fredoka + Figtree; el bloque "Mi progreso" sale del
Resumen. Se mantiene: los controles de 44 px, foco visible y movimiento reducido; los seis logros y su lógica.

**Spec 010 (rediseño Obsidian).** Se supera su lenguaje visual: grafito/esmeralda, bordes hairline, radios de
4/8/12 px, Geist + JetBrains Mono, y "oscuro por defecto". Se supera también el diseño de "Inicio" (balance del
ciclo, acciones rápidas, presupuesto, Foco de Hoy, KPIs de escritorio, transacciones recientes, tarjeta de
espacio compartido, tasa de ahorro). Se mantiene: la navegación (rutas, barra lateral, botón central "+",
paleta ⌘K) y las demás pantallas, que solo heredan los nuevos tokens hasta la spec 014.

**Spec 011 (cuentas, hora, prioridad).** Se conservan cuentas, transferencias, hora del movimiento y prioridad
de tareas. Cambian dos cláusulas: (a) las recurrencias ya no "se generan a las 12:00"; ahora aparecen en "Por
registrar" y el usuario las registra; (b) las transferencias a/desde cuentas de ahorro, que 011 excluía del
50/30/20, ahora alimentan el ahorro neto del mes (las demás transferencias siguen sin contar como ingreso ni
gasto).

**Spec 012 (pulido del onboarding).** Se amplía el onboarding de 3 a 6 pasos; el "saldo actual" del primer paso
pasa a ser el paso "¿Dónde tienes tu dinero?", y el copy sigue en tuteo neutro.
