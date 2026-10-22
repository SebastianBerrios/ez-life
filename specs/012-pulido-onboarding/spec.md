# Feature Specification: Pulido del onboarding

**Feature Branch**: `012-pulido-onboarding`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Pulido del onboarding: saldo actual al registrarse, español latinoamericano neutro en toda la app, categoría de ahorro fija sin selector, categorías y subcategorías ordenadas por creación y sin subcategoría 'General' por defecto, y avisos transitorios que desaparecen solos."

Constitución aplicable: v2.1.0 (Principio VI ampliado: tuteo neutro, sin voseo). Sin dependencias
runtime nuevas (Principios I y VII). Sin migración de base de datos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar mi saldo actual al empezar (Priority: P1)

Muchas personas se registran a mitad o a fin de mes, cuando ya gastaron parte de su sueldo. Hoy el
onboarding solo pregunta el sueldo mensual y la app arranca con S/ 0.00 de dinero disponible, lo que no
refleja su realidad. En el primer paso, además del sueldo, la persona puede indicar cuánto dinero tiene
hoy.

**Why this priority**: Es el único cambio que agrega capacidad nueva y corrige un dato incorrecto
desde el primer minuto de uso (el "Capital disponible" del inicio). El resto es pulido.

**Independent Test**: Registrar un usuario nuevo con sueldo S/ 3,000 y saldo actual S/ 800; al terminar
el onboarding, el "Capital disponible" muestra S/ 800.00 y los presupuestos de cada categoría se
calculan sobre S/ 3,000.

**Acceptance Scenarios**:

1. **Given** un usuario nuevo en el paso 1, **When** ve la pantalla, **Then** aparece el título "Tu punto
   de partida", el campo "Sueldo o ingreso mensual" y el campo opcional "Saldo actual (opcional)" con la
   ayuda "Lo que tienes hoy entre efectivo y cuentas. Puedes ajustarlo después en Ajustes → Cuentas.", y
   el indicador de pasos dice "INICIO" (no "INGRESOS").
2. **Given** sueldo S/ 3,000 y saldo actual S/ 800, **When** el usuario completa el onboarding, **Then**
   el "Capital disponible" es S/ 800.00 y el presupuesto de una categoría al 50% es S/ 1,500.00
   (sueldo × %, no saldo × %).
3. **Given** el campo de saldo actual vacío, **When** el usuario continúa, **Then** el saldo se toma
   como S/ 0.00 y el onboarding avanza sin error.
4. **Given** un saldo actual negativo, **When** el usuario intenta continuar, **Then** ve un mensaje de
   validación y no avanza hasta corregirlo.
5. **Given** un usuario que ya completó el onboarding con saldo S/ 800, **When** vuelve a abrir la app
   (o retoma un onboarding interrumpido), **Then** su saldo no se duplica ni se reinicia a S/ 0.00 por la
   creación automática de la cuenta "Efectivo".

---

### User Story 2 - La app habla en español latinoamericano neutro (Priority: P2)

Los textos de la app usan voseo rioplatense ("Definí", "querés", "ganás", "Podés", "agregá"), que suena
ajeno a usuarios de Perú y del resto de Latinoamérica. Todos los textos pasan a tuteo neutro.

**Why this priority**: Afecta cada pantalla, pero no cambia el comportamiento; se puede entregar
independientemente del resto.

**Independent Test**: Recorrer el onboarding completo y las pantallas principales sin encontrar formas
de voseo; una búsqueda automática de formas de voseo en el código fuente no devuelve resultados.

**Acceptance Scenarios**:

1. **Given** el paso 2 del onboarding, **When** se lee la descripción, **Then** dice "Define en qué
   categorías quieres distribuir lo que ganas cada mes. Puedes agregar, renombrar o eliminar las que
   necesites." (y no "Definí… querés… ganás… Podés…").
2. **Given** cualquier mensaje de error de validación del dominio (distribución, cuentas, movimientos,
   transferencias, cuotas), **When** se muestra, **Then** está en tuteo neutro (ej. "Completa…",
   "archívala").
3. **Given** el código fuente de la app, **When** se ejecuta la búsqueda de control de formas de voseo
   sobre `src/`, **Then** no hay coincidencias, tampoco en los textos que verifican las pruebas
   automáticas.

---

### User Story 3 - La categoría de ahorro es fija y no hay selector (Priority: P2)

En el paso 2, cada categoría de distribución muestra un selector "AHORRO". Se sobreentiende cuál es la
categoría de ahorro, así que el selector sobra y además permite errores: borrar la categoría de ahorro
hace que "Guardar distribución" falle sin avisar.

**Why this priority**: Simplifica la pantalla y corrige un fallo silencioso real.

**Independent Test**: En el paso 2, no existe ningún selector "AHORRO"; la categoría "Ahorro e
Inversión" no tiene botón de eliminar y muestra "Ahorro · fija"; las categorías nuevas nunca son de
ahorro.

**Acceptance Scenarios**:

1. **Given** el paso 2 con la distribución sugerida 50/30/20, **When** se muestra, **Then** no hay
   selectores "AHORRO" y la categoría "Ahorro e Inversión" muestra la etiqueta "Ahorro · fija" y no
   tiene botón de eliminar.
2. **Given** la categoría de ahorro, **When** el usuario la renombra o le pone 0%, **Then** el cambio
   se acepta y se guarda.
3. **Given** el usuario agrega una categoría nueva con "+ Nueva categoría de distribución", **When** se
   guarda, **Then** no es de ahorro.
4. **Given** un usuario existente que había marcado otra categoría como ahorro, **When** abre la
   distribución, **Then** esa categoría se mantiene como la de ahorro y se muestra "Ahorro · fija" en
   ella.
5. **Given** la categoría de ahorro, **When** el usuario busca eliminarla, **Then** no existe esa acción
   en la interfaz, y cualquier intento directo contra la capa de datos se rechaza.
6. **Given** un fallo cualquiera al guardar la distribución, **When** ocurre, **Then** el usuario ve un
   mensaje de error en pantalla (no solo un registro en consola).

---

### User Story 4 - Categorías y subcategorías nuevas al final, sin "General" (Priority: P2)

Al crear una categoría de gasto o una subcategoría, hoy aparece en una posición arbitraria (a veces al
inicio) y las categorías nuevas nacen con una subcategoría "General" que la persona no pidió.

**Why this priority**: Corrige confusión visible en el paso 3 y en cualquier lista de categorías.

**Independent Test**: Crear tres categorías seguidas y verificar que aparecen en el orden de creación,
después de las existentes; ninguna trae subcategorías; "Finalizar" queda bloqueado hasta que todas
tengan al menos una.

**Acceptance Scenarios**:

1. **Given** una lista de categorías de gasto, **When** el usuario crea una categoría nueva, **Then**
   aparece al final de la lista.
2. **Given** una categoría con subcategorías, **When** el usuario agrega una subcategoría, **Then**
   aparece al final de esa categoría.
3. **Given** el usuario crea una categoría nueva, **When** se muestra, **Then** no tiene ninguna
   subcategoría (no existe "General"), muestra "Agrega al menos una subcategoría" y "Finalizar" está
   deshabilitado.
4. **Given** que todas las categorías tienen al menos una subcategoría, **When** el usuario pulsa
   "Finalizar", **Then** el onboarding termina.
5. **Given** una categoría sin subcategorías (en proceso de creación), **When** el usuario abre el
   formulario de movimientos, **Then** esa categoría no aparece como opción.
6. **Given** una categoría con una sola subcategoría, **When** el usuario intenta eliminarla, **Then**
   se bloquea (la protección de "al menos una" se mantiene).

---

### User Story 5 - Los avisos desaparecen solos (Priority: P3)

Avisos como "No se puede eliminar: la categoría necesita al menos una subcategoría." se quedan en
pantalla para siempre. Deben desaparecer después de unos segundos.

**Why this priority**: Es una mejora de pulido que no bloquea ningún flujo.

**Independent Test**: Provocar el aviso de eliminación y comprobar que desaparece a los 4 segundos, o
antes si el usuario hace otra acción.

**Acceptance Scenarios**:

1. **Given** un aviso transitorio visible debajo de una categoría, **When** pasan 4 segundos, **Then**
   desaparece sin intervención.
2. **Given** un aviso transitorio visible, **When** el usuario realiza otra acción (agregar, renombrar,
   eliminar otra cosa), **Then** el aviso desaparece de inmediato.
3. **Given** un error de validación de formulario (ej. "el total debe sumar 100%"), **When** el usuario
   no lo ha corregido, **Then** permanece visible hasta que se corrija.
4. **Given** un aviso transitorio, **When** se muestra, **Then** aparece junto al elemento que lo causó
   (se mantiene el contexto de cuál categoría falló).

---

### Edge Cases

- **Saldo con decimales o formato regional**: el saldo acepta decimales (S/ 800.50) con las mismas
  reglas que el campo de sueldo; valores no numéricos se rechazan con mensaje.
- **Saldo muy grande**: se aplican los mismos límites que otros montos de la app.
- **Reintentar el paso 1** (por ejemplo, tras un fallo de guardado o al retomar un onboarding
  interrumpido): no debe pisar un saldo que ya existe ni uno que ya cambió por movimientos; el saldo
  inicial solo se fija al crear la cuenta por primera vez. (El paso 1 no se vuelve a abrir desde
  Ajustes: allí solo se editan la distribución y las categorías.)
- **Onboarding interrumpido y retomado**: si la persona cierra la app tras el paso 1, al volver no se
  duplica la cuenta "Efectivo" ni se pierde el saldo ingresado.
- **Sin conexión**: todo el flujo funciona offline (Principio V); el saldo se sincroniza después como
  cualquier otro dato.
- **Aviso y cambio de pantalla**: si el usuario cambia de paso mientras hay un aviso visible, este no
  reaparece luego.
- **Categorías existentes con "General"**: las que ya tienen la subcategoría "General" se conservan tal
  cual; solo cambia el comportamiento de las nuevas.
- **Categoría de ahorro con nombre distinto** (renombrada o heredada): sigue tratándose como la fija
  por su condición de ahorro, no por su nombre.

## Requirements *(mandatory)*

### Functional Requirements

**Saldo actual**

- **FR-001**: El paso 1 DEBE mostrar el título "Tu punto de partida", el campo "Sueldo o ingreso
  mensual" y el campo "Saldo actual (opcional)" con la ayuda "Lo que tienes hoy entre efectivo y
  cuentas. Puedes ajustarlo después en Ajustes → Cuentas."
- **FR-002**: El indicador de pasos DEBE llamar al primer paso "INICIO".
- **FR-003**: El saldo actual DEBE ser opcional (vacío equivale a 0) y NO DEBE admitir valores
  negativos ni no numéricos; en esos casos DEBE mostrarse un mensaje y bloquearse el avance.
- **FR-004**: El saldo actual DEBE guardarse como saldo inicial de la cuenta de pago "Efectivo" del
  usuario, en céntimos (Principio VIII), y DEBE reflejarse en el "Capital disponible".
- **FR-005**: La cuenta "Efectivo" DEBE crearse durante el onboarding (con el saldo indicado) y su
  creación automática posterior DEBE ser idempotente: nunca duplica la cuenta ni sobrescribe su saldo
  inicial.
- **FR-006**: El saldo actual NO DEBE alterar el cálculo de presupuestos: el presupuesto de cada
  categoría sigue siendo sueldo mensual × porcentaje de la categoría.

**Idioma**

- **FR-007**: Todo texto visible al usuario DEBE estar en español latinoamericano neutro con tuteo y sin
  voseo rioplatense, incluyendo componentes, mensajes de error del dominio y descripciones de ayuda.
- **FR-008**: Las pruebas automáticas que verifican textos DEBEN usar los textos en tuteo neutro.
- **FR-009**: DEBE existir una verificación de control (búsqueda de formas de voseo sobre `src/`) que no
  arroje coincidencias al cerrar la feature.

**Categoría de ahorro**

- **FR-010**: El paso 2 NO DEBE mostrar un selector de "AHORRO"; la categoría de ahorro DEBE mostrar la
  etiqueta "Ahorro · fija".
- **FR-011**: La categoría de ahorro DEBE poder renombrarse y admitir 0%, y NO DEBE poder eliminarse.
- **FR-012**: Las categorías de distribución nuevas DEBEN crearse siempre como no-ahorro; los datos de
  usuarios existentes (incluida una categoría de ahorro distinta de la sugerida) DEBEN conservarse
  intactos.
- **FR-013**: La interfaz NO DEBE ofrecer la acción de eliminar la categoría de ahorro, y cualquier
  intento de eliminarla por otra vía (directamente contra la capa de datos) DEBE rechazarse.
- **FR-014**: Cualquier fallo al guardar la distribución DEBE mostrar un mensaje de error al usuario.

**Categorías y subcategorías**

- **FR-015**: Las categorías de gasto y las subcategorías DEBEN listarse por fecha de creación
  ascendente (las nuevas al final) en toda la app, con un criterio de desempate estable.
- **FR-016**: Crear una categoría de gasto NO DEBE crear subcategorías por defecto (en particular
  "General"); la categoría nace vacía.
- **FR-017**: Una categoría sin subcategorías DEBE mostrar "Agrega al menos una subcategoría" y DEBE
  bloquear "Finalizar" hasta que toda categoría tenga al menos una subcategoría.
- **FR-018**: Una categoría sin subcategorías NO DEBE aparecer como opción en el formulario de
  movimientos.
- **FR-019**: La protección de no eliminar la última subcategoría de una categoría DEBE mantenerse.

**Avisos transitorios**

- **FR-020**: Los avisos transitorios DEBEN mostrarse junto al elemento que los causó y DEBEN
  desaparecer a los 4 segundos o al realizar otra acción, lo que ocurra primero.
- **FR-021**: Los errores de validación de formulario (ej. total de distribución distinto de 100%)
  DEBEN permanecer visibles hasta que se corrijan.
- **FR-022**: El mecanismo de auto-ocultado DEBE ser reutilizable por cualquier aviso transitorio de la
  app, sin agregar dependencias nuevas.

**Fuera de alcance**: reordenamiento manual de categorías, saldos por varias cuentas durante el
onboarding, prorrateo del sueldo, y presupuestos calculados sobre el saldo actual.

### Key Entities *(include if feature involves data)*

- **Cuenta de pago "Efectivo"**: cuenta por defecto de cada usuario, con saldo inicial en céntimos. Pasa
  a crearse en el onboarding con el saldo actual indicado; sigue siendo editable en Ajustes → Cuentas.
- **Categoría de distribución**: porción porcentual del sueldo. Exactamente una es la de ahorro (fija,
  no eliminable); las demás pueden renombrarse, ajustarse y eliminarse.
- **Categoría de gasto y subcategoría**: se ordenan por creación; una categoría puede existir
  temporalmente vacía durante el onboarding, pero no ofrece opciones en el registro de movimientos.
- **Aviso transitorio**: mensaje breve asociado a un elemento, con vida limitada (4 s).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo que registra un saldo actual ve ese mismo monto como "Capital
  disponible" al terminar el onboarding en el 100% de los casos, y sus presupuestos siguen siendo
  sueldo × porcentaje.
- **SC-002**: Un usuario puede completar el primer paso (sueldo + saldo) en menos de 1 minuto, y dejar
  el saldo vacío no impide avanzar.
- **SC-003**: La búsqueda de control de voseo sobre el código fuente devuelve 0 coincidencias.
- **SC-004**: En el 100% de las creaciones de categoría o subcategoría, el elemento nuevo aparece
  después de todos los existentes, y ninguna categoría nueva trae subcategorías automáticas.
- **SC-005**: Ningún aviso transitorio permanece en pantalla más de 4 segundos tras mostrarse, y
  ninguna acción de la persona deja un aviso obsoleto visible.
- **SC-006**: No existe ningún camino en el onboarding que deje al usuario con una distribución sin
  categoría de ahorro ni con un fallo de guardado sin mensaje.
- **SC-007**: Usuarios existentes conservan todos sus datos (categorías, "General" ya creadas,
  categoría de ahorro previa, saldos); ninguna migración los modifica.

## Assumptions

- La tabla y el campo de saldo inicial de las cuentas de pago ya existen (spec 011), por lo que no se
  requieren cambios de base de datos ni de sincronización.
- La app opera solo en PEN (Principio VIII) y el saldo actual se interpreta en soles.
- "Saldo actual" representa el dinero total disponible hoy (efectivo y cuentas) y se asigna a una única
  cuenta "Efectivo"; separar por cuentas se puede hacer después desde Ajustes.
- La categoría de ahorro se identifica por su condición de ahorro ya guardada en los datos, no por su
  nombre; los usuarios existentes mantienen la suya.
- Los avisos de 4 segundos se aplican a avisos transitorios; los de validación de formulario siguen
  persistentes hasta corregirse.
- No se agrega librería de notificaciones flotantes; los avisos permanecen en línea.
- Las categorías con "General" ya creadas no se modifican ni se migran.
- El texto de los pasos 2 y 3 se mantiene salvo el cambio de voseo a tuteo; solo el paso 1 cambia de
  título y campos.
- Los usuarios que ya terminaron el onboarding, o lo dejaron a medias antes de este cambio, no ven el
  campo nuevo: su cuenta "Efectivo" sigue naciendo con saldo 0 y ajustan el saldo en Ajustes → Cuentas
  (a donde apunta la ayuda del campo). No hay migración ni aviso para ellos.
