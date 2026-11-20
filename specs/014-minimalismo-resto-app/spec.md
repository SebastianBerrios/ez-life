# Feature Specification: Minimalismo en el resto de la app

**Feature Branch**: `014-minimalismo-resto-app` (la rama no se creó: no hay hook `before_specify` registrado)

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Minimalismo en el resto de la app: Finanzas, Control & Hábitos, Espacio Compartido, Mi Progreso, Ajustes y formularios"

Constitución aplicable: v2.1.0. Spec estrictamente de presentación: cero cambios de reglas de negocio, modelo de datos,
migraciones o sincronización (Principios V y XII). Sin dependencias runtime nuevas (Principios I y VII). Toda lógica de
formato de frases vive fuera de las vistas en funciones puras verificables (Principio III). Dinero en céntimos enteros,
solo PEN (Principio VIII). Copy en español latinoamericano neutro con tuteo y sin voseo (Principio VI).

## Problema

La spec 013 actualizó los tokens visuales globales (paleta cálida crema en claro y ciruela oscuro en oscuro, acento
verde pastel, tipografías Fredoka y Figtree, radios grandes, sombras cálidas y tema que sigue al sistema) y
reestructuró el Resumen, el onboarding, el checklist y el tour. Sin embargo, el resto de las pantallas solo heredó
colores y tipografías, manteniendo la estructura densa del rediseño "obsidian" (spec 010): etiquetas en mayúsculas
monoespaciadas, tablas, cuadrículas de 4 indicadores y líneas divisorias duras.

Como resultado, al salir del Resumen la app se siente visualmente dividida y pesada: las pantallas muestran muchas
cifras y etiquetas sueltas sin decir nada de un vistazo ni destacar una acción principal clara.

## Clarifications

### Session 2026-11-20

- Q: ¿Qué cifra exacta debe mostrarse como dato protagonista en cada una de las tres pestañas de Finanzas (Movimientos, Regla 50/30/20 y Préstamos)? → A: Movimientos muestra el balance neto del periodo (ingresos − egresos); Regla 50/30/20 muestra el porcentaje gastado del ingreso mensual; Préstamos muestra el total que debes (préstamos en cuotas + tarjetas + deudas por pagar, con lo que te deben en bloque secundario aparte).
- Q: Cuando abres un formulario para editar un registro que ya tiene campos avanzados con valor, ¿cómo debe mostrarse inicialmente el bloque "Más opciones"? → A: Plegado por defecto, mostrando un indicador con la cantidad de campos avanzados con valor (por ejemplo, "Más opciones · 2 activas").
- Q: En la pantalla Control y Hábitos, debajo del puntaje de hábitos y "Foco de Hoy", ¿cómo deben organizarse Hábitos, Tareas y Metas? → A: Selector segmentado (pestañas: Hábitos / Tareas / Metas) debajo de "Foco de Hoy", mostrando una lista a la vez y la analítica plegada debajo.
- Q: ¿Cómo deben comportarse inicialmente y al interactuar las cinco secciones colapsables de Ajustes (Perfil, Cuentas e ingresos, Notificaciones, Apariencia, Datos y exportación)? → A: Todas inician plegadas por defecto (salvo navegación directa a una sección concreta) y pueden mantenerse varias abiertas a la vez.
- Q: Al diseñar la app con sensación de app nativa (PWA) dentro de esta spec, ¿el alcance se limita a la ergonomía y presentación móvil, o también incluye ajustes de configuración PWA del sistema? → A: Ergonomía y presentación tipo app nativa (zonas seguras de notch/barra de gestos, alcance del pulgar, sin solapamiento con teclado) más coherencia visual de la barra de estado del sistema en modo claro y oscuro, sin cambios al service worker ni flujos de instalación.
- Q: En tablets (pantallas intermedias entre celular y computadora), ¿cómo debe adaptarse la navegación principal y la disposición del contenido? → A: En tablet vertical usa barra inferior fija (como en celular) con contenido centrado hasta ~720 px; en tablet horizontal y computadora pasa a barra lateral + columna centrada de ~720 px.
- Q: Para lograr la sensación de app nativa en el celular sin perder comodidad en pantallas grandes, ¿cómo deben presentarse los formularios (registro rápido, movimiento, transferencia, cuentas, préstamos y deudas) en celular frente a tablet y computadora? → A: En celular se abren como hojas desde abajo (bottom sheets) con el botón de guardar fijo al alcance del pulgar; en tablet y computadora se muestran como diálogo centrado con el mismo contenido.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegación ligera y lenguaje visual unificado en toda la app (Priority: P1)

Al moverse por la app —desde el inicio de sesión, las pantallas de carga o error, la barra lateral en escritorio y la
barra inferior en móvil—, la persona percibe un solo lenguaje visual cálido y limpio, coherente con el Resumen de la
spec 013. Las etiquetas de navegación usan formato de oración, la única acción destacada es "Nuevo registro" y no
quedan rastros del estilo "terminal" (etiquetas en mayúsculas monoespaciadas, líneas divisorias duras ni cuadrículas
de 4 indicadores).

**Why this priority**: Unifica el marco común de toda la aplicación y actualiza los elementos visuales compartidos una
sola vez antes de aplicarlos a cada pantalla. Elimina de inmediato la sensación de app "a medio rediseñar".

**Independent Test**: Recorrer toda la app en móvil (360 px) y escritorio, en modo claro y oscuro, incluyendo inicio
de sesión y estados de carga/error: la navegación usa etiquetas en formato de oración, "Nuevo registro" es el único
botón destacado, el contenido en escritorio se centra en una columna de ~720 px junto a la barra lateral y ninguna
pantalla conserva etiquetas en mayúsculas monoespaciadas ni cuadrículas de 4 indicadores.

**Acceptance Scenarios**:

1. **Given** la barra lateral en escritorio y la barra inferior en móvil, **When** el usuario navega entre pantallas,
   **Then** todas las etiquetas aparecen en formato de oración (por ejemplo, "Resumen", "Finanzas", "Control y
   hábitos"), con menos peso visual y sin mayúsculas sostenidas.
2. **Given** la navegación principal en móvil o escritorio, **When** el usuario observa las acciones disponibles,
   **Then** "Nuevo registro" es el único botón visualmente destacado como acción primaria.
3. **Given** una pantalla de tablet o computadora, **When** el usuario abre cualquier sección principal, **Then** en
   tablet vertical ve la barra inferior fija con el contenido centrado hasta ~720 px, y en tablet horizontal o
   computadora ve la barra lateral junto a la columna centrada de aproximadamente 720 px, sin cuadrículas de 4
   indicadores.
4. **Given** las pantallas de inicio de sesión, carga y error, **When** se muestran en modo claro o modo oscuro,
   **Then** emplean la misma paleta cálida, tarjetas redondeadas, botones en píldora y tono cercano que el resto de la
   app.
5. **Given** cualquier pantalla de la app en modo claro u oscuro, **When** se inspecciona su accesibilidad y estilo,
   **Then** cumple contraste legible (AA) incluso en píldoras pastel, ofrece foco visible, controles táctiles de al
   menos 44 px y respeta la preferencia de movimiento reducido.

---

### User Story 2 - Finanzas claras de un vistazo (Priority: P1)

Al entrar a Finanzas, la persona deja de ver una cuadrícula de indicadores y tablas densas. Cada una de sus tres
pestañas (Movimientos, Regla 50/30/20 y Préstamos) presenta un único dato protagonista grande, una acción principal
clara y el detalle expresado en frases cortas y tarjetas redondeadas, reutilizando los datos de cuentas, tarjetas y
préstamos de la spec 013.

**Why this priority**: Finanzas es la pantalla de consulta diaria más usada después del Resumen y hoy concentra la
mayor densidad visual de la app (indicadores, tablas y tres vistas internas).

**Independent Test**: Abrir Finanzas con movimientos, presupuesto 50/30/20, cuentas/tarjetas y préstamos cargados (y
también con datos vacíos): cada pestaña muestra un dato protagonista grande y frases legibles ("Llevas S/ 130.00 de
S/ 630.00 en deseos", "Te faltan 8 cuotas · próxima el 15"), sin tablas ni cuadrículas de KPIs, y los estados vacíos
ofrecen una acción directa.

**Acceptance Scenarios**:

1. **Given** la pestaña Movimientos con registros del mes, **When** el usuario la abre, **Then** ve un único dato
   protagonista arriba (balance neto del periodo filtrado: ingresos − egresos) y la lista de movimientos agrupada por
   día, presentada con frases claras y píldoras de color en lugar de una tabla con bordes duros.
2. **Given** la pestaña Regla 50/30/20, **When** el usuario la abre, **Then** ve como dato protagonista el porcentaje
   gastado del ingreso mensual y cada bloque (Necesidades, Deseos, Ahorro) explicado en una frase corta (por ejemplo,
   "Llevas S/ 130.00 de S/ 630.00 en deseos") con su píldora de color pastel y sin etiquetas técnicas sueltas.
3. **Given** la pestaña Préstamos con préstamos en cuotas, deudas informales y tarjetas de crédito, **When** el usuario
   la abre, **Then** ve como dato protagonista el total que debe (préstamos en cuotas + tarjetas + deudas por pagar,
   dejando lo que le deben en un bloque secundario aparte) y cada obligación como una tarjeta redondeada con una frase
   de estado clara (por ejemplo, "Te faltan 8 cuotas · próxima el 15") reutilizando los datos de la spec 013.
4. **Given** cualquiera de las pestañas de Finanzas sin registros, **When** el usuario la abre, **Then** ve un estado
   vacío amable y accionable (por ejemplo, "Aún no tienes préstamos · Agregar") que abre el flujo correspondiente.
5. **Given** las acciones existentes de Finanzas (filtrar, registrar movimiento, registrar pago de cuota o saldar deuda,
   gestionar cuentas), **When** el usuario las ejecuta, **Then** todas producen exactamente el mismo resultado funcional
   que antes del rediseño.

---

### User Story 3 - Formularios y hojas enfocados en lo esencial (Priority: P1)

Cuando la persona registra un movimiento, una transferencia, una cuenta, un préstamo o una deuda —desde la hoja de
registro rápido o desde sus formularios dedicados—, ve primero únicamente los campos esenciales (como monto, cuenta y
categoría) y puede desplegar los campos avanzados u opcionales mediante "Más opciones".

**Why this priority**: Registrar ingresos, gastos y transferencias es la interacción más frecuente de la app. Reducir
la carga visual de los formularios hace que el registro diario sea rápido y sin fricción.

**Independent Test**: Abrir la hoja de registro rápido y los formularios de movimiento, transferencia, cuenta, préstamo
y deuda: inicialmente solo se muestran los campos esenciales; completar y guardar con valores por defecto funciona sin
abrir "Más opciones"; al pulsar "Más opciones" aparecen los campos avanzados y sus valores se guardan correctamente.

**Acceptance Scenarios**:

1. **Given** la hoja de registro rápido o cualquiera de los formularios rediseñados (movimiento, transferencia, cuenta,
   préstamo o deuda), **When** se abre, **Then** en celular se presenta como hoja desde abajo con el botón de guardar
   fijo al alcance del pulgar y en tablet/computadora como diálogo centrado; en ambos casos muestra en primer plano
   únicamente los campos esenciales (monto, cuenta, categoría y concepto breve según corresponda) y oculta los campos
   avanzados (como fecha personalizada, notas, etiquetas o recurrencia) detrás de un control "Más opciones".
2. **Given** el usuario completa solo los campos esenciales de un formulario, **When** guarda, **Then** el registro se
   crea con los mismos valores por defecto y reglas de validación existentes, sin necesidad de abrir "Más opciones".
3. **Given** el usuario pulsa "Más opciones" en cualquier formulario rediseñado (registro rápido, movimiento,
   transferencia, cuenta, préstamo o deuda), **When** el bloque se despliega, **Then** aparecen todos los campos
   avanzados existentes y al guardar se persisten sin pérdida de datos.
4. **Given** un formulario abierto en modo edición de un registro que ya tiene campos avanzados completos, **When** el
   usuario lo abre, **Then** el bloque "Más opciones" inicia plegado mostrando un indicador con la cantidad de campos
   avanzados con valor (por ejemplo, "Más opciones · 2 activas") y al desplegarlo permite editarlos sin pérdida de datos.

---

### User Story 4 - Control y Hábitos centrado en "lo de hoy" (Priority: P2)

Al abrir Control y Hábitos, la persona ve primero lo que necesita hacer hoy: "Foco de Hoy" y su puntaje de hábitos
(que salieron del Resumen en la spec 013) aparecen arriba con claridad, seguidos de hábitos, tareas y metas en
tarjetas limpias, mientras la sección de analítica permanece plegada por defecto para no abrumar la vista diaria.

**Why this priority**: Devuelve visibilidad clara a "Foco de Hoy" y al puntaje de hábitos que la spec 013 retiró del
Resumen, y ordena la pantalla alrededor de la acción diaria en lugar de gráficos densos.

**Independent Test**: Abrir Control y Hábitos con hábitos, tareas y metas activos: en la parte superior se ven el
puntaje de hábitos y "Foco de Hoy" sin necesidad de expandir nada; la analítica aparece plegada por defecto y se puede
desplegar bajo demanda; marcar un hábito o tarea funciona igual que antes.

**Acceptance Scenarios**:

1. **Given** un usuario con hábitos y tareas activos, **When** abre Control y Hábitos, **Then** el dato protagonista
   (puntaje de hábitos / avance de hoy) y la sección "Foco de Hoy" aparecen primero y con claridad.
2. **Given** Control y Hábitos recién abierto, **When** el usuario recorre la pantalla, **Then** la sección de
   analítica está plegada por defecto y muestra un control claro para desplegarla cuando quiera consultarla.
3. **Given** hábitos, tareas y metas dentro de Control y Hábitos, **When** el usuario cambia entre ellos debajo de
   "Foco de Hoy", **Then** se presentan mediante un selector segmentado (Hábitos / Tareas / Metas) que muestra una
   lista a la vez, conservando su identidad y reglas propias (sin fusionar entidades) en tarjetas redondeadas con
   frases cortas y una acción principal clara, con la analítica plegada debajo.
4. **Given** un usuario sin hábitos, tareas o metas cargados, **When** abre esa sección, **Then** ve un estado vacío
   amable con una acción directa para crear el primero.

---

### User Story 5 - Espacio Compartido en frases claras y flujo de invitación simple (Priority: P2)

En Espacio Compartido, la persona entiende quién debe a quién con solo leer una frase ("Ana te debe S/ 40" o "Le debes
S/ 40 a Ana"), puede revisar movimientos compartidos con su división sin tablas densas, y crear un espacio o invitar y
unirse mediante un flujo visualmente simple y claro.

**Why this priority**: Los saldos divididos entre personas son confusos cuando se presentan como cifras técnicas en
tablas; expresarlos como frases directas hace útil la pantalla de inmediato.

**Independent Test**: Probar Espacio Compartido en dos estados: (a) sin espacio (crear o unirse con flujo simplificado)
y (b) con un espacio activo con miembros y movimientos divididos: los saldos se leen como frases naturales ("Ana te
debe S/ 40"), el flujo de invitación es claro y toda la lógica de membresía y división funciona sin cambios.

**Acceptance Scenarios**:

1. **Given** un espacio compartido con movimientos divididos y saldos pendientes entre miembros, **When** el usuario
   abre Espacio Compartido, **Then** el dato protagonista resume su saldo neto y cada saldo con otro miembro se muestra
   como una frase natural (por ejemplo, "Ana te debe S/ 40" o "Le debes S/ 40 a Ana").
2. **Given** un espacio compartido sin saldos pendientes entre miembros, **When** el usuario lo consulta, **Then** ve
   una frase clara indicando que están al día (por ejemplo, "Están al día").
3. **Given** un usuario que quiere crear un espacio, invitar a alguien o unirse mediante invitación, **When** usa el
   flujo en Espacio Compartido, **Then** las opciones se presentan en pasos simples y tarjetas limpias, manteniendo el
   consentimiento explícito de membresía sin cambios de reglas.
4. **Given** los movimientos compartidos del espacio, **When** el usuario los revisa, **Then** se listan de forma
   legible con quién pagó y cómo se dividió, sin tablas ni bordes duros.

---

### User Story 6 - Mi Progreso ligero y Ajustes ordenados por secciones (Priority: P3)

En Mi Progreso, los 6 logros se muestran en una cuadrícula ligera con estado evidente (logrado o en curso) respetando
el interruptor del usuario para ocultar esta vista. En Ajustes, las entradas "Completar configuración" y "Ver tutorial"
de la spec 013 permanecen visibles arriba, y el resto de las preferencias se organizan en cinco secciones colapsables
para evitar una lista interminable de controles.

**Why this priority**: Son pantallas de uso menos frecuente que Finanzas o Control, pero completar su rediseño cierra
la coherencia visual de extremo a extremo en toda la app.

**Independent Test**: Abrir Mi Progreso y verificar los 6 logros con estados claros (logrado / en curso) y comprobar
que el interruptor de ocultamiento sigue funcionando. Abrir Ajustes y verificar que "Completar configuración" y "Ver
tutorial" están visibles arriba y que las 5 secciones (Perfil, Cuentas e ingresos, Notificaciones, Apariencia, Datos y
exportación) se pliegan y despliegan correctamente.

**Acceptance Scenarios**:

1. **Given** la pantalla Mi Progreso, **When** el usuario la abre, **Then** ve un resumen protagonista de su avance y
   los 6 logros en una cuadrícula ligera donde cada logro distingue claramente si está logrado o en curso.
2. **Given** el interruptor para ocultar Mi Progreso, **When** el usuario lo activa o desactiva, **Then** se respeta
   exactamente igual que antes.
3. **Given** la pantalla Ajustes, **When** el usuario la abre, **Then** "Completar configuración" (si aplica o como
   acceso permanente según spec 013) y "Ver tutorial" aparecen visibles en la parte superior, fuera de secciones
   plegadas.
4. **Given** las demás opciones de Ajustes, **When** el usuario recorre la pantalla, **Then** están agrupadas en cinco
   secciones colapsables —**Perfil**, **Cuentas e ingresos**, **Notificaciones**, **Apariencia** y **Datos y
   exportación**— que inician todas plegadas por defecto (salvo navegación directa a una sección concreta) y permiten
   mantener varias abiertas a la vez para usar todos los controles existentes sin pérdida de funcionalidad.

---

### Edge Cases

- **Pantallas sin datos (usuario nuevo o sección vacía).** Cada pantalla y pestaña (Movimientos, 50/30/20, Préstamos,
  Hábitos, Tareas, Metas, Espacio Compartido) muestra un estado vacío amable en tuteo con una acción directa para
  agregar el primer registro, nunca una tabla vacía ni un espacio en blanco sin explicación.
- **Pantallas pequeñas (360 px de ancho), modo PWA instalada y textos largos.** Nombres largos de cuentas,
  categorías, préstamos o miembros de un espacio compartido no rompen la tarjeta, no desbordan horizontalmente y
  mantienen los objetivos táctiles de al menos 44 px. Al usarse instalada como app móvil (PWA), la interfaz respeta las
  zonas seguras del dispositivo (notch y barra de gestos inferior), evita que la barra inferior tape el contenido
  desplazable y mantiene visibles los campos y el botón de guardar cuando se despliega el teclado móvil.
- **Formulario con error de validación dentro de "Más opciones".** Si un campo oculto en "Más opciones" tiene un error
  de validación al intentar guardar, el bloque "Más opciones" se despliega automáticamente para mostrar el error junto
  al campo.
- **Préstamos con 1 cuota restante o saldados.** Las frases de estado manejan singular/plural correctamente ("Te falta
  1 cuota · próxima el 15" frente a "Te faltan 8 cuotas · próxima el 15") y distinguen préstamos saldados o sin día de
  pago definido sin mostrar texto roto.
- **Tarjeta existente sin línea de crédito en Finanzas.** Mantiene el comportamiento de la spec 013 ("Debes S/ X" con
  opción de agregar línea de crédito), sin forzar campos faltantes.
- **Saldos en Espacio Compartido con céntimos o múltiples miembros.** Los montos se formatean siempre desde enteros
  en PEN (sin errores de redondeo) y los saldos en cero se muestran de forma clara ("Están al día").
- **Preferencia de movimiento reducido.** Cuando el sistema solicita reducir movimiento, las microanimaciones de
  despliegue (acordeones de Ajustes, "Más opciones", analítica colapsable, hojas) se reducen o eliminan sin afectar
  la usabilidad.
- **Uso sin conexión.** Todas las pantallas rediseñadas, formularios, acordeones y estados vacíos funcionan
  completamente offline, con la única excepción ya establecida del inicio de sesión inicial por OAuth.
- **Detección de voseo.** Todo copy nuevo y revisado en las pantallas tocadas usa tuteo latinoamericano neutro,
  incluyendo conjugaciones o formas que la verificación automática podría no cubrir.

## Requirements *(mandatory)*

### Functional Requirements

**Principios transversales y lenguaje visual**

- **FR-001**: Todas las pantallas alcanzadas por esta spec MUST aplicar el lenguaje visual establecido en la spec 013:
  paleta cálida crema en claro y ciruela oscuro en oscuro, acento verde pastel, tipografías Fredoka (cifras y títulos)
  y Figtree (texto), tarjetas con bordes muy redondeados, botones en forma de píldora, sombras cálidas suaves y
  separación mediante espacio y píldoras de color (fondo pálido / texto oscuro) en lugar de líneas divisorias duras.
- **FR-002**: Ninguna pantalla de la app MUST conservar etiquetas en mayúsculas monoespaciadas, estilos "terminal" ni
  cuadrículas de 4 indicadores (KPIs).
- **FR-003**: Cada pantalla principal MUST presentar una idea central con un dato protagonista grande y una única
  acción principal claramente identificable; la información secundaria MUST expresarse en frases cortas y cercanas en
  lugar de tablas o etiquetas técnicas sueltas.
- **FR-004**: El diseño MUST ser mobile-first extremo (diseñado primordialmente para uso con una mano en celular desde
  360 px de ancho, con ergonomía de app nativa PWA: respeto a zonas seguras de notch y barra de gestos, acciones clave
  al alcance del pulgar, campos accesibles con teclado móvil abierto y color de barra de estado del sistema coherente
  con modo claro y oscuro, sin modificar el service worker ni los flujos de instalación). En tablet vertical MUST
  conservar la barra inferior fija con el contenido centrado hasta aproximadamente 720 px; en tablet horizontal y
  computadora MUST mostrar la barra lateral y centrar el contenido principal en una columna de aproximadamente 720 px,
  sin cuadrículas de indicadores.
- **FR-005**: Los elementos visuales compartidos (paneles, tarjetas de resumen, selectores segmentados, hojas modales y
  similares) MUST actualizarse de forma centralizada para ser consumidos por todas las pantallas, evitando estilos
  ad hoc duplicados; los elementos del estilo terminal que queden sin uso MUST retirarse.
- **FR-006**: Toda pantalla o pestaña sin datos MUST mostrar un estado vacío amable y accionable (por ejemplo, "Aún no
  tienes préstamos · Agregar") que lleve al usuario al flujo correspondiente.

**Navegación y pantallas de sistema**

- **FR-007**: La navegación principal (barra inferior en celular y tablet vertical; barra lateral en tablet horizontal
  y computadora) MUST reducir su peso visual, usar etiquetas en formato de oración (sentence case) y destacar
  únicamente la acción "Nuevo registro" como botón primario.
- **FR-008**: Las pantallas de inicio de sesión, carga y error MUST adoptar el mismo lenguaje visual cálido y limpio en
  modo claro y oscuro.

**Finanzas**

- **FR-009**: La pantalla de Finanzas MUST eliminar la cuadrícula superior de indicadores y presentar un único dato
  protagonista por cada una de sus tres pestañas: en Movimientos, el balance neto del periodo filtrado (ingresos −
  egresos); en Regla 50/30/20, el porcentaje gastado del ingreso mensual; en Préstamos, el total que el usuario debe
  (préstamos en cuotas + tarjetas + deudas por pagar), presentando lo que le deben en un bloque secundario aparte.
- **FR-010**: La pestaña Movimientos MUST mostrar los movimientos como una lista agrupada por día, expresada de forma
  clara y legible sin apariencia de tabla rígida, conservando las capacidades existentes de consulta, filtrado y
  edición.
- **FR-011**: La pestaña Regla 50/30/20 MUST presentar el avance de cada bloque (Necesidades, Deseos, Ahorro) mediante
  frases cortas (por ejemplo, "Llevas S/ 130.00 de S/ 630.00 en deseos") y píldoras de color coherentes con la spec 013.
- **FR-012**: La pestaña Préstamos MUST mostrar préstamos en cuotas, deudas informales y tarjetas reutilizando los
  datos de la spec 013, presentándolos como tarjetas con una frase de estado clara (por ejemplo, "Te faltan 8 cuotas ·
  próxima el 15") y conservando todas las acciones existentes (registrar pago de cuota, abono a capital, saldar deuda,
  agregar).

**Control y Hábitos**

- **FR-013**: La pantalla Control y Hábitos MUST priorizar "lo de hoy" en la parte superior, mostrando con claridad
  "Foco de Hoy" y el puntaje de hábitos que la spec 013 retiró del Resumen.
- **FR-014**: La sección de analítica dentro de Control y Hábitos MUST aparecer plegada por defecto y poder desplegarse
  bajo demanda del usuario.
- **FR-015**: Hábitos, tareas y metas MUST organizarse debajo de "Foco de Hoy" mediante un selector segmentado
  (pestañas: Hábitos / Tareas / Metas) que muestra una lista a la vez con la analítica plegada debajo, conservando sus
  conceptos y comportamientos distintos (Principio XIII) en tarjetas redondeadas con una acción principal clara y
  estados vacíos accionables.

**Espacio Compartido**

- **FR-016**: La pantalla Espacio Compartido MUST presentar los saldos entre miembros como frases naturales y directas
  (por ejemplo, "Ana te debe S/ 40", "Le debes S/ 40 a Ana" o "Están al día") con un dato protagonista claro del saldo
  del usuario.
- **FR-017**: El flujo para crear un espacio, invitar a otros miembros y unirse a un espacio MUST simplificarse
  visualmente manteniendo intactas las reglas de invitación y consentimiento explícito de membresía (Principio IX).
- **FR-018**: Los movimientos compartidos y su división MUST presentarse en tarjetas o filas limpias sin tablas ni
  bordes duros, conservando todas las acciones existentes.

**Mi Progreso y Ajustes**

- **FR-019**: La pantalla Mi Progreso MUST presentar los 6 logros en una cuadrícula ligera donde cada logro comunique
  con claridad si está logrado o en curso, respetando el interruptor existente para ocultar Mi Progreso.
- **FR-020**: La pantalla Ajustes MUST mantener visibles en la parte superior las acciones "Completar configuración" y
  "Ver tutorial" introducidas en la spec 013.
- **FR-021**: El resto de las opciones de Ajustes MUST agruparse en cinco secciones colapsables: **Perfil**, **Cuentas
  e ingresos**, **Notificaciones**, **Apariencia** y **Datos y exportación**. Todas MUST iniciar plegadas por defecto
  (salvo navegación directa a una sección concreta, actualmente **Cuentas e ingresos** desde Resumen o ⌘K) y permitir
  mantener varias secciones abiertas simultáneamente, conservando todas las preferencias y acciones actuales.

**Formularios y hojas**

- **FR-022**: La hoja de registro rápido y los formularios de movimiento, transferencia, cuentas, préstamos y deudas
  MUST presentarse en celular como hojas desde abajo con la acción principal de guardar fija al alcance del pulgar y en
  tablet y computadora como diálogos centrados con el mismo contenido. En todos los dispositivos MUST mostrar primero
  únicamente los campos esenciales (como monto, cuenta y categoría, según cada entidad) y agrupar los campos avanzados
  u opcionales detrás de un control "Más opciones" plegado por defecto. Al editar un registro que ya tenga campos
  avanzados con valor, "Más opciones" MUST iniciar plegado con un indicador numérico de cuántos campos avanzados están
  activos (por ejemplo, "Más opciones · 2 activas").
- **FR-023**: Si al enviar un formulario existe un error de validación en un campo oculto dentro de "Más opciones", el
  bloque MUST desplegarse automáticamente para que el usuario vea y corrija el error.

**Arquitectura de presentación, copy, accesibilidad y no regresión**

- **FR-024**: Esta spec MUST NOT modificar reglas de negocio, cálculos financieros, modelo de datos, migraciones ni
  lógica de sincronización. Cualquier necesidad funcional detectada durante el trabajo MUST quedar anotada para una
  spec futura en lugar de implementarse aquí.
- **FR-025**: Toda construcción de frases dinámicas de estado o resumen (por ejemplo, cuotas restantes y próxima fecha,
  avance de bloques 50/30/20, saldos entre miembros) MUST vivir en funciones puras fuera de la capa de presentación,
  con pruebas unitarias dedicadas (Principio III).
- **FR-026**: No se MUST agregar ninguna nueva dependencia externa de ejecución (Principios I y VII).
- **FR-027**: Todo el copy de las pantallas y formularios tocados MUST estar en español latinoamericano neutro con
  tuteo y sin voseo, revisando manualmente posibles formas de voseo que la verificación automática no detecte
  (Principio VI).
- **FR-028**: Todas las pantallas y formularios rediseñados MUST cumplir accesibilidad en modo claro y modo oscuro:
  contraste legible (AA) incluidos los pares pastel, foco visible en navegación por teclado, objetivos táctiles de al
  menos 44 px y respeto a la preferencia de movimiento reducido en las microanimaciones.
- **FR-029**: Todo comportamiento funcional existente y la operación sin conexión MUST mantenerse intactos; la suite de
  pruebas existente MUST seguir pasando sin alterar el comportamiento esperado, añadiendo pruebas de interfaz solo
  para el cableado nuevo (como "Más opciones" o secciones colapsables).

### Key Entities *(no data model changes)*

Esta spec no crea ni modifica entidades persistidas ni migraciones. Reutiliza y presenta de forma más clara las
entidades existentes del dominio:

- **Cuenta de pago, Movimiento, Presupuesto 50/30/20, Préstamo en cuotas y Deuda informal**: reutilizados en Finanzas
  y formularios con los atributos ya ampliados en la spec 013.
- **Hábito, Tarea y Meta**: entidades distintas mantenidas por separado en Control y Hábitos.
- **Espacio Compartido, Membresía, Invitación y Movimiento compartido**: presentados con saldos en frases y flujo
  simplificado sin alterar reglas de membresía.
- **Logro (Mi Progreso)** y **Preferencias de usuario (Ajustes)**: presentados en cuadrícula ligera y secciones
  colapsables respetando sus estados persistidos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las pantallas de la app (Navegación, Finanzas, Control y Hábitos, Espacio Compartido, Mi
  Progreso, Ajustes, formularios/hojas e inicio de sesión/carga/error) eliminan por completo las etiquetas en
  mayúsculas monoespaciadas, los bordes duros de estilo terminal y las cuadrículas de 4 indicadores.
- **SC-002**: En cada pantalla principal (y en cada pestaña de Finanzas), una persona identifica el dato protagonista y
  la acción principal en menos de 5 segundos al abrirla en móvil (360 px) o escritorio.
- **SC-003**: En todos los formularios rediseñados (registro rápido, movimiento, transferencia, cuentas, préstamos y
  deudas), el registro con los campos esenciales visibles se completa sin necesidad de expandir "Más opciones",
  ocultando el 100% de los campos opcionales/avanzados (reduciendo al menos un 30% los campos visibles inicialmente en
  los formularios con campos opcionales amplios; en préstamos en cuotas se ocultan 2 de 7 campos porque los 5 restantes
  son obligatorios por el dominio).
- **SC-004**: El 100% de las pantallas tocadas se ven coherentes con el Resumen de la spec 013 tanto en modo claro como
  en modo oscuro, en celular (360 px, incluyendo zonas seguras de PWA instalada), en tablet (vertical con barra inferior
  y horizontal con barra lateral) y en computadora (~720 px centrados con barra lateral), sin desbordamiento horizontal.
- **SC-005**: El 100% de los pares de color (incluidas las píldoras pastel) y controles en las pantallas tocadas
  cumplen contraste AA en claro y oscuro, foco visible, objetivo táctil mínimo de 44 px y respeto a la preferencia de
  movimiento reducido.
- **SC-006**: 0 regresiones funcionales: el 100% de las pruebas existentes pasan sin cambios de comportamiento, todas
  las funciones nuevas de formateo de frases cuentan con pruebas unitarias, el cableado nuevo de interfaz cuenta con
  pruebas dedicadas y 0 instancias de voseo permanecen en las pantallas tocadas.
- **SC-007**: El 100% de los flujos cubiertos operan normalmente sin conexión a internet (excepto inicio de sesión
  inicial por OAuth), sin errores ni bloqueos de interfaz.

## Assumptions

- **Continuidad directa de la spec 013.** Los tokens globales (paleta crema/ciruela, verde pastel, Fredoka + Figtree,
  radios, sombras, tema según sistema) y el rediseño de Resumen, onboarding, checklist y tour ya están implementados
  por la spec 013 y no se reescriben en esta spec.
- **Dato protagonista por pestaña de Finanzas.** En Movimientos es el balance neto del periodo filtrado (ingresos −
  egresos); en Regla 50/30/20 es el porcentaje gastado del ingreso mensual; en Préstamos es el total que el usuario
  debe (préstamos en cuotas + tarjetas + deudas por pagar), mostrando lo que le deben en un bloque secundario aparte.
- **Estado inicial de secciones colapsables.** En Control y Hábitos, la analítica inicia plegada por defecto. En
  Ajustes, las cinco secciones colapsables inician todas plegadas por defecto (salvo navegación directa a una sección
  concreta) y pueden permanecer varias abiertas al mismo tiempo, manteniendo siempre visibles arriba "Completar
  configuración" y "Ver tutorial".
- **Edición en formularios con campos avanzados.** Al editar un registro existente que ya tiene datos en campos
  avanzados, el bloque "Más opciones" inicia plegado mostrando un contador de opciones activas (por ejemplo, "Más
  opciones · 2 activas") para mantener el formulario limpio sin ocultar que hay valores configurados.
- **Fuera de alcance explícito.** No entran en esta spec: cambios al Resumen, onboarding, checklist o tour (ya
  completados en la 013); nuevas funcionalidades como "me deben" en el onboarding, multimoneda o importación de
  movimientos; ni cambios al modelo de datos, sincronización o servidor.
