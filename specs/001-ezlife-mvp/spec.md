# spec.md — 001-ezlife-mvp

> [!IMPORTANT]
> Este documento es la fuente de verdad vigente de requisitos de ez-life.
> Las specs `002-ui-fixes`, `003-onboarding-wizard-and-categories`,
> `004-category-hierarchy-and-analysis` y `005-select-labels-goals-density`
> son entregas históricas — ver el encabezado de estado al inicio de cada una
> para saber qué de su contenido sigue vigente. `006-qa-remediation` autoriza
> el trabajo de remediación de código pendiente sobre este documento.

## Contexto y objetivo

ez-life es una aplicación de finanzas personales diseñada para que el usuario tome control de su dinero mediante el método de distribución por porcentajes (basado en la regla 50/30/20, pero personalizable). El problema que resuelve: la mayoría de personas no sabe a dónde va su dinero cada mes, no tiene un presupuesto claro, y no tiene herramientas simples que funcionen sin conexión.

**Objetivo del MVP**: Entregar una app mobile-first (desplegada en web) que permita a un usuario individual registrarse, configurar su presupuesto mensual por distribución porcentual, registrar ingresos y egresos clasificados, visualizar su situación financiera en un dashboard, definir metas de ahorro, recibir notificaciones, y exportar sus datos — todo funcionando offline con sincronización a la nube.

---

## Usuarios

| Rol | Descripción |
|---|---|
| **Usuario individual** | Persona que quiere organizar sus finanzas personales. Único rol en el MVP. |

> [!NOTE]
> Finanzas compartidas (pareja/familia) quedan fuera del MVP. El modelo de datos debe considerar esta extensión futura sin requerir migración destructiva.

---

## Historias de usuario

| ID | Historia |
|---|---|
| HU-01 | Como usuario, quiero registrarme con Google o GitHub para acceder a la app sin crear una contraseña. |
| HU-02 | Como usuario nuevo, quiero completar un tutorial de configuración para dejar la app lista para usar desde el primer día. |
| HU-03 | Como usuario, quiero definir mis fuentes de ingreso mensuales para que la app calcule mi presupuesto disponible. |
| HU-04 | Como usuario, quiero distribuir mi presupuesto en categorías porcentuales (necesidades, deseos, ahorros y las que yo cree) para saber cuánto puedo gastar en cada área. |
| HU-06 | Como usuario, quiero crear categorías y subcategorías de gastos para clasificar mis egresos con el nivel de detalle que yo necesite. |
| HU-07 | Como usuario, quiero registrar ingresos y egresos con fecha, monto, descripción, categoría y subcategoría para llevar un control detallado. |
| HU-08 | Como usuario, quiero editar o eliminar un movimiento registrado para corregir errores. |
| HU-09 | Como usuario, quiero configurar movimientos recurrentes (ingresos o egresos) para no tener que registrar manualmente los mismos montos cada mes. |
| HU-10 | Como usuario, quiero ver un dashboard con el resumen de mis finanzas del mes para saber cuánto llevo gastado y cuánto me queda por categoría. |
| HU-11 | Como usuario, quiero crear metas de ahorro con nombre, monto objetivo y fecha límite para saber cuánto me falta para cada meta. |
| HU-12 | Como usuario, quiero recibir notificaciones y recordatorios para no olvidarme de registrar mis gastos o revisar mi presupuesto. |
| HU-13 | Como usuario, quiero exportar mis datos en CSV o PDF para tener un respaldo o compartirlos fuera de la app. |

---

## Requisitos funcionales

### Autenticación y onboarding

**RF-01 — Registro e inicio de sesión con proveedor OAuth**
Cuando el usuario selecciona "Iniciar sesión con Google" o "Iniciar sesión con GitHub", el sistema debe autenticarlo mediante el proveedor elegido y crear su perfil en la app si es la primera vez.

Criterios de aceptación:
- Cuando el usuario inicia sesión por primera vez, el sistema debe crear su perfil y redirigirlo al tutorial de configuración.
- Cuando el usuario inicia sesión y ya completó el tutorial, el sistema debe redirigirlo al dashboard.
- Si el proveedor OAuth rechaza la autenticación, el sistema debe mostrar un mensaje de error descriptivo.
- Si el usuario no tiene conectividad al momento de iniciar sesión por primera vez, el sistema debe informar que se requiere conexión para el registro inicial. Implementado en `specs/007-network-gate-and-notifications/spec.md` RF-30 — antes de esa spec, el texto de este criterio no estaba implementado (el login no capturaba errores del proveedor ni chequeaba conectividad).

**RF-02 — Tutorial de configuración obligatorio**
Mientras el usuario no haya completado el tutorial de configuración, el sistema debe bloquear el acceso a cualquier otra funcionalidad de la app.

Criterios de aceptación:
- Mientras el tutorial no esté completado, el sistema debe mostrar únicamente las pantallas del tutorial y no permitir navegación al dashboard ni a otras secciones.
- El tutorial debe guiar al usuario por estos pasos mínimos: (1) registrar al menos una fuente de ingreso, (2) ajustar los porcentajes de distribución, (3) crear al menos una categoría de gasto con su subcategoría.
- El ciclo mensual es el mes calendario fijo (del día 1 al último día de cada mes); no existe un paso de configuración de día de inicio de ciclo.
- Cuando el usuario completa todos los pasos del tutorial, el sistema debe marcarlo como completado y redirigirlo al dashboard.
- Si el usuario cierra la app a mitad del tutorial, el sistema debe reanudar en el paso donde quedó al volver a abrirla.
- El wizard completo (los 3 pasos) exige conexión a internet, ampliando la excepción offline-first de RNF-01 más allá del login inicial — ver `specs/007-network-gate-and-notifications/spec.md` RF-30. Sin red, el sistema bloquea el wizard con un mensaje explícito hasta que la conexión vuelva.

---

### Ingresos y Ciclo Mensual

**RF-04 — Gestión de fuentes de ingreso**
El sistema debe permitir al usuario crear, editar y eliminar fuentes de ingreso con nombre y monto mensual esperado.

Criterios de aceptación:
- Cuando el usuario crea una fuente de ingreso, el sistema debe solicitar al menos nombre y monto.
- Cuando el usuario edita una fuente de ingreso, el sistema debe recalcular el presupuesto disponible para el ciclo actual.
- Si el usuario intenta eliminar una fuente de ingreso que tiene movimientos asociados, el sistema debe impedirlo e informar el motivo.

**RF-05 — Registro de ingresos**
Cuando el usuario registra un ingreso, el sistema debe asociarlo a una fuente de ingreso existente y almacenarlo con fecha, monto y descripción opcional.

Criterios de aceptación:
- Cuando el usuario registra un ingreso, el sistema debe solicitar: fuente de ingreso, monto, fecha y descripción (opcional).
- Cuando el usuario asigna una fecha anterior, el sistema debe registrar el ingreso en el ciclo correspondiente.
- El sistema debe almacenar todos los montos como enteros en céntimos.

---

### Presupuesto y distribución

**RF-06 — Categorías de distribución con porcentajes**
El sistema debe ofrecer tres categorías de distribución por defecto (`Necesidades Básicas` 50%, `Gustos y Deseos` 30%, `Ahorro e Inversión` 20% con `is_savings: true`) y permitir ajustar los porcentajes, renombrar, y crear/eliminar categorías adicionales (buckets dinámicos — ver `specs/004-category-hierarchy-and-analysis/spec.md`).

Criterios de aceptación:
- Cuando el usuario ajusta los porcentajes, la suma debe ser exactamente 100%. Si no lo es, el sistema impide guardar y muestra la diferencia.
- Si el usuario modifica los porcentajes a mitad de un ciclo, el recálculo aplica retrospectivamente a todos los cálculos del ciclo actual.
- Si el usuario intenta eliminar una categoría de distribución que tiene categorías de gasto asociadas, el sistema debe impedirlo.
- Debe existir en todo momento exactamente un bucket de distribución activo con `is_savings: true`. El usuario puede editar (toggle) qué bucket tiene esta propiedad, pero el sistema debe impedir borrar o desmarcar el último bucket de ahorro restante.

**RF-07 — Cálculo del presupuesto y redondeo**
El sistema debe calcular automáticamente el monto disponible para cada categoría de distribución, manejando los redondeos matemáticos de forma estricta.

Criterios de aceptación:
- El monto de cada categoría se calcula aplicando su porcentaje a los ingresos esperados, truncado a céntimos (enteros).
- Si por los porcentajes sobraran céntimos al sumar el total (ej. sumatoria da S/ 99.99 en vez de S/ 100.00), el céntimo sobrante debe sumarse automáticamente a la categoría que tenga el porcentaje más alto, asegurando que el total exacto cuadre.
- Si dos o más categorías empatan en el porcentaje más alto, el desempate es determinista: gana la categoría con el `id` menor en orden lexicográfico.

---

### Categorías y subcategorías de gasto

**RF-08 — Gestión de categorías y subcategorías**
El sistema debe permitir al usuario crear, editar y eliminar categorías y subcategorías de gasto.

Criterios de aceptación:
- Cada categoría de gasto debe estar asociada a exactamente una categoría de distribución.
- Cada categoría de gasto debe tener al menos una subcategoría.
- Si el usuario intenta eliminar una categoría o subcategoría con movimientos asociados, el sistema debe impedirlo e informar cuántos movimientos están afectados.

---

### Movimientos (ingresos y egresos)

**RF-09 — Registro de egresos**
Cuando el usuario registra un egreso, el sistema debe almacenarlo con los datos obligatorios y actualizar los totales del ciclo.

Criterios de aceptación:
- Solicitar: monto, fecha, categoría de gasto y descripción (opcional). La subcategoría es opcional (modificado por `specs/004-category-hierarchy-and-analysis/spec.md` decisión 12): un gasto puede registrarse con categoría pero sin subcategoría específica.
- El monto es obligatorio, debe ser un entero mayor a 0 (céntimos); el sistema debe rechazar valores `NaN`, negativos o cero.
- Los movimientos se asignan al mes calendario que corresponde según su fecha.

**RF-10 — Edición y eliminación de movimientos**
Cuando el usuario edita o elimina un movimiento, el sistema debe recalcular los totales afectados.

Criterios de aceptación:
- La edición permite modificar todos los campos, reasignando el ciclo si la fecha cambia.
- La eliminación requiere diálogo de confirmación.

**RF-11 — Advertencia de presupuesto excedido en agregados**
Cuando el gasto en una categoría de distribución supera lo presupuestado, el sistema debe advertir visualmente solo en las vistas agregadas a nivel de categoría de distribución (bucket).

Criterios de aceptación:
- La advertencia visual (color/ícono) debe aparecer en el Dashboard, a nivel de bucket.
- La sección de Análisis muestra desglose de gasto real por bucket/categoría/subcategoría sin cálculo de presupuesto ni advertencia (decisión 10 de `specs/004-category-hierarchy-and-analysis/spec.md`) — la advertencia de presupuesto excedido es exclusiva del Dashboard.
- Las listas individuales de movimientos NO deben saturarse con advertencias de presupuesto.
- El sistema no debe bloquear el registro de egresos aunque el presupuesto esté excedido.

---

### Movimientos recurrentes

**RF-12 — Configuración de recurrencia**
El sistema debe permitir configurar movimientos recurrentes automáticos, utilizando la zona horaria local del dispositivo.

Criterios de aceptación:
- Soporte para recurrencia mensual en un día específico.
- Si la fecha de recurrencia es un día que no existe en un mes (ej. día 31 en febrero), se generará el último día disponible de ese mes.
- Al activarse, los movimientos se generan automáticamente para el nuevo ciclo. 
- Si el usuario desactiva una recurrencia y la vuelve a activar meses después, el sistema empieza a generar a partir del mes actual; NO debe generar "pagos fantasma" de los meses inactivos.
- Los movimientos generados son editables y eliminables individualmente sin afectar la regla general.
- La generación es idempotente: si el proceso de generación de movimientos recurrentes se interrumpe a mitad de camino, un reintento no debe duplicar movimientos ya generados para ese ciclo.

---

### Metas de ahorro

**RF-13 — Creación y visualización de metas de ahorro**
El sistema debe permitir crear metas de ahorro con límite opcional y visualizar su progreso.

Criterios de aceptación:
- Solicitar: nombre, monto objetivo en PEN (almacenado en céntimos) y fecha límite opcional.
- El sistema muestra: nombre, objetivo, acumulado, porcentaje de avance y fecha límite.
- Si un aporte hace que la meta supere el monto objetivo, el sistema lo permite (ej. mostrando 110%).
- Si la fecha límite caduca y no se llegó al 100%, la meta no se bloquea; solo muestra un indicador visual (ej. texto rojo "Vencida") pero sigue permitiendo aportes.

**RF-14 — Asignación y orfandad de aportes a metas**
El sistema debe manejar la asignación estricta de ingresos a las metas de ahorro.

Criterios de aceptación:
- Al registrar ingresos en categorías de distribución "Ahorros", se puede asignar a una meta.
- Si el usuario intenta eliminar una meta de ahorro que tiene aportes asociados, el sistema debe impedirlo y obligarlo a reasignar esos aportes a otra meta (o a ahorro general) antes de poder eliminarla.

---

### Dashboard y análisis

**RF-15 — Dashboard y Análisis**
El sistema debe mostrar resúmenes de situación basados en el mes calendario.

Criterios de aceptación:
- Dashboard: ingresos vs egresos, balance, y consumo vs presupuesto (categorías de distribución).
- Análisis: total gastado desglosado por categorías de gasto y subcategorías.
- Se debe poder navegar entre ciclos pasados.

---

### Notificaciones y recordatorios

**RF-16 — Notificaciones in-app y push**
El sistema emite notificaciones de negocio (presupuesto, metas, recordatorio diario), las persiste en un historial in-app, y permite configurar cuándo y cómo se reciben. Implementado completo en `specs/007-network-gate-and-notifications/spec.md` RF-31.

Criterios de aceptación:
- Tipos de alerta: recordatorio de registro diario (a una hora configurable por el usuario, 0-23), presupuesto de un bucket >80% consumido, y meta de ahorro al 100%.
- Cada alerta se persiste en un historial in-app, accesible desde un ícono de campana (no ocupa un ítem del `BottomNav`), con estado leído/no leído.
- Las alertas no se duplican: presupuesto y recordatorio diario se deduplican por ciclo/día; la alerta de meta es un evento único de por vida para esa meta.
- Notificaciones in-app y notificaciones push del navegador se activan/desactivan por separado.
- **Limitación conocida**: no hay service worker ni Web Push del sistema operativo — el recordatorio y las alertas push solo disparan mientras la app está abierta en una pestaña.

---

### Exportación de datos

**RF-17 — Exportación a CSV y PDF**
El sistema debe permitir exportar los datos con formato amigable, usando `jspdf` + `jspdf-autotable` (dependencias runtime justificadas retroactivamente en `specs/006-qa-remediation/spec.md`).

Criterios de aceptación:
- Alcance real de v1: la exportación (CSV y PDF) incluye el historial completo de movimientos del usuario, no solo el ciclo seleccionado en pantalla. Filtrar por ciclo queda como mejora futura, no como comportamiento actual.
- CSV: Formato europeo/latino estricto (Punto y coma `;` para separar columnas, y coma `,` para decimales). Los montos se exportan como decimales legibles (S/ 1500,50), no céntimos.
- PDF: Resumen visual de totales y detalle de movimientos en formato reporte.

---

### Offline y sincronización

**RF-18 — Sincronización offline-first con last-write-wins**
La aplicación es funcional sin internet y maneja conflictos de forma silenciosa.

Criterios de aceptación:
- Salvo el login inicial por OAuth, toda la app lee y escribe en IndexedDB localmente sin requerir internet.
- Los cambios se sincronizan a Supabase al recuperar la conectividad (soportando multi-dispositivo).
- Los conflictos de sincronización entre dispositivos se resuelven automáticamente usando `last-write-wins` basado en el timestamp local del dispositivo que hizo el cambio.

---

## Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | **Offline-first**: La app debe ser funcional sin conexión, usando la base de datos local como fuente de verdad. El login inicial es la única excepción. |
| RNF-02 | **Mobile-first**: La interfaz debe estar diseñada primero para móviles, con soporte responsivo. |
| RNF-03 | **Rendimiento**: Interacciones principales deben responder en menos de 300ms. **No verificado en v1** — no existe instrumentación de medición, y las specs 003-005 sumaron cálculo client-side más pesado (jerarquía de categorías, desglose de Análisis) sin revisitar este requisito. Queda pendiente de instrumentación antes de poder afirmarse como cumplido. |
| RNF-04 | **Moneda**: Valores monetarios almacenados como enteros en céntimos en lógica/DB. Moneda PEN. |
| RNF-05 | **Idioma**: Interfaz y datos exportados en español, con i18n preparada. |
| RNF-06 | **Seguridad**: Datos accesibles solo por su propietario vía RLS. |

---

## Casos límite

| Caso | Comportamiento esperado |
|---|---|
| Ajuste de porcentaje a mitad de ciclo | Aplica a todo el ciclo actual retrospectivamente. |
| Redondeo de porcentajes en céntimos | El sobrante va a la categoría de mayor porcentaje. |
| Eliminar meta de ahorro con aportes | Se impide la eliminación; el usuario debe reasignarlos. |
| Fecha límite de meta caducada (<100%) | Se muestra "vencida" pero se permiten seguir aportando. |
| Aporte excede el 100% de la meta | Se permite el registro normal (se visualiza ej. 110%). |
| Recurrencia desactivada vuelve a activarse | Inicia en el ciclo actual. Cero pagos "fantasma" retroactivos. |
| Eliminación de categoría/fuente con movimientos | Se impide la eliminación alertando al usuario. |
| Sincronización de un mismo gasto en dos dispositivos | Gana el dispositivo con el timestamp de edición más reciente. |
| Empate de porcentajes al repartir el céntimo sobrante | Gana el `id` menor en orden lexicográfico (criterio determinista, ver RF-07). |
| Borrado de bucket de distribución con movimientos asociados | Se impide la eliminación — se valida tanto por categorías de gasto asociadas como por movimientos asociados a esas categorías (ver `specs/006-qa-remediation/spec.md` RF-25). |
| Conflicto de sync entre un borrado local y una edición remota más reciente | Gana el tombstone: el borrado local se respeta aunque la edición remota tenga timestamp más reciente (ver `specs/006-qa-remediation/spec.md` RF-26). |
| Onboarding offline en múltiples dispositivos | No se resuelve en este ciclo — puede generar buckets/categorías seed duplicados sin dedupe al sincronizar. El login inicial (RF-01) ya requiere red, por lo que es un escenario de borde para una app hoy en fase demo/localhost. Limitación conocida, no se promete un fix. |

---

## Criterios de finalización

El MVP se considera completo cuando el usuario puede:
1. Hacer login con Google/GitHub (requiere internet 1 vez).
2. Completar el onboarding (ciclo mensual, ingresos, distribución 50/30/20, categorías).
3. Registrar/editar/eliminar movimientos con almacenamiento 100% en céntimos.
4. Generar gastos recurrentes (timezone local) y metas de ahorro (vencimiento opcional, superables).
5. Visualizar dashboard sin alertas ruidosas en la lista de movimientos.
6. Exportar CSV (`;` y `,`) y PDF.
7. Usar la app en modo avión sin perder nada, sincronizando por `last-write-wins` al volver la red.
